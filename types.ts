// FIX: Removed a conflicting self-import of 'Market' that caused a circular dependency.
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

export interface Bet {
    id: string;
    date: string;
    market: Market;
    league: LolLeague | string;
    betType: string;
    details: string;
    units: number;
    value: number;
    odd: number;
    status: BetStatus;
    profitLoss: number;
}

export interface BankrollData {
    bets: Bet[];
    initialBankroll: number;
    blacklistedTeams?: string[];
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
    existingTeams: Record<Market, string[]>;
}

export interface BankrollHistoryPoint {
    date: string;
    value: number;
}

export interface MarketPerformancePoint {
    name: string;
    profit: number;
}

export interface ChartsData {
    bankrollHistory: BankrollHistoryPoint[];
    performanceByMarket: MarketPerformancePoint[];
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
