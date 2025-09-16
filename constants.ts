import { Market, LolLeague } from './types';

export const MARKETS: Market[] = [
    Market.LOL,
    Market.CS2,
    Market.SOCCER,
];

export const LOL_LEAGUES: LolLeague[] = [
    LolLeague.LPL,
    LolLeague.LCK,
    LolLeague.LTA_SUL,
    LolLeague.LTA_NORTE,
    LolLeague.LEC,
    LolLeague.OTHERS,
];

export const BET_TYPES: Record<Market, string[]> = {
    [Market.LOL]: ['Moneyline (ML)', 'Handicap de Mapas', 'Total de Mapas (Over/Under)', 'Total de Kills', 'Handicap de Kills', 'First Blood', 'Outro'],
    [Market.CS2]: ['Moneyline (ML)', 'Handicap de Mapas', 'Handicap de Rounds', 'Total de Rounds (Over/Under)', 'Vencedor do Mapa', 'Outro'],
    [Market.SOCCER]: ['1x2 (Resultado Final)', 'Handicap Asiático', 'Total de Gols (Mais/Menos)', 'Ambas Marcam', 'Total de Cartões', 'Escanteios', 'Outro'],
};

export const HANDICAP_OPTIONS: string[] = [
    '+2.5', '+1.5', '-1.5', '-2.5'
];

export const UNITS: { label: string, value: number }[] = [
    { label: '0.5U', value: 0.5 },
    { label: '1U', value: 1 },
    { label: '2U', value: 2 },
    { label: '3U', value: 3 },
];

export const UNIT_PERCENTAGE = 0.03; // 3%