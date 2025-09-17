import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Stats } from '../types';
import Modal from './Modal';
import { ArrowUpIcon, ArrowDownIcon, PencilIcon, CheckIcon, XIcon, TrendingUpIcon, ScaleIcon, CalculatorIcon, BanknotesIcon } from './icons';


interface StatCardProps {
    title: string;
    value: string;
    description: string;
    icon: React.ReactNode;
    colorClass?: string;
    onClick?: () => void;
    isEditable?: boolean;
    actionButton?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description, icon, colorClass = 'text-brand-text-primary', onClick, isEditable, actionButton }) => (
    <div
        className={`bg-brand-surface p-4 rounded-lg border border-brand-border flex items-start justify-between relative ${onClick ? 'cursor-pointer hover:border-brand-primary/50' : ''}`}
        onClick={onClick}
    >
        <div>
            <p className="text-sm text-brand-text-secondary font-medium">{title}</p>
            <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
            <p className="text-xs text-brand-text-secondary mt-1">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className="bg-brand-border p-2 rounded-full">
                {icon}
            </div>
            {actionButton}
        </div>
        {isEditable && <PencilIcon className="w-3 h-3 text-brand-text-secondary absolute top-2 right-2" />}
    </div>
);

interface StatsCardsProps {
    stats: Stats;
    onSetInitialBankroll: (amount: number) => void;
    onAddWithdrawal: (amount: number) => void;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, onSetInitialBankroll, onAddWithdrawal }) => {
    const [isBankrollModalOpen, setIsBankrollModalOpen] = useState(false);
    const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
    
    const [newBankroll, setNewBankroll] = useState(stats.initialBankroll.toString());
    const [withdrawalAmount, setWithdrawalAmount] = useState('');

    const handleSaveBankroll = () => {
        const amount = parseFloat(newBankroll);
        if (!isNaN(amount) && amount > 0) {
            onSetInitialBankroll(amount);
            setIsBankrollModalOpen(false);
        } else {
            toast.error("Por favor, insira um valor válido.");
        }
    };

    const handleAddWithdrawal = () => {
        const amount = parseFloat(withdrawalAmount);
        if (!isNaN(amount) && amount > 0) {
            if (amount > stats.currentBankroll) {
                toast.error("O valor do saque não pode ser maior que a banca atual.");
                return;
            }
            onAddWithdrawal(amount);
            setIsWithdrawalModalOpen(false);
            setWithdrawalAmount('');
            toast.success("Saque registrado com sucesso!");
        } else {
            toast.error("Por favor, insira um valor de saque válido.");
        }
    };
    
    const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

    const profitColor = stats.totalProfitLoss > 0 ? 'text-brand-win' : stats.totalProfitLoss < 0 ? 'text-brand-loss' : 'text-brand-text-primary';
    const profitIcon = stats.totalProfitLoss > 0 ? <ArrowUpIcon className="w-5 h-5 text-brand-win" /> : <ArrowDownIcon className="w-5 h-5 text-brand-loss" />;

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Banca Inicial"
                    value={formatCurrency(stats.initialBankroll)}
                    description="Clique para editar"
                    icon={<ScaleIcon className="w-5 h-5 text-brand-text-secondary" />}
                    onClick={() => setIsBankrollModalOpen(true)}
                    isEditable
                />
                <StatCard
                    title="Banca Atual"
                    value={formatCurrency(stats.currentBankroll)}
                    description="Capital de giro disponível"
                    icon={<TrendingUpIcon className="w-5 h-5 text-brand-text-secondary" />}
                    actionButton={
                        <button onClick={() => setIsWithdrawalModalOpen(true)} className="text-xs bg-brand-primary/20 text-brand-primary px-2 py-1 rounded hover:bg-brand-primary/40">
                            Sacar
                        </button>
                    }
                />
                 <StatCard
                    title="Total Sacado"
                    value={formatCurrency(stats.totalWithdrawn)}
                    description="Lucros realizados"
                    icon={<BanknotesIcon className="w-5 h-5 text-brand-text-secondary" />}
                />
                <StatCard
                    title="Lucro/Prejuízo Total"
                    value={formatCurrency(stats.totalProfitLoss)}
                    description={`${stats.wonBetsCount}V / ${stats.resolvedBetsCount - stats.wonBetsCount}D`}
                    icon={profitIcon}
                    colorClass={profitColor}
                />
                 <StatCard
                    title="ROI (Retorno)"
                    value={`${stats.roi.toFixed(2)}%`}
                    description="Sobre o total investido"
                    icon={<TrendingUpIcon className="w-5 h-5 text-brand-text-secondary"/>}
                    colorClass={stats.roi > 0 ? 'text-brand-win' : 'text-brand-loss'}
                />
                 <StatCard
                    title="Taxa de Acerto"
                    value={`${stats.winRate.toFixed(2)}%`}
                    description={`${stats.wonBetsCount} vitórias em ${stats.resolvedBetsCount} apostas`}
                    icon={<CheckIcon className="w-5 h-5 text-brand-text-secondary"/>}
                />
                <StatCard
                    title="Odd Média (Vitórias)"
                    value={`@${stats.averageOdd.toFixed(2)}`}
                    description="Média das apostas ganhas"
                    icon={<CalculatorIcon className="w-5 h-5 text-brand-text-secondary"/>}
                />

            </div>
            
            {/* Bankroll Edit Modal */}
            <Modal isOpen={isBankrollModalOpen} onClose={() => setIsBankrollModalOpen(false)}>
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
                        <button onClick={() => setIsBankrollModalOpen(false)} className="px-4 py-2 rounded-md bg-brand-border hover:bg-gray-600 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSaveBankroll} className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-primary-hover transition-colors flex items-center gap-2 font-semibold">
                            Salvar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Withdrawal Modal */}
            <Modal isOpen={isWithdrawalModalOpen} onClose={() => setIsWithdrawalModalOpen(false)}>
                <h2 className="text-lg font-bold mb-4">Registrar Saque</h2>
                <div className="flex flex-col gap-4">
                    <label htmlFor="withdrawalAmount" className="text-sm text-brand-text-secondary">
                        Valor do saque (R$)
                    </label>
                    <input
                        type="number"
                        id="withdrawalAmount"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        className="bg-brand-surface border border-brand-border rounded-md p-2 w-full focus:ring-1 focus:ring-brand-primary focus:outline-none"
                        placeholder="Ex: 50.00"
                    />
                     <div className="text-xs text-brand-text-secondary">
                        Banca Atual: {formatCurrency(stats.currentBankroll)}
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setIsWithdrawalModalOpen(false)} className="px-4 py-2 rounded-md bg-brand-border hover:bg-gray-600 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleAddWithdrawal} className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-primary-hover transition-colors flex items-center gap-2 font-semibold">
                            Confirmar Saque
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default StatsCards;