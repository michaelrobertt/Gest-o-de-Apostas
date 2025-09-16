import React, { useState, useEffect, useCallback } from 'react';
import { Bet, BetStatus, Stats, MarketPerformancePoint, AIRecommendation } from '../types';
import { getAIRecommendation } from '../services/geminiService';
import { AlertTriangleIcon, SparklesIcon, RefreshCwIcon } from './icons';

interface AIAssistantProps {
    bets: Bet[];
    stats: Stats;
    performanceByMarket: MarketPerformancePoint[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ bets, stats, performanceByMarket }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AIRecommendation | null>(null);

    const resolvedBets = bets.filter(b => b.status !== BetStatus.PENDING);

    const fetchRecommendation = useCallback(async () => {
        if (resolvedBets.length < 5) {
            setResult(null);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const recommendation = await getAIRecommendation(bets, stats, performanceByMarket);
            setResult(recommendation);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ocorreu um erro na IA.");
        } finally {
            setLoading(false);
        }
    }, [bets, stats, performanceByMarket, resolvedBets.length]);
    
    useEffect(() => {
        fetchRecommendation();
    }, [fetchRecommendation]);

    const getAlertColor = (level: 'Baixo' | 'Médio' | 'Alto' | 'Nenhum') => {
        switch (level) {
            case 'Alto': return 'bg-red-900/50 border-brand-danger text-red-300';
            case 'Médio': return 'bg-yellow-900/50 border-yellow-500 text-yellow-300';
            case 'Baixo': return 'bg-blue-900/50 border-blue-500 text-blue-300';
            default: return '';
        }
    };

    const renderContent = () => {
        if (resolvedBets.length < 5) {
            return (
                <div className="text-center text-brand-text-secondary p-4">
                    <p>A IA precisa de pelo menos 5 apostas resolvidas para fornecer uma análise.</p>
                </div>
            );
        }

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
                    <button
                        onClick={fetchRecommendation}
                        className="w-full mt-4 bg-brand-border text-brand-text-primary font-bold py-2 rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        <RefreshCwIcon className="w-4 h-4" /> Tentar Novamente
                    </button>
                </div>
            );
        }

        if (result) {
            return (
                <div className="space-y-4 p-4">
                    {result.riskAlert && result.riskAlert.level !== 'Nenhum' && (
                        <div className={`p-3 rounded-md border ${getAlertColor(result.riskAlert.level)}`}>
                            <h4 className="font-bold flex items-center gap-2">
                                <AlertTriangleIcon className="w-5 h-5"/>
                                Alerta de Risco: {result.riskAlert.level}
                            </h4>
                            <p className="text-sm mt-1">{result.riskAlert.message}</p>
                        </div>
                    )}
                    <div>
                        <h4 className="font-bold text-brand-primary">{result.recommendationTitle}</h4>
                        <p className="text-sm text-brand-text-secondary mt-1">{result.analysisSummary}</p>
                    </div>
                     <div>
                        <h4 className="font-bold text-brand-primary">Conselho Estratégico</h4>
                        <p className="text-sm text-brand-text-secondary mt-1">{result.strategicAdvice}</p>
                    </div>
                     <button
                        onClick={fetchRecommendation}
                        className="w-full mt-2 bg-brand-border text-brand-text-primary font-bold py-2 rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Reanalisar
                    </button>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="bg-brand-surface rounded-lg border border-brand-border sticky top-8">
            <h3 className="text-lg font-semibold p-4 border-b border-brand-border flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-brand-primary" />
                Assistente de Banca IA
            </h3>
            {renderContent()}
        </div>
    );
};

export default AIAssistant;
