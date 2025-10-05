import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Bet, Stats, AILeverageSuggestion } from '../types';
import { getAILeverageSuggestion } from '../services/geminiService';
import { LightBulbIcon, RefreshCwIcon, ShieldCheckIcon, TargetIcon, PercentIcon, BanknotesIcon } from './icons';

interface AILeverageAssistantProps {
    bets: Bet[];
    stats: Stats;
}

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-brand-bg p-3 rounded-md border border-brand-border/50">
        <h5 className="font-bold text-brand-text-primary flex items-center gap-2 mb-2">
            {icon} {title}
        </h5>
        <div className="text-sm text-brand-text-secondary space-y-1">{children}</div>
    </div>
);

const AILeverageAssistant: React.FC<AILeverageAssistantProps> = ({ bets, stats }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<AILeverageSuggestion | null>(null);

    const handleAnalysisClick = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await getAILeverageSuggestion(stats, bets);
            setSuggestion(result);
            toast.success('Estratégia de alavancagem gerada!');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro na IA.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [stats, bets]);

    const getProfileColor = (profile: AILeverageSuggestion['profile']) => {
        switch (profile) {
            case 'Agressivo': return 'bg-brand-danger/20 text-brand-danger border-brand-danger/50';
            case 'Moderado': return 'bg-brand-yellow/20 text-brand-yellow border-brand-yellow/50';
            case 'Conservador': return 'bg-brand-primary/20 text-brand-primary border-brand-primary/50';
            case 'Recuperação': return 'bg-brand-blue/20 text-brand-blue border-brand-blue/50';
            default: return 'bg-brand-border text-brand-text-secondary';
        }
    };

    const renderBody = () => {
        if (!suggestion) {
            return (
                <div className="text-center text-brand-text-secondary p-4 flex-grow flex items-center justify-center">
                    <p>Clique para gerar uma estratégia de alavancagem personalizada com base no status atual da sua banca.</p>
                </div>
            );
        }

        return (
            <div className="p-4 space-y-4">
                <div className={`p-3 rounded-lg border text-center ${getProfileColor(suggestion.profile)}`}>
                    <p className="font-bold text-sm">Seu Perfil Atual</p>
                    <p className="text-xl font-bold">{suggestion.profile}</p>
                    <p className="text-xs mt-1">{suggestion.profileReasoning}</p>
                </div>
                
                <div className="space-y-3">
                     <InfoCard icon={<ShieldCheckIcon className="w-5 h-5 text-brand-blue" />} title={suggestion.protectionAdvice.title}>
                        <p>{suggestion.protectionAdvice.description}</p>
                    </InfoCard>
                    
                    <InfoCard icon={<LightBulbIcon className="w-5 h-5 text-brand-yellow" />} title={suggestion.leverageStrategy.title}>
                        <p>{suggestion.leverageStrategy.description}</p>
                    </InfoCard>

                    <InfoCard icon={<PercentIcon className="w-5 h-5 text-brand-indigo" />} title="Stake Sugerido">
                        <p className="font-bold text-brand-indigo text-lg">{suggestion.suggestedStake.bankrollPercentage}% da banca ({suggestion.suggestedStake.units.toFixed(2)}U)</p>
                        <p>{suggestion.suggestedStake.reasoning}</p>
                    </InfoCard>

                    <InfoCard icon={<TargetIcon className="w-5 h-5 text-brand-teal" />} title="Range de Odds Ideal">
                         <p className="font-bold text-brand-teal text-lg">@{suggestion.optimalOddRange.min.toFixed(2)} - @{suggestion.optimalOddRange.max.toFixed(2)}</p>
                        <p>{suggestion.optimalOddRange.reasoning}</p>
                    </InfoCard>
                    
                    <InfoCard icon={<BanknotesIcon className="w-5 h-5 text-brand-primary" />} title={suggestion.profitManagement.title}>
                        <p>{suggestion.profitManagement.description}</p>
                    </InfoCard>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-brand-surface rounded-lg border border-brand-border flex flex-col">
            <h3 className="text-lg font-semibold p-4 border-b border-brand-border flex items-center gap-2">
                <LightBulbIcon className="w-5 h-5 text-brand-yellow" />
                Estrategista de Alavancagem IA
            </h3>
            <div className="flex-grow min-h-[200px] flex flex-col">
                {renderBody()}
            </div>
            <div className="p-4 border-t border-brand-border">
                <button
                    onClick={handleAnalysisClick}
                    className="w-full bg-brand-primary text-white font-bold py-2 rounded-md hover:bg-brand-primary-hover transition-colors flex items-center justify-center gap-2 disabled:bg-brand-border disabled:text-brand-text-secondary disabled:cursor-not-allowed"
                    disabled={loading}
                >
                    <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Analisando...' : (suggestion ? 'Reanalisar Estratégia' : 'Gerar Estratégia')}
                </button>
            </div>
        </div>
    );
};

export default AILeverageAssistant;