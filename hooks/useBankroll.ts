import { useState, useEffect, useMemo, useCallback } from 'react';
import { Bet, BankrollData, BetStatus, Stats, ChartsData, Market, LolLeague, Withdrawal } from '../types';

const LOCAL_STORAGE_KEY = 'betting-tracker-data';

const defaultState: BankrollData = {
    bets: [],
    initialBankroll: 100,
    blacklistedTeams: [],
    withdrawals: [],
};

export const useBankroll = () => {
    const [state, setState] = useState<BankrollData>(() => {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                const parsed = JSON.parse(storedData);
                // Ensure optional fields exist for backwards compatibility
                return { ...defaultState, ...parsed, blacklistedTeams: parsed.blacklistedTeams || [], withdrawals: parsed.withdrawals || [] };
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
            const bet: Bet = {
                ...newBet,
                id: new Date().toISOString() + Math.random(),
                date: new Date().toISOString(),
                status: BetStatus.PENDING,
                profitLoss: 0,
            };
            const sortedBets = [...prevState.bets, bet].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

    const updateBet = useCallback((betId: string, updatedBet: Bet) => {
        setState(prevState => {
            const newBets = prevState.bets.map(bet => {
                if (bet.id === betId) {
                    let profitLoss = 0;
                    const value = Number(updatedBet.value);
                    const odd = Number(updatedBet.odd);

                    if (updatedBet.status === BetStatus.WON) {
                        profitLoss = value * (odd - 1);
                    } else if (updatedBet.status === BetStatus.LOST) {
                        profitLoss = -value;
                    }
                    return { ...updatedBet, profitLoss, value, odd, units: Number(updatedBet.units) };
                }
                return bet;
            });
            const sortedBets = newBets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return { ...prevState, bets: sortedBets };
        });
    }, []);

    const updateBetStatus = useCallback((betId: string, newStatus: BetStatus.WON | BetStatus.LOST) => {
        setState(prevState => ({
            ...prevState,
            bets: prevState.bets.map(bet => {
                if (bet.id === betId) {
                    const profitLoss = newStatus === BetStatus.WON ? bet.value * (bet.odd - 1) : -bet.value;
                    return { ...bet, status: newStatus, profitLoss };
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

                    if (!data.bets || typeof data.initialBankroll === 'undefined') {
                        throw new Error("Arquivo JSON inválido ou mal formatado.");
                    }

                    const validatedBets = (data.bets as any[]).map((b): Bet => {
                        let status: BetStatus;
                        switch (b.status) {
                            case 'Vitória':
                            case BetStatus.WON:
                                status = BetStatus.WON;
                                break;
                            case 'Derrota':
                            case BetStatus.LOST:
                                status = BetStatus.LOST;
                                break;
                            case 'Pendente':
                            case BetStatus.PENDING:
                                status = BetStatus.PENDING;
                                break;
                            default:
                                status = BetStatus.PENDING;
                        }
                        
                        const value = b.value ?? b.stake ?? 0;
                        const odd = b.odd ?? 1;
                        let profitLoss = b.profitLoss ?? b.profit;

                        if (profitLoss === undefined && status !== BetStatus.PENDING) {
                            if (status === BetStatus.WON) {
                                profitLoss = value * (odd - 1);
                            } else if (status === BetStatus.LOST) {
                                profitLoss = -value;
                            }
                        }

                        const validatedBet: Bet = {
                            id: b.id || new Date().toISOString() + Math.random(),
                            date: b.date || new Date().toISOString(),
                            market: b.market || Market.LOL,
                            league: b.league || b.context || 'N/A',
                            betType: b.betType || 'N/A',
                            details: b.details || b.betDetail || '',
                            units: b.units || 0,
                            value: value,
                            odd: odd,
                            status: status,
                            profitLoss: profitLoss ?? 0,
                        };

                        return validatedBet;
                    });
                    
                    const sortedBets = validatedBets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    setState({ 
                        initialBankroll: data.initialBankroll, 
                        bets: sortedBets,
                        blacklistedTeams: data.blacklistedTeams || [],
                        withdrawals: data.withdrawals || [],
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

    const stats = useMemo<Stats>(() => {
        const resolvedBets = state.bets.filter(b => b.status !== BetStatus.PENDING);
        const wonBets = resolvedBets.filter(b => b.status === BetStatus.WON);
        
        const totalProfitLoss = resolvedBets.reduce((acc, b) => acc + b.profitLoss, 0);
        const totalWithdrawn = (state.withdrawals || []).reduce((acc, w) => acc + w.amount, 0);
        const currentBankroll = state.initialBankroll + totalProfitLoss - totalWithdrawn;
        const totalInvested = resolvedBets.reduce((acc, b) => acc + b.value, 0);
        
        const roi = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;
        const winRate = resolvedBets.length > 0 ? (wonBets.length / resolvedBets.length) * 100 : 0;
        const averageOdd = wonBets.length > 0 ? wonBets.reduce((acc, b) => acc + b.odd, 0) / wonBets.length : 0;
        
        const teamRegex = /(.+?)\s*(?:vs|x)\s*(.+)/i;
        const cleanHandicap = (teamName: string) => teamName.replace(/\s*[-+]\d+(\.\d+)?$/, '').trim();
        
        const teamsByMarket: Record<Market, Set<string>> = {
            [Market.LOL]: new Set(),
            [Market.CS2]: new Set(),
            [Market.SOCCER]: new Set()
        };

        state.bets.forEach(bet => {
            if (!bet.details) return;
            const match = bet.details.match(teamRegex);
            const teams = match ? [cleanHandicap(match[1]), cleanHandicap(match[2])] : [bet.details.trim()];
            teams.forEach(team => {
                if (team && !state.blacklistedTeams?.includes(team)) {
                    teamsByMarket[bet.market].add(team);
                }
            });
        });

        const existingTeams: Record<Market, string[]> = {
            [Market.LOL]: Array.from(teamsByMarket[Market.LOL]).sort(),
            [Market.CS2]: Array.from(teamsByMarket[Market.CS2]).sort(),
            [Market.SOCCER]: Array.from(teamsByMarket[Market.SOCCER]).sort(),
        };

        return {
            initialBankroll: state.initialBankroll,
            currentBankroll,
            totalProfitLoss,
            resolvedBetsCount: resolvedBets.length,
            wonBetsCount: wonBets.length,
            roi,
            winRate,
            averageOdd,
            existingTeams,
            totalWithdrawn,
        };
    }, [state.bets, state.initialBankroll, state.blacklistedTeams, state.withdrawals]);

    const chartsData = useMemo<ChartsData>(() => {
        const resolvedBetsSorted = state.bets
            .filter(b => b.status !== BetStatus.PENDING)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let cumulativeBankroll = state.initialBankroll;
        const bankrollHistory = [{ date: 'Início', value: state.initialBankroll }];
        resolvedBetsSorted.forEach(bet => {
            cumulativeBankroll += bet.profitLoss;
            bankrollHistory.push({
                date: new Date(bet.date).toLocaleDateString('pt-BR'),
                value: cumulativeBankroll,
            });
        });

        const performanceMap: { [key: string]: number } = {};
        state.bets
            .filter(b => b.status !== BetStatus.PENDING)
            .forEach(bet => {
                // Always aggregate by Market
                performanceMap[bet.market] = (performanceMap[bet.market] || 0) + bet.profitLoss;

                // If it's a LoL bet and has a specific league, also aggregate by that league
                if (bet.market === Market.LOL && bet.league && bet.league !== 'N/A') {
                    if (Object.values(LolLeague).includes(bet.league as LolLeague)) {
                        performanceMap[bet.league] = (performanceMap[bet.league] || 0) + bet.profitLoss;
                    }
                }
            });

        const performanceByMarket = Object.entries(performanceMap)
            .map(([name, profit]) => ({ name, profit }))
            .filter(item => Math.abs(item.profit) > 0.01); // Filter out zero or negligible profits

        return { bankrollHistory, performanceByMarket };
    }, [state.bets, state.initialBankroll]);

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
        chartsData
    };
};