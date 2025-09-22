import { useState, useEffect, useMemo, useCallback } from 'react';
import { Bet, BankrollData, BetStatus, Stats, ChartsData, Market, LolLeague, Withdrawal, BankrollHistoryPoint, MarketPerformancePoint, DailyProfitPoint, BetSelection } from '../types';

const LOCAL_STORAGE_KEY = 'betting-tracker-data';

const defaultState: BankrollData = {
    bets: [],
    initialBankroll: 100,
    blacklistedTeams: [],
    withdrawals: [],
};

// Helper to get local date in YYYY-MM-DD format
const getLocalYYYYMMDD = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


const validateSelection = (sel: any): BetSelection | null => {
    if (typeof sel !== 'object' || sel === null) return null;
    const selectionOdd = Number(sel.odd ?? 1);
    return {
        details: String(sel.details ?? 'N/A'),
        betType: String(sel.betType ?? 'N/A'),
        odd: Number.isFinite(selectionOdd) && selectionOdd >= 1 ? selectionOdd : 1,
    };
};

const validateBetData = (b: any): Bet | null => {
    if (typeof b !== 'object' || b === null) {
        return null;
    }

    let status: BetStatus;
    switch (b.status) {
        case 'Vitória':
        case BetStatus.WON: status = BetStatus.WON; break;
        case 'Derrota':
        case BetStatus.LOST: status = BetStatus.LOST; break;
        case 'Pendente':
        case BetStatus.PENDING:
        default: status = BetStatus.PENDING; break;
    }

    const value = Number(b.value ?? b.stake ?? 0);
    const units = Number(b.units ?? 0);
    const odd = Number(b.odd ?? 1);

    const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
    const safeUnits = Number.isFinite(units) && units >= 0 ? units : 0;
    const safeOdd = Number.isFinite(odd) && odd >= 1 ? odd : 1;
    
    let profitLoss: number;

    // Status is the source of truth for profit/loss. This ensures correctness when
    // updating a bet from Pending to Won/Lost, and also cleans up imported data.
    if (status === BetStatus.WON) {
        profitLoss = safeValue * (safeOdd - 1);
    } else if (status === BetStatus.LOST) {
        profitLoss = -safeValue;
    } else { // PENDING
        profitLoss = 0;
    }
    
    const rawLeague = String(b.league || b.context || 'N/A');

    return {
        id: String(b.id || `${new Date().toISOString()}-${Math.random()}`),
        date: String(b.date || new Date().toISOString()),
        market: String(b.market || Market.SOCCER),
        league: (rawLeague === 'null' || rawLeague === 'undefined') ? 'N/A' : rawLeague,
        betStructure: b.betStructure === 'Accumulator' ? 'Accumulator' : 'Single',
        betType: String(b.betType || 'N/A'),
        details: String(b.details || b.betDetail || ''),
        selections: Array.isArray(b.selections) 
            ? b.selections.map(validateSelection).filter((s): s is BetSelection => s !== null) 
            : undefined,
        units: safeUnits,
        value: safeValue,
        odd: safeOdd,
        status: status,
        profitLoss: parseFloat(profitLoss.toFixed(2)),
    };
};

const validateWithdrawal = (w: any): Withdrawal | null => {
    if (typeof w !== 'object' || w === null) {
        return null;
    }
    const amount = Number(w.amount);
    if (!Number.isFinite(amount) || amount < 0) {
        return null;
    }
    return {
        id: String(w.id || `${new Date().toISOString()}-${Math.random()}`),
        date: String(w.date || new Date().toISOString()),
        amount: amount,
    };
};

export const useBankroll = (filterYear: number) => {
    const [state, setState] = useState<BankrollData>(() => {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                const parsed = JSON.parse(storedData);
                
                const validatedBets = Array.isArray(parsed.bets) 
                    ? parsed.bets.map(validateBetData).filter((b): b is Bet => b !== null) 
                    : [];
                
                const validatedWithdrawals = Array.isArray(parsed.withdrawals)
                    ? parsed.withdrawals.map(validateWithdrawal).filter((w): w is Withdrawal => w !== null)
                    : [];

                return { 
                    ...defaultState, 
                    ...parsed,
                    bets: validatedBets, 
                    blacklistedTeams: Array.isArray(parsed.blacklistedTeams) ? parsed.blacklistedTeams : [], 
                    withdrawals: validatedWithdrawals,
                };
            }
            return defaultState;
        } catch (error) {
            console.error("Failed to parse data from localStorage", error);
            return defaultState;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error("Failed to save data to localStorage", error);
        }
    }, [state]);
    
    const addBet = useCallback((newBet: Omit<Bet, 'id' | 'date' | 'profitLoss' | 'status'>) => {
        setState(prevState => {
             const betToValidate: Bet = {
                ...newBet,
                id: new Date().toISOString() + Math.random(),
                date: new Date().toISOString(),
                status: BetStatus.PENDING,
                profitLoss: 0,
            };
            const validatedBet = validateBetData(betToValidate);

            if(!validatedBet) {
                console.error("Failed to add invalid bet", betToValidate);
                return prevState;
            }
            
            const sortedBets = [...prevState.bets, validatedBet].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return { ...prevState, bets: sortedBets };
        });
    }, []);

    const addWithdrawal = useCallback((amount: number) => {
        setState(prevState => {
            const withdrawal: Withdrawal = {
                id: new Date().toISOString() + Math.random(),
                date: new Date().toISOString(),
                amount: amount,
            };
            const updatedWithdrawals = [...(prevState.withdrawals || []), withdrawal];
            return { ...prevState, withdrawals: updatedWithdrawals };
        });
    }, []);

    const deleteBet = useCallback((betId: string) => {
        setState(prevState => ({
            ...prevState,
            bets: prevState.bets.filter(b => b.id !== betId)
        }));
    }, []);

    const updateBet = useCallback((betId: string, updatedBetData: Bet) => {
        setState(prevState => {
            const validatedBet = validateBetData(updatedBetData);
            if (!validatedBet) {
                console.error("Failed to update with invalid bet data", updatedBetData);
                return prevState;
            }
            const newBets = prevState.bets.map(bet => (bet.id === betId ? validatedBet : bet));
            const sortedBets = newBets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return { ...prevState, bets: sortedBets };
        });
    }, []);

    const updateBetStatus = useCallback((betId: string, newStatus: BetStatus.WON | BetStatus.LOST) => {
        setState(prevState => ({
            ...prevState,
            bets: prevState.bets.map(bet => {
                if (bet.id === betId) {
                    const updatedBetWithStatus = {...bet, status: newStatus};
                    const validatedBet = validateBetData(updatedBetWithStatus);
                    return validatedBet || bet; // Fallback to original bet if validation fails
                }
                return bet;
            }),
        }));
    }, []);

    const setInitialBankroll = useCallback((amount: number) => {
        setState(prevState => ({ ...prevState, initialBankroll: amount }));
    }, []);

    const deleteTeamSuggestion = useCallback((teamToDelete: string) => {
        setState(prevState => ({
            ...prevState,
            blacklistedTeams: [...(prevState.blacklistedTeams || []), teamToDelete]
        }));
    }, []);

    const importData = useCallback((file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result;
                    if (typeof text !== 'string') {
                        throw new Error("File content is not valid text.");
                    }
                    const data = JSON.parse(text) as any;

                    if (!data || typeof data.initialBankroll === 'undefined') {
                        throw new Error("Arquivo JSON inválido. A estrutura esperada é { initialBankroll: number, ... }.");
                    }

                    const validatedBets = Array.isArray(data.bets)
                        ? data.bets.map(validateBetData).filter((bet): bet is Bet => bet !== null)
                        : [];

                    const validatedWithdrawals = Array.isArray(data.withdrawals)
                        ? data.withdrawals.map(validateWithdrawal).filter((w): w is Withdrawal => w !== null)
                        : [];
                    
                    const sortedBets = validatedBets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    setState({ 
                        initialBankroll: Number(data.initialBankroll) || 0, 
                        bets: sortedBets,
                        blacklistedTeams: Array.isArray(data.blacklistedTeams) ? data.blacklistedTeams : [],
                        withdrawals: validatedWithdrawals,
                    });
                    resolve("Dados importados com sucesso!");
                } catch (error) {
                    reject(`Falha ao importar: ${error instanceof Error ? error.message : String(error)}`);
                }
            };
            reader.onerror = () => reject("Erro ao ler o arquivo.");
            reader.readAsText(file);
        });
    }, []);

    const exportData = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            const dataStr = JSON.stringify(state, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = 'bet_tracker_data.json';
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            linkElement.remove();
            resolve();
        });
    }, [state]);

    const clearData = useCallback((): Promise<string> => {
        return new Promise((resolve) => {
            if (window.confirm("Você tem certeza que deseja apagar todos os dados? Esta ação é irreversível.")) {
                setState(defaultState);
                resolve("Todos os dados foram apagados.");
            } else {
                resolve("Operação cancelada.");
            }
        });
    }, []);
    
    const availableMarkets = useMemo(() => {
        const marketsFromBets = new Set(state.bets.map(b => b.market));
        const defaultMarkets = Object.values(Market);
        // Ensure default markets are present even if no bets exist for them
        return Array.from(new Set([...defaultMarkets, ...marketsFromBets]));
    }, [state.bets]);

    const bankrollHistory = useMemo<BankrollHistoryPoint[]>(() => {
        const resolvedBets = state.bets.filter(b => b.status !== BetStatus.PENDING);
        const withdrawals = state.withdrawals || [];

        const events: (
            { type: 'bet'; data: Bet } |
            { type: 'withdrawal'; data: Withdrawal }
        )[] = [
            ...resolvedBets.map(b => ({ type: 'bet' as const, data: b })),
            ...withdrawals.map(w => ({ type: 'withdrawal' as const, data: w }))
        ];
    
        events.sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());
        
        let cumulativeBankroll = state.initialBankroll;
        let lastDate: string | null = null;

        const firstEventDate = events.length > 0 ? events[0].data.date : new Date().toISOString();
        const history: BankrollHistoryPoint[] = [{
            eventNumber: 0,
            value: state.initialBankroll,
            isNewDay: true,
            date: firstEventDate,
            timestamp: new Date(firstEventDate).getTime(),
        }];

        events.forEach((event, index) => {
            const currentDate = getLocalYYYYMMDD(event.data.date);
            const isNewDay = currentDate !== lastDate;
            lastDate = currentDate;
    
            let point: Partial<BankrollHistoryPoint>;
    
            if (event.type === 'bet') {
                cumulativeBankroll += event.data.profitLoss;
                point = {
                    value: parseFloat(cumulativeBankroll.toFixed(2)),
                    bet: event.data,
                };
            } else { // withdrawal
                cumulativeBankroll -= event.data.amount;
                point = {
                    value: parseFloat(cumulativeBankroll.toFixed(2)),
                    withdrawal: event.data,
                };
            }
    
            history.push({
                ...point,
                eventNumber: index + 1,
                isNewDay: isNewDay,
                date: event.data.date,
                timestamp: new Date(event.data.date).getTime(),
            } as BankrollHistoryPoint);
        });
        return history;

    }, [state.bets, state.initialBankroll, state.withdrawals]);

    const stats = useMemo<Stats>(() => {
        const resolvedBets = state.bets.filter(b => b.status !== BetStatus.PENDING);
        const wonBets = resolvedBets.filter(b => b.status === BetStatus.WON);
        
        const totalProfitLoss = resolvedBets.reduce((acc, b) => acc + b.profitLoss, 0);
        const totalWithdrawn = (state.withdrawals || []).reduce((acc, w) => acc + w.amount, 0);
        const totalInvested = resolvedBets.reduce((acc, b) => acc + b.value, 0);
        const currentBankroll = state.initialBankroll + totalProfitLoss - totalWithdrawn;
        
        const roi = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;
        const winRate = resolvedBets.length > 0 ? (wonBets.length / resolvedBets.length) * 100 : 0;
        const averageOdd = wonBets.length > 0 ? wonBets.reduce((acc, b) => acc + b.odd, 0) / wonBets.length : 0;
        
        const teamRegex = /(.+?)\s*(?:vs|x)\s*(.+)/i;
        const cleanHandicap = (teamName: string) => teamName.replace(/\s*[-+]\d+(\.\d+)?$/, '').trim().split('|')[0].trim();
        
        const teamsByMarket: Record<string, Set<string>> = {};

        state.bets.forEach(bet => {
            if (!bet.details) return;

            if (!teamsByMarket[bet.market]) {
                teamsByMarket[bet.market] = new Set();
            }

            const match = bet.details.match(teamRegex);
            const teams = match ? [cleanHandicap(match[1]), cleanHandicap(match[2])] : [bet.details.trim()];
            teams.forEach(team => {
                if (team && !state.blacklistedTeams?.includes(team)) {
                    teamsByMarket[bet.market].add(team);
                }
            });
        });

        const existingTeams: Record<string, string[]> = {};
        for (const market in teamsByMarket) {
            existingTeams[market] = Array.from(teamsByMarket[market]).sort();
        }

        let peak = -Infinity;
        let maxDrawdownValue = 0;
        bankrollHistory.forEach(point => {
            if (point.value > peak) {
                peak = point.value;
            }
            const drawdown = peak > 0 ? (peak - point.value) / peak : 0;
            if (drawdown > maxDrawdownValue) {
                maxDrawdownValue = drawdown;
            }
        });

        return {
            initialBankroll: state.initialBankroll,
            currentBankroll: parseFloat(currentBankroll.toFixed(2)),
            totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
            resolvedBetsCount: resolvedBets.length,
            wonBetsCount: wonBets.length,
            roi,
            winRate,
            averageOdd,
            existingTeams,
            totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
            totalInvested: parseFloat(totalInvested.toFixed(2)),
            maxDrawdown: maxDrawdownValue * 100,
        };
    }, [state.bets, state.initialBankroll, state.blacklistedTeams, state.withdrawals, bankrollHistory]);

    const chartsData = useMemo<ChartsData>(() => {
        const resolvedBets = state.bets.filter(b => b.status !== BetStatus.PENDING);

        // --- Performance by Market Calculation (Filtered) ---
        const performanceBets = resolvedBets.filter(bet => {
            const betDate = new Date(bet.date);
            const year = betDate.getFullYear();
            const month = betDate.getMonth(); // 0 = Jan, 8 = Sep
            return year === filterYear && month >= 0 && month <= 8;
        });

        const performanceMap: { [key: string]: { profit: number, invested: number, betsCount: number } } = {};
        performanceBets.forEach(bet => {
                const updateMarket = (name: string) => {
                    if (!performanceMap[name]) {
                        performanceMap[name] = { profit: 0, invested: 0, betsCount: 0 };
                    }
                    performanceMap[name].profit += bet.profitLoss;
                    performanceMap[name].invested += bet.value;
                    performanceMap[name].betsCount += 1;
                };

                const marketName = bet.market === Market.LOL ? 'League of Legends' : bet.market;
                updateMarket(marketName);

                if (bet.market === Market.LOL && bet.league && bet.league.trim() && bet.league !== 'N/A') {
                    if (Object.values(LolLeague).includes(bet.league as LolLeague)) {
                        updateMarket(bet.league);
                    }
                }
            });
        
        const performanceByMarket: MarketPerformancePoint[] = Object.entries(performanceMap)
            .map(([name, data]) => ({ 
                name, 
                profit: parseFloat(data.profit.toFixed(2)),
                invested: parseFloat(data.invested.toFixed(2)),
                betsCount: data.betsCount 
            }))
            .filter(item => item.invested > 0.01 && item.name)
            .sort((a,b) => b.profit - a.profit);


        // --- Daily Profit Calculation (Filtered by year) ---
        const dailyProfitMap: { [key: string]: { profit: number; count: number; profitUnits: number; } } = {};
        const calendarBets = resolvedBets.filter(bet => new Date(bet.date).getFullYear() === filterYear);
        
        calendarBets.forEach(bet => {
            const date = getLocalYYYYMMDD(bet.date);
            if (!dailyProfitMap[date]) {
                dailyProfitMap[date] = { profit: 0, count: 0, profitUnits: 0 };
            }
            dailyProfitMap[date].profit += bet.profitLoss;
            dailyProfitMap[date].count += 1;

            if (bet.status === BetStatus.WON) {
                dailyProfitMap[date].profitUnits += bet.units * (bet.odd - 1);
            } else if (bet.status === BetStatus.LOST) {
                dailyProfitMap[date].profitUnits -= bet.units;
            }
        });

        const dailyProfit: DailyProfitPoint[] = Object.entries(dailyProfitMap).map(([date, data]) => ({
            date,
            profit: data.profit,
            profitUnits: data.profitUnits,
            count: data.count,
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


        return { bankrollHistory, performanceByMarket, dailyProfit };
    }, [state.bets, bankrollHistory, filterYear]);

    return {
        state,
        addBet,
        deleteBet,
        updateBet,
        updateBetStatus,
        setInitialBankroll,
        importData,
        exportData,
        clearData,
        deleteTeamSuggestion,
        addWithdrawal,
        stats,
        chartsData,
        availableMarkets,
    };
};