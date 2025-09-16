import { GoogleGenAI, Type } from "@google/genai";
import { Bet, Market, LolLeague, BetStatus, Stats, MarketPerformancePoint, AIRecommendation } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set for Gemini. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const parseBetFromImage = async (imageFile: File): Promise<Partial<Bet>> => {
    if (!process.env.API_KEY) {
        throw new Error("A chave da API do Gemini não está configurada.");
    }

    const imagePart = await fileToGenerativePart(imageFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                imagePart,
                { text: "Analise esta imagem de um boletim de aposta. Extraia as informações da aposta. O mercado deve ser um dos seguintes: 'League of Legends', 'Counter-Strike 2', 'Futebol'." }
            ],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    market: {
                        type: Type.STRING,
                        enum: Object.values(Market),
                        description: "O mercado da aposta.",
                    },
                    league: {
                        type: Type.STRING,
                        description: "A liga, se aplicável (ex: LPL, CBLOL).",
                    },
                    details: {
                        type: Type.STRING,
                        description: "Os times envolvidos, no formato 'Time A vs Time B'.",
                    },
                    betType: {
                        type: Type.STRING,
                        description: "O tipo de aposta (ex: Moneyline, Handicap -1.5).",
                    },
                    odd: {
                        type: Type.NUMBER,
                        description: "A odd da aposta.",
                    },
                },
            },
        },
    });

    try {
        const parsedJson = JSON.parse(response.text);
        return parsedJson as Partial<Bet>;
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", response.text);
        throw new Error("Não foi possível extrair os dados da imagem. Tente novamente.");
    }
};

export const getAIRecommendation = async (
    bets: Bet[],
    stats: Stats,
    performanceByMarket: MarketPerformancePoint[]
): Promise<AIRecommendation> => {
    if (!process.env.API_KEY) {
        throw new Error("A chave da API do Gemini não está configurada.");
    }

    const recentBets = bets
        .filter(b => b.status !== BetStatus.PENDING)
        .slice(0, 20)
        .map(({ market, league, units, odd, status, profitLoss }) => ({ market, league, units, odd, status, profitLoss }));

    const systemInstruction = `
Você é um analista de apostas esportivas e gestão de banca de classe mundial, especializado em análise quantitativa, psicologia do apostador e mitigação de riscos. Seu objetivo é fornecer um plano disciplinado, escalável e orientado a resultados. Aja com rigor analítico e realismo.

**Sua Tarefa:**
Analise os dados fornecidos sobre o desempenho de um apostador e forneça uma recomendação clara para a PRÓXIMA aposta. Sua análise deve otimizar a lucratividade a longo prazo, preservando a banca.

**Dados Fornecidos:**
1.  **Estatísticas Gerais:** ROI, taxa de acerto, lucro total, etc.
2.  **Histórico Recente:** As últimas 20 apostas resolvidas.
3.  **Desempenho por Mercado/Liga:** Lucro/prejuízo agregado para cada modalidade.

**Instruções de Análise:**
1.  **Identificar Tendências:** Procure por sequências de vitórias (streaks) ou derrotas (slumps). Estão concentradas em algum mercado, liga ou tipo de aposta específico?
2.  **Análise de Desempenho:** Compare o ROI e a taxa de acerto gerais com o desempenho recente. O apostador está em uma fase boa ou ruim? O desempenho é consistente?
3.  **Avaliação de Risco (Psicologia):** Com base no tamanho das unidades apostadas e nos resultados recentes, detecte sinais de comportamento de risco:
    *   **Tilt/Perseguição de Perdas:** O apostador aumentou as unidades logo após uma ou mais derrotas? Isso é um sinal de alerta ALTO.
    *   **Excesso de Confiança:** O apostador aumentou as unidades drasticamente após uma sequência de vitórias? Isso é um alerta MÉDIO.
    *   **Disciplina:** O apostador mantém um tamanho de unidade consistente, independentemente dos resultados recentes? Isso é um bom sinal.
4.  **Estratégia de Staking (Unidades):** Com base em sua análise, sugira um tamanho de unidade para a próxima aposta (0.5, 1, 2, ou 3). A recomendação deve ser conservadora após derrotas (sugerir 0.5U ou 1U) e disciplinada após vitórias (manter ou aumentar moderadamente, mas evitar saltos para 3U sem uma justificativa muito forte).
5.  **Aconselhamento Estratégico (Adaptabilidade):** Forneça conselhos práticos para ajustar a estratégia. Seja específico.
    *   Exemplo Positivo: "Seu desempenho em League of Legends, especialmente na LCK, é excelente. Continue focando nesse nicho."
    *   Exemplo de Melhoria: "O mercado de Handicap de Mapas em CS2 tem sido consistentemente negativo para você. Sugiro uma pausa nesse mercado ou a redução da unidade para 0.5U ao apostar nele."

**Formato da Resposta:**
Responda estritamente em JSON, seguindo o schema fornecido. Seja direto, objetivo e técnico.
`;

    const prompt = `
Análise de Desempenho do Apostador:

**Estatísticas Gerais:**
${JSON.stringify({ roi: stats.roi, winRate: stats.winRate, totalProfitLoss: stats.totalProfitLoss, currentBankroll: stats.currentBankroll }, null, 2)}

**Histórico Recente (últimas 20 apostas):**
${JSON.stringify(recentBets, null, 2)}

**Desempenho por Mercado/Liga:**
${JSON.stringify(performanceByMarket, null, 2)}

Com base nesses dados, forneça sua análise e recomendação.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    recommendationTitle: {
                        type: Type.STRING,
                        description: "Um título claro e direto para a recomendação. Ex: 'Manter Disciplina: 1 Unidade' ou 'Aposta de Recuperação: 0.5 Unidade'."
                    },
                    suggestedUnits: {
                        type: Type.NUMBER,
                        description: "O número de unidades sugerido para a próxima aposta (0.5, 1, 2, ou 3)."
                    },
                    analysisSummary: {
                        type: Type.STRING,
                        description: "Resumo conciso da análise de desempenho, destacando o momento atual (positivo, negativo, neutro) e as razões."
                    },
                    riskAlert: {
                        type: Type.OBJECT,
                        nullable: true,
                        properties: {
                            level: {
                                type: Type.STRING,
                                enum: ['Baixo', 'Médio', 'Alto', 'Nenhum'],
                                description: "Nível do alerta de risco. 'Alto' para tilt, 'Médio' para excesso de confiança."
                            },
                            message: {
                                type: Type.STRING,
                                description: "A mensagem de alerta explicando o risco detectado. Ex: 'Sinais de 'tilt' detectados. Você aumentou sua unidade para 2U após 3 derrotas seguidas.'"
                            }
                        }
                    },
                    strategicAdvice: {
                        type: Type.STRING,
                        description: "Aconselhamento estratégico prático e acionável. Ex: 'Focar em apostas Moneyline em LoL onde seu desempenho é mais forte e evitar o mercado de Escanteios em Futebol até analisar melhor sua estratégia.'"
                    }
                }
            }
        }
    });

    try {
        const parsedJson = JSON.parse(response.text);
        return parsedJson as AIRecommendation;
    } catch (e) {
        console.error("Failed to parse JSON from Gemini for recommendation:", response.text);
        throw new Error("Não foi possível gerar a recomendação da IA.");
    }
};
