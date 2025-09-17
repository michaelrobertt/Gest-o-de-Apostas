import React from 'react';
import { useBankroll } from './hooks/useBankroll';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import BankrollChart from './components/BankrollChart';
import PerformanceChart from './components/PerformanceChart';
import BetForm from './components/BetForm';
import AIAssistant from './components/AIAssistant';
import BetHistory from './components/BetHistory';
import { Toaster, toast } from 'react-hot-toast';

const App: React.FC = () => {
    const {
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
    } = useBankroll();

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
                    <StatsCards stats={stats} onSetInitialBankroll={setInitialBankroll} onAddWithdrawal={addWithdrawal} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <BankrollChart data={chartsData.bankrollHistory} />
                    <PerformanceChart data={chartsData.performanceByMarket} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <BetForm
                            currentBankroll={stats.currentBankroll}
                            addBet={addBet}
                            existingTeams={stats.existingTeams}
                            deleteTeamSuggestion={deleteTeamSuggestion}
                        />
                    </div>
                    <AIAssistant
                        bets={state.bets}
                        stats={stats}
                        performanceByMarket={chartsData.performanceByMarket}
                        onAddWithdrawal={addWithdrawal}
                    />
                </div>
                
                <BetHistory
                    bets={state.bets}
                    onDelete={deleteBet}
                    onUpdateStatus={updateBetStatus}
                    onUpdateBet={updateBet}
                />
            </main>
        </div>
    );
};

export default App;