import React, { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Bet, BetStatus, Stats, MarketPerformancePoint, AIRecommendation, AIWithdrawalSuggestion, Withdrawal } from '../types';
import { getAIRecommendation, getAIWithdrawalSuggestion } from '../services/geminiService';
import { AlertTriangleIcon, SparklesIcon, RefreshCwIcon, BanknotesIcon } from './icons';

interface AIAssistantProps {
    bets: Bet[];
    withdrawals: Withdrawal[];
    stats: Stats;
    performanceByMarket: MarketPerformancePoint[];
    onAddWithdrawal: (amount: number) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ bets, withdrawals, stats, performanceByMarket, onAddWithdrawal }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [betRecommendation, setBetRecommendation] = useState<AIRecommendation | null>(null);
    const [withdrawalSuggestion, setWithdrawalSuggestion] = useState<AIWithdrawalSuggestion | null>(null);

    const resolvedBetsCount = bets.filter(b => b.status !== BetStatus.PENDING).length;
    const canAnalyze = resolvedBetsCount >= 5;

    const fetchAnalysis = useCallback(async () => {
        if (!canAnalyze) {
            toast.error("A IA precisa de pelo menos 5 apostas resolvidas para uma análise significativa.");
            return;
        }

        setLoading(true);
        setError(null);
        setBetRecommendation(null); // Clear previous results
        setWithdrawalSuggestion(null);

        try {
            const [betRec, withdrawalSug] = await Promise.all([
                getAIRecommendation(bets, stats, performanceByMarket),
                getAIWithdrawalSuggestion(stats, withdrawals)
            ]);
            setBetRecommendation(betRec);
            setWithdrawalSuggestion(withdrawalSug);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro na IA.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [bets, stats, performanceByMarket, canAnalyze, withdrawals]);

    const handleWithdrawSuggested = () => {
        if(withdrawalSuggestion?.suggestedAmount) {
            onAddWithdrawal(withdrawalSuggestion.suggestedAmount);
            toast.success(`Saque de R$ ${withdrawalSuggestion.suggestedAmount.toFixed(2)} registrado!`);
            // Clear suggestion so user must re-analyze
            setWithdrawalSuggestion(null); 
        }
    };

    const getAlertColor = (level: 'Baixo' | 'Médio' | 'Alto' | 'Nenhum') => {
        switch (level) {
            case 'Alto': return 'bg-red-900/30 border-brand-danger text-red-300';
            case 'Médio': return 'bg-yellow-900/30 border-yellow-500 text-yellow-300';
            case 'Baixo': return 'bg-blue-900/30 border-blue-500 text-blue-300';
            default: return '';
        }
    };

    const renderBody = () => {
        if (loading) {
            return (
                <div className="text-center text-brand-text-secondary p-4 animate-pulse">
                    <p>IA analisando seu desempenho...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center text-red-400 p-4">
                    <p>{error}</p>
                </div>
            );
        }
        
        if (!betRecommendation) {
             return (
                <div className="text-center text-brand-text-secondary p-4">
                    <p>{canAnalyze ? 'Clique em "Analisar" para receber insights da IA sobre seu desempenho.' : 'A IA precisa de pelo menos 5 apostas resolvidas para fornecer uma análise.'}</p>
                </div>
            );
        }
        
        return (
            <div className="divide-y divide-brand-border">
                {/* Withdrawal Suggestion Section */}
                {withdrawalSuggestion && (
                    <div className="p-4 space-y-3">
                        <h4 className="font-bold text-brand-text-primary flex items-center gap-2">
                            <BanknotesIcon className="w-5 h-5 text-brand-primary" />
                            Consultor de Saque
                        </h4>
                        <p className="text-sm text-brand-text-secondary">{withdrawalSuggestion.reasoning}</p>
                        {withdrawalSuggestion.shouldWithdraw && (
                            <div className="bg-brand-bg p-3 rounded-md">
                                <p className="text-sm text-brand-text-secondary">Sugestão:</p>
                                <p className="text-lg font-bold text-brand-primary">Sacar R$ {(withdrawalSuggestion.suggestedAmount || 0).toFixed(2)}</p>
                                <button
                                    onClick={handleWithdrawSuggested}
                                    className="w-full mt-2 bg-brand-primary/80 text-white text-sm font-semibold py-2 rounded-md hover:bg-brand-primary transition-colors"
                                >
                                    Registrar Saque Sugerido
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Bet Recommendation Section */}
                <div className="space-y-4 p-4">
                        <h4 className="font-bold text-brand-text-primary flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-brand-primary" />
                        {betRecommendation.recommendationTitle}
                    </h4>
                    {betRecommendation.riskAlert && betRecommendation.riskAlert.level !== 'Nenhum' && (
                        <div className={`p-3 rounded-md border ${getAlertColor(betRecommendation.riskAlert.level)}`}>
                            <h5 className="font-bold flex items-center gap-2">
                                <AlertTriangleIcon className="w-5 h-5"/>
                                Alerta de Risco: {betRecommendation.riskAlert.level}
                            </h5>
                            <div className="text-sm mt-2 space-y-2">
                                {betRecommendation.riskAlert.message.split('\n').map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                        </div>
                    )}
                    {betRecommendation.riskAlert?.level === 'Nenhum' && (
                        <p className="text-sm text-brand-text-secondary mt-1">{betRecommendation.analysisSummary}</p>
                    )}
                    <div>
                        <h5 className="font-bold text-brand-primary mt-2">Conselho Estratégico</h5>
                        <p className="text-sm text-brand-text-secondary mt-1">{betRecommendation.strategicAdvice}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-brand-surface rounded-lg border border-brand-border flex flex-col">
            <h3 className="text-lg font-semibold p-4 border-b border-brand-border flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-brand-primary" />
                Assistente de Banca IA
            </h3>
            <div className="flex-grow min-h-[200px] flex flex-col justify-center">
                {renderBody()}
            </div>
             <div className="p-4 border-t border-brand-border">
                 <button
                    onClick={fetchAnalysis}
                    className="w-full bg-brand-primary text-white font-bold py-2 rounded-md hover:bg-brand-primary-hover transition-colors flex items-center justify-center gap-2 disabled:bg-brand-border disabled:text-brand-text-secondary disabled:cursor-not-allowed"
                    disabled={loading || !canAnalyze}
                >
                    <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 
                    {loading ? 'Analisando...' : (betRecommendation ? 'Reanalisar' : 'Analisar Desempenho')}
                </button>
            </div>
        </div>
    );
};

export default AIAssistant;