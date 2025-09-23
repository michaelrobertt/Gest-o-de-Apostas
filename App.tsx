import React, { useState, useMemo } from 'react';
import { useBankroll } from './hooks/useBankroll';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import BankrollChart from './components/BankrollChart';
import PerformanceChart from './components/PerformanceChart';
import ProfitCalendar from './components/ProfitCalendar';
import BetForm from './components/BetForm';
import AIAssistant from './components/AIAssistant';
import BetHistory from './components/BetHistory';
import { Toaster, toast } from 'react-hot-toast';

const App: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const {
        state,
        addBet,
        addBetsFromImage,
        deleteBet,
        updateBet,
        updateBetStatus,
        setInitialBankroll,
        setBankrollGoal,
        importData,
        exportData,
        clearData,
        deleteTeamSuggestion,
        addWithdrawal,
        reorganizeBets,
        stats,
        chartsData,
        availableMarkets,
    } = useBankroll(selectedYear);

    const availableYears = useMemo(() => {
        const years = new Set(state.bets.map(bet => new Date(bet.date).getFullYear()));
        if (years.size === 0) {
            return [new Date().getFullYear()];
        }
        // FIX: Explicitly type the sort callback parameters to ensure they are treated as numbers.
        return Array.from(years).sort((a: number, b: number) => b - a); // Descending order
    }, [state.bets]);

    const handleDataAction = (action: () => Promise<string | void>) => {
        toast.promise(
            action(),
            {
                loading: 'Processando...',
                success: (message) => message || 'Operação concluída com sucesso!',
                error: (err) => err.toString(),
            }
        );
    };

    return (
        <div className="min-h-screen bg-brand-bg text-brand-text-primary font-sans">
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#1e1e1e',
                        color: '#e0e0e0',
                        border: '1px solid #2c2c2c'
                    },
                }}
            />
            <Header
                onImport={(file) => handleDataAction(() => importData(file))}
                onExport={() => handleDataAction(exportData)}
                onClear={() => handleDataAction(clearData)}
            />
            <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold text-brand-text-primary">Visão Geral da Banca</h1>
                    <StatsCards stats={stats} onSetInitialBankroll={setInitialBankroll} onAddWithdrawal={addWithdrawal} onSetBankrollGoal={setBankrollGoal} />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Main content area for charts and history */}
                    <div className="lg:col-span-2 space-y-8">
                        <div>
                            <h2 className="text-xl font-bold text-brand-text-primary mb-4">Análise de Performance</h2>
                            <div className="space-y-8">
                                <BankrollChart data={chartsData.bankrollHistory} />
                                <PerformanceChart
                                    data={chartsData.performanceByMarket}
                                    availableYears={availableYears}
                                    selectedYear={selectedYear}
                                    onYearChange={setSelectedYear}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-brand-text-primary">Atividade Diária de Apostas</h2>
                            <ProfitCalendar
                                data={chartsData.dailyProfit}
                                availableYears={availableYears}
                                selectedYear={selectedYear}
                                onYearChange={setSelectedYear}
                            />
                        </div>
                        
                        <BetHistory
                            bets={state.bets}
                            onDelete={deleteBet}
                            onUpdateStatus={updateBetStatus}
                            onUpdateBet={updateBet}
                        />
                    </div>

                    {/* Sticky sidebar for actions */}
                    <div className="lg:col-span-1 space-y-8 lg:sticky top-8">
                        <AIAssistant
                            bets={state.bets}
                            withdrawals={state.withdrawals || []}
                            stats={stats}
                            performanceByMarket={chartsData.performanceByMarket}
                            onAddWithdrawal={addWithdrawal}
                            onReorganize={reorganizeBets}
                        />
                         <BetForm
                            currentBankroll={stats.currentBankroll}
                            addBet={addBet}
                            addBetsFromImage={addBetsFromImage}
                            existingTeams={stats.existingTeams}
                            deleteTeamSuggestion={deleteTeamSuggestion}
                            availableMarkets={availableMarkets}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;