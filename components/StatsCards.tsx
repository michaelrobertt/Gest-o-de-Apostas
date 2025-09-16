
import React, { useState } from 'react';
import { Stats } from '../types';
import Modal from './Modal';
import { ArrowUpIcon, ArrowDownIcon, PencilIcon, CheckIcon, XIcon, TrendingUpIcon, ScaleIcon, CalculatorIcon } from './icons';


interface StatCardProps {
    title: string;
    value: string;
    description: string;
    icon: React.ReactNode;
    colorClass?: string;
    onClick?: () => void;
    isEditable?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description, icon, colorClass = 'text-brand-text-primary', onClick, isEditable }) => (
    <div
        className={`bg-brand-surface p-4 rounded-lg border border-brand-border flex items-start justify-between relative ${isEditable ? 'cursor-pointer hover:border-brand-primary/50' : ''}`}
        onClick={onClick}
    >
        <div>
            <p className="text-sm text-brand-text-secondary font-medium">{title}</p>
            <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
            <p className="text-xs text-brand-text-secondary mt-1">{description}</p>
        </div>
        <div className="bg-brand-border p-2 rounded-full">
            {icon}
        </div>
        {isEditable && <PencilIcon className="w-3 h-3 text-brand-text-secondary absolute top-2 right-2" />}
    </div>
);

interface StatsCardsProps {
    stats: Stats;
    onSetInitialBankroll: (amount: number) => void;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, onSetInitialBankroll }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newBankroll, setNewBankroll] = useState(stats.initialBankroll.toString());

    const handleSaveBankroll = () => {
        const amount = parseFloat(newBankroll);
        if (!isNaN(amount) && amount > 0) {
            onSetInitialBankroll(amount);
            setIsModalOpen(false);
        }
    };
    
    const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

    const profitColor = stats.totalProfitLoss > 0 ? 'text-brand-win' : stats.totalProfitLoss < 0 ? 'text-brand-loss' : 'text-brand-text-primary';
    const profitIcon = stats.totalProfitLoss > 0 ? <ArrowUpIcon className="w-5 h-5 text-brand-win" /> : <ArrowDownIcon className="w-5 h-5 text-brand-loss" />;

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    title="Banca Inicial"
                    value={formatCurrency(stats.initialBankroll)}
                    description="Clique para editar"
                    icon={<ScaleIcon className="w-5 h-5 text-brand-text-secondary" />}
                    onClick={() => setIsModalOpen(true)}
                    isEditable
                />
                <StatCard
                    title="Banca Atual"
                    value={formatCurrency(stats.currentBankroll)}
                    description="Atualizado após cada aposta"
                    icon={<TrendingUpIcon className="w-5 h-5 text-brand-text-secondary" />}
                />
                <StatCard
                    title="Lucro/Prejuízo Total"
                    value={formatCurrency(stats.totalProfitLoss)}
                    description={`${stats.wonBetsCount}V / ${stats.resolvedBetsCount - stats.wonBetsCount}D / ${stats.resolvedBetsCount}T Apostas resolvidas.`}
                    icon={profitIcon}
                    colorClass={profitColor}
                />
                 <StatCard
                    title="ROI (Retorno)"
                    value={`${stats.roi.toFixed(2)}%`}
                    description="Sobre o total investido."
                    icon={<TrendingUpIcon className="w-5 h-5 text-brand-text-secondary"/>}
                    colorClass={stats.roi > 0 ? 'text-brand-win' : 'text-brand-loss'}
                />
                 <StatCard
                    title="Taxa de Acerto"
                    value={`${stats.winRate.toFixed(2)}%`}
                    description={`${stats.wonBetsCount} vitórias em ${stats.resolvedBetsCount} apostas.`}
                    icon={<CheckIcon className="w-5 h-5 text-brand-text-secondary"/>}
                />
                <StatCard
                    title="Odd Média"
                    value={`@${stats.averageOdd.toFixed(2)}`}
                    description="Média das apostas resolvidas."
                    icon={<CalculatorIcon className="w-5 h-5 text-brand-text-secondary"/>}
                />

            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <h2 className="text-lg font-bold mb-4">Editar Banca Inicial</h2>
                <div className="flex flex-col gap-4">
                    <label htmlFor="initialBankroll" className="text-sm text-brand-text-secondary">
                        Valor da banca inicial (R$)
                    </label>
                    <input
                        type="number"
                        id="initialBankroll"
                        value={newBankroll}
                        onChange={(e) => setNewBankroll(e.target.value)}
                        className="bg-brand-surface border border-brand-border rounded-md p-2 w-full focus:ring-1 focus:ring-brand-primary focus:outline-none"
                        placeholder="Ex: 100.00"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-md bg-brand-border hover:bg-gray-600 transition-colors">
                            <XIcon className="w-5 h-5" />
                        </button>
                        <button onClick={handleSaveBankroll} className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-primary-hover transition-colors flex items-center gap-2">
                            <CheckIcon className="w-5 h-5" /> Salvar
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default StatsCards;
