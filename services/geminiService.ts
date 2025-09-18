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

    // FIX: Escaped backticks inside the template literal to prevent them from being parsed as variables.
    const promptText = `
Analise esta imagem de um boletim de aposta e extraia as informações de CADA aposta.
Sua principal tarefa é DIFERENCIAR entre um boletim com múltiplas apostas INDIVIDUAIS e um boletim com uma ÚNICA aposta COMBINADA (ex: Múltipla, Acumulada, Dupla, Tripla).

1.  **SE for uma aposta COMBINADA (Múltipla/Acumulada):**
    *   Procure por palavras-chave como "Múltipla", "Acumulada", "Dupla", etc.
    *   Verifique se há um único valor de aposta total (stake) e um único valor de retorno potencial para várias seleções.
    *   **Resultado:** Retorne um ÚNICO objeto JSON dentro de um array.
        *   \`betStructure\`: "Accumulator"
        *   \`betType\`: "Acumulada"
        *   \`details\`: Um resumo, como "Acumulada de 3 seleções".
        *   \`value\`: O valor TOTAL apostado.
        *   \`odd\`: A ODD TOTAL combinada.
        *   \`selections\`: Um array onde cada objeto representa uma seleção individual da múltipla, contendo \`details\`, \`betType\`, e \`odd\` para aquela seleção.

2.  **SE forem múltiplas apostas INDIVIDUAIS:**
    *   Cada aposta terá seu próprio valor (stake) e sua própria odd.
    *   **Resultado:** Retorne um ARRAY de objetos JSON, um para cada aposta individual encontrada.
        *   \`betStructure\`: "Single"
        *   Preencha os outros campos (\`market\`, \`league\`, \`details\`, \`betType\`, \`value\`, \`odd\`) para cada aposta.

**Sempre retorne um array de objetos, mesmo que encontre apenas uma aposta.**
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                imagePart,
                { text: promptText }
            ],
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        market: { type: Type.STRING, enum: Object.values(Market) },
                        league: { type: Type.STRING },
                        betStructure: { type: Type.STRING, enum: ['Single', 'Accumulator'] },
                        betType: { type: Type.STRING },
                        details: { type: Type.STRING },
                        value: { type: Type.NUMBER },
                        odd: { type: Type.NUMBER },
                        selections: {
                            type: Type.ARRAY,
                            nullable: true,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    details: { type: Type.STRING },
                                    betType: { type: Type.STRING },
                                    odd: { type: Type.NUMBER },
                                }
                            }
                        }
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

    // Sort bets chronologically (oldest to newest) to analyze behavior patterns
    const recentBets = bets
        .filter(b => b.status !== BetStatus.PENDING)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-20) // Take the last 20
        .map(({ market, league, units, odd, status, profitLoss, details }) => ({ details, market, league, units, odd, status, profitLoss }));

    const systemInstruction = `
Você é um Assistente de Gestão de Banca com Expertise em Psicologia Comportamental, especializado em detectar e corrigir vieses cognitivos que prejudicam apostadores. Sua função não é apenas analisar números, mas atuar como um coach de performance que compreende profundamente como o cérebro humano funciona em situações de risco e incerteza.

**CONHECIMENTO CIENTÍFICO FUNDAMENTAL**
- **Sistema de Recompensa:** O cérebro processa perdas com o dobro da intensidade de ganhos equivalentes, levando a decisões irracionais.
- **Controle Executivo:** O córtex pré-frontal, responsável pelo controle de impulsos, tem sua atividade reduzida durante apostas, tornando a disciplina mais difícil.
- **Neuroplasticidade:** O cérebro pode ser retreinado através de práticas disciplinadas e feedback consistente.

**VIESES COGNITIVOS CRÍTICOS A DETECTAR**
1.  **Aversão à Perda (Loss Aversion / Tilt):**
    *   **Manifestação:** Aumento reativo de stakes (unidades) após derrotas.
    *   **Detecção:** Analise se há aumento de unidades (ex: de 1U para 2U) imediatamente após sequências de 1 a 3 derrotas. Ignore apostas com 0 unidades. Um padrão crítico é um aumento de stake superior a 150% da unidade padrão (ex: saltar de 1U para 3U).
2.  **Falácia da Mão Quente (Hot Hand Fallacy / Overconfidence):**
    *   **Manifestação:** Aumento de stakes após vitórias consecutivas.
    *   **Detecção:** Analise se há escalada de unidades durante sequências de vitórias. Um limiar crítico é um aumento de stake superior a 200% da unidade (ex: de 1U para 3U ou mais) durante uma streak positiva. Ignore apostas com 0 unidades.

**PROTOCOLO DE ANÁLISE COMPORTAMENTAL**
1.  **Análise Cronológica Obrigatória:** Sua análise DEVE se basear nas últimas 20 apostas na ordem cronológica EXATA para identificar padrões.
2.  **Gestão de Banca Disciplinada:** Se NÃO detectar vieses e notar que o apostador mantém stakes consistentes, você DEVE elogiar essa disciplina.

**ESTRUTURA DA RESPOSTA PSICOLógica (OBRIGATÓRIO)**

**A) Quando DETECTAR Vieses:**
*   **Título da Recomendação:** Comece com "Análise Comportamental".
*   **Alerta de Risco:**
    *   **Nível:** 'Alto' para Aversão à Perda, 'Médio' para Falácia da Mão Quente.
    *   **Mensagem:** Deve ser um texto coeso e de fácil leitura. 
        1. Identifique o viés (ex: "Você demonstrou o viés de Aversão à Perda, também conhecido como 'Tilt'.").
        2. CITE O PADRÃO EXATO de forma clara e humana, referenciando os detalhes da aposta, não timestamps (ex: "Notei que após duas perdas consecutivas, você aumentou sua aposta para 3 unidades.").
        3. Use uma quebra de linha (\\n).
        4. Explique a neurociência por trás de forma simples (ex: "Neurocientificamente, seu cérebro processa perdas com o dobro da intensidade emocional...").
*   **Conselho Estratégico:** Forneça uma estratégia de correção clara (ex: "Recomendo um 'cooling-off period' e a redefinição de sua stake para 1% fixo da banca atual...").
*   **Unidades Sugeridas:** Sugira uma unidade menor (ex: 0.5U ou 1U) como parte da correção.

**B) Quando NÃO DETECTAR Vieses:**
*   **Título da Recomendação:** "Gestão de Banca Disciplinada".
*   **Alerta de Risco:** Nível 'Nenhum'.
*   **Resumo da Análise:** 1. Elogie a disciplina (ex: "Excelente disciplina. Mesmo após a sequência de vitórias, você manteve sua gestão de unidades consistente..."). 2. Reforce o comportamento como indicador de maturidade psicológica.
*   **Conselho Estratégico:** Dê conselhos baseados na performance (ex: "Continue focando no mercado de LCK. Considere explorar o Handicap de Mapas com sua unidade padrão.").
*   **Unidades Sugeridas:** Recomende a manutenção ou um ajuste lógico.

**LINGUAGEM E TOM**
*   **Científico mas Acessível:** Use termos como "córtex pré-frontal", mas explique de forma clara.
*   **Não Julgativo:** Vieses são naturais, não falhas pessoais.
*   **Orientado a Soluções:** Foque em estratégias práticas.
*   **Reforço Positivo:** Celebre a disciplina.

Responda estritamente em JSON, seguindo o schema.
`;

    const prompt = `
Análise de Desempenho do Apostador:

**Estatísticas Gerais:**
${JSON.stringify({ roi: stats.roi, winRate: stats.winRate, totalProfitLoss: stats.totalProfitLoss, currentBankroll: stats.currentBankroll }, null, 2)}

**Histórico Cronológico Recente (últimas 20 apostas resolvidas, da mais antiga para a mais nova):**
${JSON.stringify(recentBets, null, 2)}

**Desempenho por Mercado/Liga:**
${JSON.stringify(performanceByMarket, null, 2)}

Com base nesses dados, realize sua análise comportamental e quantitativa e forneça a recomendação, seguindo estritamente todas as regras e a estrutura de resposta definidas.
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
                        description: "Um título claro para a análise, como 'Análise Comportamental' ou 'Gestão de Banca Disciplinada'."
                    },
                    suggestedUnits: {
                        type: Type.NUMBER,
                        description: "O número de unidades sugerido para a próxima aposta, baseado na análise psicológica."
                    },
                    analysisSummary: {
                        type: Type.STRING,
                        description: "Resumo conciso da análise de desempenho ou, no caso de disciplina, o elogio explícito."
                    },
                    riskAlert: {
                        type: Type.OBJECT,
                        nullable: true,
                        properties: {
                            level: {
                                type: Type.STRING,
                                enum: ['Baixo', 'Médio', 'Alto', 'Nenhum'],
                                description: "Nível do alerta de risco. 'Alto' para tilt, 'Médio' para excesso de confiança, 'Nenhum' para disciplina."
                            },
                            message: {
                                type: Type.STRING,
                                description: "A mensagem de alerta explicando o viés, a neurociência e o padrão exato nos dados. Use quebras de linha (\\n) para separar parágrafos."
                            }
                        }
                    },
                    strategicAdvice: {
                        type: Type.STRING,
                        description: "Aconselhamento estratégico prático e acionável, incluindo estratégias de correção baseadas em evidências se um viés for detectado."
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