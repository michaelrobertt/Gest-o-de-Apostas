import { useState, useEffect, useMemo, useCallback } from 'react';
import { Bet, BankrollData, BetStatus, Stats, ChartsData, Market, LolLeague, Withdrawal, BankrollHistoryPoint, MarketPerformancePoint, DailyProfitPoint, BetSelection } from '../types';
import { reorganizeBetsWithAI } from '../services/geminiService';
import { UNIT_PERCENTAGE } from '../constants';

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
    const rawMarket = String(b.market || Market.SOCCER);

    return {
        id: String(b.id || `${new Date().toISOString()}-${Math.random()}`),
        date: String(b.date || new Date().toISOString()),
        market: rawMarket, // Normalization is now handled by a dedicated AI function
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

/**
 * Recalculates the 'units' for a given list of bets based on the historical bankroll.
 * This ensures unit consistency across the entire bet history.
 */
const recalculateUnitsForBets = (bets: Bet[], initialBankroll: number, withdrawals: Withdrawal[]): Bet[] => {
    // Create a single sorted list of all events that affect bankroll (resolved bets and withdrawals)
    const allResolvedEvents = [
        ...bets.filter(b => b.status !== BetStatus.PENDING).map(b => ({ type: 'bet' as const, data: b })),
        ...withdrawals.map(w => ({ type: 'withdrawal' as const, data: w }))
    ].sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());

    // Return a new array of bets with units recalculated for each one
    return bets.map(betToUpdate => {
        const betTimestamp = new Date(betToUpdate.date).getTime();

        // Find all resolved events that happened strictly *before* the current bet was placed
        const eventsBefore = allResolvedEvents.filter(e => new Date(e.data.date).getTime() < betTimestamp);

        // Calculate the bankroll value at that specific point in time
        let bankrollBeforeBet = initialBankroll;
        for (const event of eventsBefore) {
            if (event.type === 'bet') {
                bankrollBeforeBet += event.data.profitLoss;
            } else {
                bankrollBeforeBet -= event.data.amount;
            }
        }
        
        const unitValueInCurrency = bankrollBeforeBet * UNIT_PERCENTAGE;
        let newUnits = betToUpdate.units; // Default to existing value

        // Recalculate if possible and meaningful
        if (unitValueInCurrency > 0 && betToUpdate.value > 0) {
            newUnits = betToUpdate.value / unitValueInCurrency;
        } else if (betToUpdate.value > 0) {
            // Cannot calculate units as a percentage of a zero or negative bankroll
            newUnits = 0; 
        }

        return { ...betToUpdate, units: newUnits };
    });
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
            
            const allBetsCombined = [...prevState.bets, validatedBet];
            const betsWithCorrectUnits = recalculateUnitsForBets(
                allBetsCombined, 
                prevState.initialBankroll, 
                prevState.withdrawals || []
            );

            const sortedBets = betsWithCorrectUnits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return { ...prevState, bets: sortedBets };
        });
    }, []);

    const runAIReorganization = useCallback(async (betsToUpdate?: Bet[]): Promise<string> => {
        const betsToAnalyze = betsToUpdate || state.bets;
        if (betsToAnalyze.length === 0) {
            return "Nenhuma aposta para reorganizar.";
        }
        
        const updates = await reorganizeBetsWithAI(betsToAnalyze);
        
        if (updates.length === 0) {
            return "IA não encontrou nenhuma alteração para fazer.";
        }

        const updatesMap = new Map(updates.map(u => [u.id, { market: u.market, league: u.league }]));
        let updatedCount = 0;

        const updatedBets = betsToAnalyze.map(bet => {
            const update = updatesMap.get(bet.id);
            if (update && (bet.market !== update.market || bet.league !== update.league)) {
                updatedCount++;
                return { ...bet, market: update.market, league: update.league };
            }
            return bet;
        });

        setState(prevState => ({ ...prevState, bets: updatedBets }));
        
        return `Reorganização concluída! ${updatedCount} aposta(s) foram atualizadas pela IA.`;
    }, [state.bets]);

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
            const betExists = prevState.bets.some(b => b.id === betId);
            if (!betExists) {
                console.error("Bet to update not found");
                return prevState;
            }
            
            // First, apply the specific update for the bet being edited.
            const provisionallyUpdatedBets = prevState.bets.map(b => b.id === betId ? updatedBetData : b);

            // Now, recalculate units for the *entire* history to ensure consistency.
            const betsWithCorrectUnits = recalculateUnitsForBets(
                provisionallyUpdatedBets, 
                prevState.initialBankroll, 
                prevState.withdrawals || []
            );
            
            // Validate the specific bet that was changed after unit recalculation.
            const finalBet = betsWithCorrectUnits.find(b => b.id === betId);
            if (!finalBet || !validateBetData(finalBet)) {
                 console.error("Failed to update with invalid bet data after recalculation", finalBet);
                 return prevState; // Revert if validation fails
            }

            const sortedBets = betsWithCorrectUnits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return { ...prevState, bets: sortedBets };
        });
    }, []);


    const updateBetStatus = useCallback((betId: string, newStatus: BetStatus.WON | BetStatus.LOST) => {
        setState(prevState => {
            let updatedBet: Bet | undefined;
            const newBets = prevState.bets.map(bet => {
                if (bet.id === betId) {
                    const updatedBetWithStatus = {...bet, status: newStatus};
                    updatedBet = validateBetData(updatedBetWithStatus) || bet;
                    return updatedBet;
                }
                return bet;
            });

            if (!updatedBet) return prevState;

            // Recalculate all units because a status change affects historical bankroll for subsequent bets.
            const betsWithCorrectUnits = recalculateUnitsForBets(
                newBets,
                prevState.initialBankroll,
                prevState.withdrawals || []
            );

            return { ...prevState, bets: betsWithCorrectUnits };
        });
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

    const importData = useCallback(async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
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

                    const initialBankroll = Number(data.initialBankroll) || 0;

                    // Recalculate units for all imported bets to ensure consistency
                    const betsWithCorrectUnits = recalculateUnitsForBets(validatedBets, initialBankroll, validatedWithdrawals);
                    
                    // --- Automatic AI Reorganization on Import ---
                    const updates = await reorganizeBetsWithAI(betsWithCorrectUnits);
                    const updatesMap = new Map(updates.map(u => [u.id, { market: u.market, league: u.league }]));
                    const reorganizedBets = betsWithCorrectUnits.map(bet => {
                        const update = updatesMap.get(bet.id);
                        return update ? { ...bet, market: update.market, league: update.league } : bet;
                    });
                    // --- End of Reorganization ---

                    const sortedBets = reorganizedBets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    setState({ 
                        initialBankroll, 
                        bets: sortedBets,
                        blacklistedTeams: Array.isArray(data.blacklistedTeams) ? data.blacklistedTeams : [],
                        withdrawals: validatedWithdrawals,
                    });
                    resolve("Dados importados e otimizados com sucesso!");
                } catch (error) {
                    reject(`Falha ao importar: ${error instanceof Error ? error.message : String(error)}`);
                }
            };
            reader.onerror = () => reject("Erro ao ler o arquivo.");
            reader.readAsText(file);
        });
    }, []);

    const addBetsFromImage = useCallback(async (parsedBets: Partial<Bet>[]): Promise<string> => {
        const newValidatedBets = parsedBets.map(pBet => {
             const betToValidate = {
                ...pBet,
                id: new Date().toISOString() + Math.random(),
                date: new Date().toISOString(),
                status: BetStatus.PENDING,
                profitLoss: 0,
            };
            return validateBetData(betToValidate);
        }).filter((b): b is Bet => b !== null);

        if (newValidatedBets.length === 0) {
            return "Nenhuma aposta válida foi adicionada.";
        }

        // Create a snapshot of the current state to work with
        const currentBets = state.bets;
        const currentWithdrawals = state.withdrawals || [];
        const currentInitialBankroll = state.initialBankroll;
        
        // Combine new and existing bets
        const allBetsCombined = [...currentBets, ...newValidatedBets];

        // Recalculate units for the entire history, including the new bets
        const allBetsWithCorrectUnits = recalculateUnitsForBets(allBetsCombined, currentInitialBankroll, currentWithdrawals);

        // Now, run the AI reorganization on this corrected data. 
        // `runAIReorganization` will then take this array as its base and set the final state.
        await runAIReorganization(allBetsWithCorrectUnits);

        return `${newValidatedBets.length} aposta(s) adicionada(s) e todo o histórico foi otimizado.`;
    }, [state.bets, state.initialBankroll, state.withdrawals, runAIReorganization]);


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

                const marketName = bet.market;
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
        addBetsFromImage,
        deleteBet,
        updateBet,
        updateBetStatus,
        setInitialBankroll,
        importData,
        exportData,
        clearData,
        deleteTeamSuggestion,
        addWithdrawal,
        reorganizeBets: runAIReorganization, // Expose for AI Assistant
        stats,
        chartsData,
        availableMarkets,
    };
};