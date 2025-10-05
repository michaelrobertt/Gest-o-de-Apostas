import { GoogleGenAI, Type } from "@google/genai";
import { Bet, Market, LolLeague, BetStatus, Stats, MarketPerformancePoint, AIRecommendation, AIWithdrawalSuggestion, Withdrawal, AILeverageSuggestion } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set for Gemini. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Helper to get local date in YYYY-MM-DD format
const getLocalYYYYMMDD = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

    const promptText = `
Analise a imagem de um boletim de aposta e extraia CADA aposta. A prioridade máxima é a precisão dos dados.

**Processo de Análise Inteligente:**
1.  **Correção de OCR:** Use seu conhecimento de times e mercados de e-sports/esportes para corrigir possíveis erros de reconhecimento de texto (OCR). Por exemplo, se a imagem diz 'Fura' em um contexto de CS2, interprete como 'Furia'. Se diz 'Manchestir City', corrija para 'Manchester City'.
2.  **Inferência de Contexto:** Se o mercado não estiver claro, analise os times e tipos de aposta para inferi-lo. Ex: 'Handicap de Rounds' indica 'Counter-Strike 2'; 'Total de Kills' indica 'League of Legends'; 'Escanteios' indica 'Futebol'.

**Estrutura dos Dados:**
- \`market\`: O esporte (ex: "Futebol", "League of Legends", "Counter-Strike 2"). Se não for um destes, use o que encontrar (ex: "Basquete").
- \`details\`: O evento principal. Para jogos, "Time A vs Time B". Para apostas em jogadores, pode ser o nome do jogador ou o jogo em que ele está.
- \`betType\`: A aposta específica. Ex: "Mais de 2.5 Gols", "Handicap Asiático -1.5", "Jogador - Chutes: Mais de 1.5".
- \`value\`: O valor monetário da aposta (stake).
- \`odd\`: A cotação da aposta.

**Tipos de Boletim:**

1.  **Aposta Simples (Single):**
    *   A imagem mostra UMA aposta com seu próprio valor e odd.
    *   **Sua resposta:** Um array contendo UM objeto JSON.
    *   \`betStructure\`: "Single"
    *   Preencha \`market\`, \`details\`, \`betType\`, \`value\`, \`odd\`.

2.  **Aposta Múltipla/Acumulada (Accumulator):**
    *   A imagem mostra VÁRIAS seleções combinadas em UMA aposta, com um valor total e uma odd total. Procure por termos como "Múltipla", "Dupla", "Acumulada".
    *   **Sua resposta:** Um array contendo UM objeto JSON.
    *   \`betStructure\`: "Accumulator"
    *   \`value\`: O valor TOTAL apostado.
    *   \`odd\`: A ODD TOTAL da múltipla.
    *   \`details\`: Um resumo como "Múltipla de 2 seleções".
    *   \`selections\`: Um array de objetos, um para CADA seleção individual dentro da múltipla. Cada seleção DEVE ter:
        *   \`details\`: O evento da seleção (ex: "Santos vs São Paulo").
        *   \`betType\`: A aposta específica da seleção (ex: "Defesas de Goleiro Santos - Mais de 1.5").
        *   \`odd\`: A odd individual da seleção.

**Exemplo de Extração para uma Seleção de Múltipla:**
Se a imagem mostra:
"**Cruzeiro MG — RB Bragantino**
Defesas de Goleiro RB Bragantino — Mais de 2.5 @ 1.25"

A extração para ESTA seleção deve ser:
\`{ "details": "Cruzeiro MG — RB Bragantino", "betType": "Defesas de Goleiro RB Bragantino — Mais de 2.5", "odd": 1.25 }\`

**Regras Finais:**
-   Sempre retorne um array \`[]\`.
-   Se não conseguir extrair um campo, omita-o do JSON, mas tente extrair o máximo possível. A \`odd\` e o \`value\` devem ser números.
-   Para apostas em jogadores, tente incluir o nome do time ou o evento no campo \`details\` se estiver visível.
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
                        market: { type: Type.STRING },
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

export const reorganizeBetsWithAI = async (bets: Bet[]): Promise<{ id: string; market: string; league: string }[]> => {
    if (!process.env.API_KEY) {
        throw new Error("A chave da API do Gemini não está configurada.");
    }

    const BATCH_SIZE = 50; // Process bets in chunks to avoid token limits
    const allUpdates: { id: string; market: string; league: string }[] = [];

    const systemInstruction = `
Você é um analista de dados especialista em apostas esportivas com acesso a um vasto conhecimento sobre eventos e times. Sua tarefa é analisar uma lista de apostas em formato JSON e padronizar as categorias 'market' e 'league' para cada aposta, garantindo consistência e precisão. Você deve entender o contexto e a hierarquia dos dados.

**Processo de Análise e Validação:**
Para cada aposta, utilize seu conhecimento para verificar nomes de times, ligas e terminologias de apostas. Se um detalhe como 'CBLOL Academy' aparece, use essa informação para categorizar a liga corretamente, mesmo que o mercado original esteja genérico. Se um time como 'paiN Gaming' estiver em uma aposta com 'Handicap de Rounds', você deve inferir que o mercado é 'Counter-Strike 2', mesmo que não esteja explícito. Sua precisão é fundamental.

**Regras de Categorização Hierárquica:**

1.  **Counter-Strike 2:** Se a aposta for claramente de 'Counter-Strike 2' (CS2, CSGO), o 'market' DEVE ser 'Counter-Strike 2'. Ignore o 'market' original se estiver genérico como 'Esports'.
    *   *Pistas:* 'Handicap de Rounds', 'Vencedor do Mapa', nomes de times como 'MIBR', 'Furia', 'paiN Gaming'.

2.  **League of Legends:** Se a aposta for claramente de 'League of Legends' (LOL), o 'market' DEVE ser 'League of Legends'.
    *   *Pistas:* 'Handicap de Mapas', 'Total de Kills', 'First Blood', nomes de ligas como 'LPL', 'LCK', 'LEC', 'CBLOL'.

3.  **Futebol:** Se for de Futebol (Soccer), o 'market' DEVE ser 'Futebol'.
    *   *Pistas:* '1x2', 'Handicap Asiático', 'Ambas Marcam', 'Escanteios'.

4.  **Esports (Geral):** Se for um e-sport, mas não for CS2 ou LOL (ex: Valorant, Dota 2) ou se o 'market' original já for 'Esports' e não houver pistas suficientes para especificar, o 'market' DEVE ser 'Esports (Geral)'.

5.  **Outro:** Se não se encaixar em nenhuma das anteriores, use o 'market' original ou 'Outro' se for muito genérico.

**Campo 'league':**
-   Tente extrair a liga específica do campo 'details' ou 'league' original (ex: 'LPL', 'CBLOL', 'Champions Tour Americas').
-   Se não for possível identificar uma liga específica, retorne 'N/A'.

**Formato da Resposta OBRIGATÓRIO:**
Retorne um array de objetos JSON, onde cada objeto contém o 'id' da aposta original e os novos 'market' e 'league' padronizados, seguindo o schema fornecido.
`;

    for (let i = 0; i < bets.length; i += BATCH_SIZE) {
        const batchBets = bets.slice(i, i + BATCH_SIZE);
        const betsForAnalysis = batchBets.map(({ id, market, details, betType, league }) => ({ id, market, league, details, betType }));
        
        const userPrompt = `Analise esta lista de apostas e retorne os dados padronizados:\n${JSON.stringify(betsForAnalysis, null, 2)}`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: userPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                market: { type: Type.STRING },
                                league: { type: Type.STRING },
                            },
                            required: ["id", "market", "league"],
                        },
                    },
                },
            });

            const parsedJson = JSON.parse(response.text);
            if (Array.isArray(parsedJson)) {
                allUpdates.push(...parsedJson);
            } else {
                console.warn(`AI response for a batch was not a valid array:`, parsedJson);
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`Falha ao processar lote de reorganização da IA [${i}-${i + BATCH_SIZE}]:`, errorMessage, e);
            throw new Error(`A IA encontrou um erro ao processar os dados. Tente novamente. Detalhes: ${errorMessage}`);
        }
    }

    return allUpdates;
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


export const getAIWithdrawalSuggestion = async (stats: Stats, withdrawals: Withdrawal[]): Promise<AIWithdrawalSuggestion> => {
    if (!process.env.API_KEY) {
        throw new Error("A chave da API do Gemini não está configurada.");
    }

    const systemInstruction = `
Você é um consultor financeiro conservador e prudente, especializado em gestão de banca para apostadores. Seu objetivo principal é o crescimento sustentável e de longo prazo da banca. A realização de lucros é secundária à construção de um capital robusto. Aja com cautela.

**PROTOCOLO DE DECISÃO ESTRITO (analisado em ordem de prioridade):**

**0. Cenário de Saque Recente (Período de "Cooling-Off")**
*   **Condição:** Se houver qualquer saque nos últimos 7 dias a partir da data atual fornecida.
*   **Ação:** Aconselhar FORTEMENTE contra um novo saque para manter a disciplina.
*   **\`shouldWithdraw\`**: \`false\`
*   **\`reasoning\`**: "Você realizou um saque recentemente. Para manter a disciplina e permitir que sua banca se recomponha e cresça de forma consistente, o ideal é aguardar mais um tempo antes de realizar um novo saque. Vamos focar no crescimento do capital."
*   **\`confidenceLevel\`**: \`Alto\`

**1. Cenário: Banca Negativa ou Breakeven**
*   **Condição:** Se \`totalProfitLoss\` for menor ou igual a zero.
*   **Ação:** NUNCA recomendar saque.
*   **\`shouldWithdraw\`**: \`false\`
*   **\`reasoning\`**: "Sua banca não está lucrativa no momento. Um saque é inviável. O foco total deve ser em uma gestão disciplinada para retornar à lucratividade."
*   **\`confidenceLevel\`**: \`Alto\`

**2. Cenário: Crescimento Inicial (Reinvestimento é Prioridade)**
*   **Condição:** Se \`totalProfitLoss\` for positivo, mas representar um crescimento inferior a 25% sobre a \`initialBankroll\` (i.e., \`totalProfitLoss\` < \`initialBankroll\` * 0.25).
*   **Ação:** Aconselhar FORTEMENTE contra o saque.
*   **\`shouldWithdraw\`**: \`false\`
*   **\`reasoning\`**: "Você está lucrativo, parabéns! No entanto, seu crescimento ainda está na fase inicial. Estrategicamente, o mais inteligente agora é reinvestir 100% dos lucros para fortalecer sua base de capital e acelerar o efeito dos juros compostos no futuro."
*   **\`confidenceLevel\`**: \`Alto\`

**3. Cenário: Marco de Segurança (Recuperar o Investimento)**
*   **Condição:** Se \`totalProfitLoss\` for maior ou igual à \`initialBankroll\` E o \`totalWithdrawn\` for MENOR que a \`initialBankroll\`.
*   **Ação:** Recomendar com alta prioridade o saque do valor que falta para completar a retirada do investimento inicial.
*   **\`shouldWithdraw\`**: \`true\`
*   **\`suggestedAmount\`**: Calcule (\`initialBankroll\` - \`totalWithdrawn\`). O resultado deve ser positivo.
*   **\`reasoning\`**: "Excelente! Você atingiu um marco crucial: seu lucro já cobre todo o seu investimento inicial. Recomendo fortemente que você saque R$ [valor calculado] para completar a retirada do seu risco inicial. A partir daí, você estará apostando 100% com o lucro."
*   **\`confidenceLevel\`**: \`Alto\`

**4. Cenário: Crescimento Sólido (Saque Parcial Inteligente)**
*   **Condição:** Se nenhuma das condições de alta prioridade (0 a 3) for atendida.
*   **Ação:** Recomendar um saque parcial e conservador.
*   **\`shouldWithdraw\`**: \`true\`
*   **\`suggestedAmount\`**: Calcule 25% do \`totalProfitLoss\`.
*   **\`reasoning\`**: "Seu crescimento é sólido. É um bom momento para realizar uma parte dos seus ganhos como recompensa pela disciplina. Sugiro um saque de R$ [valor calculado], que representa 25% do seu lucro. O restante continuará investido para manter o ritmo de crescimento da sua banca."
*   **\`confidenceLevel\`**: \`Médio\`

Responda estritamente em JSON, seguindo o schema fornecido.
`;
    
    const prompt = `
Data atual para referência: ${getLocalYYYYMMDD(new Date().toISOString())}

Análise Financeira da Banca:
${JSON.stringify({
    initialBankroll: stats.initialBankroll,
    currentBankroll: stats.currentBankroll,
    totalProfitLoss: stats.totalProfitLoss,
    totalWithdrawn: stats.totalWithdrawn,
    withdrawalsHistory: (withdrawals || [])
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5) // Fornece os 5 saques mais recentes
        .map(w => ({ amount: w.amount, date: getLocalYYYYMMDD(w.date) }))
}, null, 2)}

Com base nesses dados e no seu protocolo estrito, forneça sua recomendação de saque.
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

export const getAILeverageSuggestion = async (
    stats: Stats,
    bets: Bet[]
): Promise<AILeverageSuggestion> => {
    if (!process.env.API_KEY) {
        throw new Error("A chave da API do Gemini não está configurada.");
    }
    
    const recentBets = bets
        .filter(b => b.status !== BetStatus.PENDING)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-20)
        .map(({ units, odd, status, profitLoss }) => ({ units, odd, status, profitLoss }));

    const systemInstruction = `
Você é um Estrategista de Banca, um analista financeiro sênior especializado em gestão de risco e crescimento de capital para apostadores. Sua missão é fornecer conselhos prudentes e estratégicos para alavancar a banca de forma sustentável. Você DEVE priorizar a segurança e o crescimento de longo prazo em detrimento de ganhos rápidos e arriscados.

**PROTOCOLO DE ANÁLISE ESTRITA:**

1.  **Diagnóstico do Perfil:** Analise as estatísticas e o histórico recente para classificar o apostador em um dos quatro perfis. A sua justificativa DEVE ser clara e baseada nos dados.
    *   **Recuperação:** O lucro total é negativo. O foco absoluto é disciplina, stakes mínimos e recuperação de confiança.
    *   **Conservador:** Lucro positivo mas baixo (ex: ROI < 10%), ou lucro zero (breakeven). O apostador pode ser novo ou estar a construir uma base. Foco em crescimento composto, disciplina e consistência. Se não houver histórico de apostas, justifique como um perfil de "Ponto de Partida".
    *   **Moderado:** Lucro sólido e bom desempenho (ex: ROI entre 10% e 25%). Pode assumir riscos calculados. Foco em otimização e exploração controlada.
    *   **Agressivo:** Lucro muito alto (ex: ROI > 25%), talvez com um drawdown maior. O apostador demonstra alta tolerância ao risco (ou sorte). Foco em maximizar ganhos, mas com alertas SEVEROS sobre os perigos da variância.

2.  **Geração de Conselhos (Baseado no Perfil):** Para cada perfil, você deve gerar conselhos específicos e acionáveis para cada uma das seguintes áreas.

    *   **Proteção da Banca:** Dê uma dica fundamental para proteger o capital atual. Para perfis de 'Recuperação' e 'Conservador', foque em stop-loss ou limites de perda diária. Para 'Moderado' e 'Agressivo', foque em diversificação ou realização parcial de lucros.
    *   **Estratégia de Alavancagem:** Descreva uma abordagem estratégica. Para 'Recuperação', é "não alavancar, mas reconstruir". Para 'Conservador', é "juros compostos lentos". Para 'Moderado', "aumento progressivo de stake". Para 'Agressivo', "Kelly Criterion simplificado" ou "uso de uma % do lucro".
    *   **Stake Sugerido:** Defina uma % da banca e o valor em unidades (U) para as próximas apostas. Seja conservador. NUNCA sugira mais de 5% da banca, mesmo para o perfil agressivo. Para 'Recuperação', sugira 0.5% ou 1%.
    *   **Range de Odds Ideal:** Sugira uma faixa de odds. Para 'Recuperação', odds baixas e de alta probabilidade (1.50-1.80). Para 'Conservador'/'Moderado', um range equilibrado (1.65-2.10). Para 'Agressivo', pode incluir odds mais altas (até 2.50), mas com a ressalva de que o volume deve ser menor.
    *   **Gestão de Lucros:** Aconselhe o que fazer com os lucros. Para 'Recuperação', não há lucros a gerir. Para 'Conservador', "reinvestir 100%". Para 'Moderado', "reinvestir a maior parte, considerar pequenos saques". Para 'Agressivo', "realizar lucros regularmente para reduzir o risco".

**REGRAS INQUEBRÁVEIS:**
-   Sua linguagem deve ser profissional, calma e educativa.
-   NUNCA dê conselhos de apostas específicas (ex: "aposte no Time X"). Foque apenas na estratégia de gestão.
-   Seja realista. O crescimento é uma maratona, não um sprint.
-   Responda estritamente no formato JSON definido pelo schema.
`;

    const prompt = `
Análise de Dados para Estratégia de Alavancagem:

**Estatísticas Atuais:**
${JSON.stringify({
    roi: stats.roi,
    winRate: stats.winRate,
    totalProfitLoss: stats.totalProfitLoss,
    currentBankroll: stats.currentBankroll,
    maxDrawdown: stats.maxDrawdown,
    averageOdd: stats.averageOdd
}, null, 2)}

**Histórico Cronológico Recente (últimas 20 apostas resolvidas):**
${JSON.stringify(recentBets, null, 2)}

Com base nesses dados, aplique seu protocolo de análise e gere a estratégia de alavancagem completa.
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
                    profile: { type: Type.STRING, enum: ['Conservador', 'Moderado', 'Agressivo', 'Recuperação'] },
                    profileReasoning: { type: Type.STRING },
                    protectionAdvice: {
                        type: Type.OBJECT,
                        properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                    },
                    leverageStrategy: {
                        type: Type.OBJECT,
                        properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                    },
                    suggestedStake: {
                        type: Type.OBJECT,
                        properties: {
                            bankrollPercentage: { type: Type.NUMBER },
                            units: { type: Type.NUMBER },
                            reasoning: { type: Type.STRING },
                        },
                    },
                    optimalOddRange: {
                        type: Type.OBJECT,
                        properties: {
                            min: { type: Type.NUMBER },
                            max: { type: Type.NUMBER },
                            reasoning: { type: Type.STRING },
                        },
                    },
                    profitManagement: {
                        type: Type.OBJECT,
                        properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                    },
                },
            },
        },
    });

    try {
        const parsedJson = JSON.parse(response.text);
        return parsedJson as AILeverageSuggestion;
    } catch (e) {
        console.error("Failed to parse JSON from Gemini for leverage suggestion:", response.text);
        throw new Error("Não foi possível gerar a estratégia de alavancagem da IA.");
    }
};