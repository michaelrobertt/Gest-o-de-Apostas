import { GoogleGenAI, Type } from "@google/genai";
import { Bet, Market, LolLeague, BetStatus, Stats, MarketPerformancePoint, AIRecommendation, AIWithdrawalSuggestion } from '../types';

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

export const parseBetsFromImage = async (imageFile: File): Promise<Partial<Bet>[]> => {
    if (!process.env.API_KEY) {
        throw new Error("A chave da API do Gemini não está configurada.");
    }

    const imagePart = await fileToGenerativePart(imageFile);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                imagePart,
                { text: "Analise esta imagem de um boletim de aposta. Extraia as seguintes informações para CADA aposta que encontrar na imagem: mercado (deve ser um dos seguintes: 'League of Legends', 'Counter-Strike 2', 'Futebol'), liga, times envolvidos (no formato 'Time A vs Time B'), tipo de aposta, valor apostado (stake) e a odd. Retorne uma lista de objetos, um para cada aposta." }
            ],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
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
                        value: {
                            type: Type.NUMBER,
                            description: "O valor apostado (stake).",
                        },
                        odd: {
                            type: Type.NUMBER,
                            description: "A odd da aposta.",
                        },
                    },
                }
            },
        },
    });

    try {
        const parsedJson = JSON.parse(response.text);
        if (Array.isArray(parsedJson)) {
            return parsedJson as Partial<Bet>[];
        }
        // Handle cases where the API might still return a single object
        if (typeof parsedJson === 'object' && parsedJson !== null) {
            return [parsedJson as Partial<Bet>];
        }
        return [];
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", response.text);
        throw new Error("Não foi possível extrair os dados da imagem. O formato da resposta da IA é inválido.");
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


export const getAIWithdrawalSuggestion = async (stats: Stats): Promise<AIWithdrawalSuggestion> => {
    if (!process.env.API_KEY) {
        throw new Error("A chave da API do Gemini não está configurada.");
    }

    const systemInstruction = `
Você é um consultor financeiro especializado em gestão de banca para apostadores. Seu objetivo é ajudar o usuário a tomar decisões inteligentes sobre quando e quanto sacar para garantir lucros, proteger o capital e manter um crescimento sustentável da banca. Aja com prudência e foco na saúde financeira a longo prazo.

**Sua Tarefa:**
Com base nas estatísticas financeiras fornecidas, determine se é um bom momento para o apostador fazer um saque. Se for, sugira um valor que equilibre a realização de lucros com a necessidade de manter capital suficiente para continuar apostando efetivamente.

**Critérios de Análise:**
1.  **Crescimento da Banca:** Compare a 'Banca Atual' com a 'Banca Inicial'. Um crescimento significativo (ex: mais de 50-100% de lucro sobre o valor inicial) é um forte indicador para um saque.
2.  **Lucro Total:** Um 'Lucro/Prejuízo Total' positivo é um pré-requisito para qualquer saque.
3.  **Saques Anteriores:** Considere o 'Total Sacado'. Se o usuário já sacou um valor considerável, pode ser prudente continuar a reinvestir os lucros para aumentar a banca.
4.  **Valor do Saque Sugerido:** Se um saque for recomendado, o valor deve ser uma porção do lucro, não da banca inteira. Uma boa regra é sugerir sacar entre 25% a 50% do lucro total, ou o suficiente para recuperar a banca inicial se o lucro for grande. O objetivo é "pagar" o investimento inicial e continuar jogando com o lucro.

**Formato da Resposta:**
Responda estritamente em JSON, seguindo o schema fornecido.
`;
    
    const prompt = `
Análise Financeira da Banca:
${JSON.stringify({
    initialBankroll: stats.initialBankroll,
    currentBankroll: stats.currentBankroll,
    totalProfitLoss: stats.totalProfitLoss,
    totalWithdrawn: stats.totalWithdrawn
}, null, 2)}

Com base nesses dados, forneça sua recomendação de saque.
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
                    shouldWithdraw: {
                        type: Type.BOOLEAN,
                        description: "Indica se um saque é recomendado neste momento."
                    },
                    reasoning: {
                        type: Type.STRING,
                        description: "Uma explicação clara e concisa do porquê um saque é (ou não é) recomendado, baseada nos dados fornecidos."
                    },
                    suggestedAmount: {
                        type: Type.NUMBER,
                        description: "O valor sugerido para o saque. Deve ser 0 se 'shouldWithdraw' for falso."
                    },
                    confidenceLevel: {
                        type: Type.STRING,
                        enum: ['Baixo', 'Médio', 'Alto'],
                        description: "O nível de confiança na recomendação de saque."
                    }
                }
            }
        }
    });

    try {
        const parsedJson = JSON.parse(response.text);
        return parsedJson as AIWithdrawalSuggestion;
    } catch (e) {
        console.error("Failed to parse JSON from Gemini for withdrawal suggestion:", response.text);
        throw new Error("Não foi possível gerar a sugestão de saque da IA.");
    }
};