export enum Market {
    LOL = 'League of Legends',
    CS2 = 'Counter-Strike 2',
    SOCCER = 'Futebol',
}

export enum LolLeague {
    LPL = 'LPL',
    LCK = 'LCK',
    LTA_SUL = 'LTA Sul',
    LTA_NORTE = 'LTA Norte',
    LEC = 'LEC',
    OTHERS = 'Outros/Minors',
}

export enum BetStatus {
    PENDING = 'Pendente',
    WON = 'Ganhou',
    LOST = 'Perdeu',
}

export interface BetSelection {
    details: string;
    betType: string;
    odd: number;
}

export interface Bet {
    id: string;
    date: string;
    market: string;
    league: LolLeague | string;
    betStructure: 'Single' | 'Accumulator';
    betType: string;
    details: string;
    selections?: BetSelection[];
    units: number;
    value: number;
    odd: number;
    status: BetStatus;
    profitLoss: number;
}

export interface Withdrawal {
    id: string;
    date: string;
    amount: number;
}

export interface BankrollData {
    bets: Bet[];
    initialBankroll: number;
    blacklistedTeams?: string[];
    withdrawals?: Withdrawal[];
}

export interface Stats {
    initialBankroll: number;
    currentBankroll: number;
    totalProfitLoss: number;
    resolvedBetsCount: number;
    wonBetsCount: number;
    roi: number;
    winRate: number;
    averageOdd: number;
    existingTeams: Record<string, string[]>;
    totalWithdrawn: number;
    totalInvested: number;
    maxDrawdown: number;
}

export interface BankrollHistoryPoint {
    eventNumber: number;
    value: number;
    bet?: Bet;
    withdrawal?: Withdrawal;
    isNewDay: boolean;
    date: string;
    timestamp: number;
}

export interface MarketPerformancePoint {
    name: string;
    profit: number;
    invested: number;
    betsCount: number;
}

export interface DailyProfitPoint {
    date: string; // YYYY-MM-DD
    profit: number;
    profitUnits: number;
    count: number;
}

export interface ChartsData {
    bankrollHistory: BankrollHistoryPoint[];
    performanceByMarket: MarketPerformancePoint[];
    dailyProfit: DailyProfitPoint[];
}

export interface AIRecommendation {
    recommendationTitle: string;
    suggestedUnits: number;
    analysisSummary: string;
    riskAlert: {
        level: 'Baixo' | 'Médio' | 'Alto' | 'Nenhum';
        message: string;
    } | null;
    strategicAdvice: string;
}

export interface AIWithdrawalSuggestion {
    shouldWithdraw: boolean;
    reasoning: string;
    suggestedAmount: number;
    confidenceLevel: 'Baixo' | 'Médio' | 'Alto';
}