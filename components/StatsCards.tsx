import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Stats } from '../types';
import Modal from './Modal';
import { ArrowUpIcon, ArrowDownIcon, PencilIcon, CheckIcon, TrendingUpIcon, ScaleIcon, CalculatorIcon, BanknotesIcon, CircleStackIcon, TrendingDownIcon, FlagIcon } from './icons';


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
    onSetBankrollGoal: (amount: number) => void;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, onSetInitialBankroll, onAddWithdrawal, onSetBankrollGoal }) => {
    const [isBankrollModalOpen, setIsBankrollModalOpen] = useState(false);
    const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    
    const [newBankroll, setNewBankroll] = useState(stats.initialBankroll.toString());
    const [withdrawalAmount, setWithdrawalAmount] = useState('');
    const [newGoal, setNewGoal] = useState((stats.bankrollGoal || 0).toString());

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

    const handleSaveGoal = () => {
        const amount = parseFloat(newGoal);
        if (!isNaN(amount) && amount >= 0) {
            onSetBankrollGoal(amount);
            setIsGoalModalOpen(false);
            toast.success("Meta de banca definida!");
        } else {
            toast.error("Por favor, insira uma meta válida.");
        }
    };
    
    const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

    const profitColor = stats.totalProfitLoss > 0 ? 'text-brand-win' : stats.totalProfitLoss < 0 ? 'text-brand-loss' : 'text-brand-text-primary';
    const profitIcon = stats.totalProfitLoss > 0 ? <ArrowUpIcon className="w-5 h-5 text-brand-win" /> : <ArrowDownIcon className="w-5 h-5 text-brand-loss" />;

    const roiColor = stats.roi > 0 ? 'text-brand-win' : stats.roi < 0 ? 'text-brand-loss' : 'text-brand-text-primary';
    const roiIcon = stats.roi > 0 
        ? <TrendingUpIcon className="w-5 h-5 text-brand-win" /> 
        : stats.roi < 0 
            ? <TrendingDownIcon className="w-5 h-5 text-brand-loss" />
            : <TrendingUpIcon className="w-5 h-5 text-brand-text-secondary" />;
            
    const goalProgress = stats.bankrollGoal > 0 ? Math.min((stats.currentBankroll / stats.bankrollGoal) * 100, 100) : 0;

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    title="Banca Atual"
                    value={formatCurrency(stats.currentBankroll)}
                    description="Capital de giro disponível"
                    icon={<TrendingUpIcon className="w-5 h-5 text-brand-blue" />}
                    colorClass="text-brand-blue"
                    actionButton={
                        <button onClick={() => setIsWithdrawalModalOpen(true)} className="text-xs bg-brand-primary/20 text-brand-primary px-2 py-1 rounded hover:bg-brand-primary/40">
                            Sacar
                        </button>
                    }
                />
                <StatCard
                    title="Lucro/Prejuízo Total"
                    value={formatCurrency(stats.totalProfitLoss)}
                    description={`${stats.wonBetsCount}V / ${stats.resolvedBetsCount - stats.wonBetsCount}D`}
                    icon={profitIcon}
                    colorClass={profitColor}
                />
                <StatCard
                    title="Banca Inicial"
                    value={formatCurrency(stats.initialBankroll)}
                    description="Clique para editar"
                    icon={<ScaleIcon className="w-5 h-5 text-brand-text-secondary" />}
                    onClick={() => setIsBankrollModalOpen(true)}
                    isEditable
                />

                <div
                    className="bg-brand-surface p-4 rounded-lg border border-brand-border flex flex-col justify-between relative cursor-pointer hover:border-brand-violet/50 transition-colors"
                    onClick={() => {
                        setNewGoal((stats.bankrollGoal || 0).toString());
                        setIsGoalModalOpen(true);
                    }}
                >
                    <div>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-brand-text-secondary font-medium">Meta de Banca</p>
                                <p className="text-2xl font-bold text-brand-violet">{formatCurrency(stats.bankrollGoal)}</p>
                            </div>
                            <div className="bg-brand-border p-2 rounded-full">
                                <FlagIcon className="w-5 h-5 text-brand-violet" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-2">
                        {stats.bankrollGoal > 0 ? (
                            <>
                                <div className="w-full bg-brand-border rounded-full h-2">
                                    <div 
                                        className="bg-brand-violet h-2 rounded-full transition-all duration-500" 
                                        style={{ width: `${goalProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-brand-text-secondary mt-1 text-right">
                                    {goalProgress.toFixed(1)}% alcançado
                                </p>
                            </>
                        ) : (
                            <p className="text-xs text-brand-text-secondary mt-1">Clique para definir uma meta.</p>
                        )}
                    </div>
                    <PencilIcon className="w-3 h-3 text-brand-text-secondary absolute top-2 right-2" />
                </div>

                <StatCard
                    title="Total Sacado"
                    value={formatCurrency(stats.totalWithdrawn)}
                    description="Lucros realizados"
                    icon={<BanknotesIcon className="w-5 h-5 text-brand-yellow" />}
                    colorClass="text-brand-yellow"
                />
                <StatCard
                    title="ROI (Retorno)"
                    value={`${stats.roi.toFixed(2)}%`}
                    description="Sobre o total investido"
                    icon={roiIcon}
                    colorClass={roiColor}
                />
                <StatCard
                    title="Taxa de Acerto"
                    value={`${stats.winRate.toFixed(2)}%`}
                    description={`${stats.wonBetsCount} vitórias em ${stats.resolvedBetsCount} apostas`}
                    icon={<CheckIcon className="w-5 h-5 text-brand-win"/>}
                    colorClass="text-brand-win"
                />
                 <StatCard
                    title="Odd Média (Vitórias)"
                    value={`@${stats.averageOdd.toFixed(2)}`}
                    description="Média das apostas ganhas"
                    icon={<CalculatorIcon className="w-5 h-5 text-brand-text-secondary"/>}
                    colorClass="text-brand-text-primary"
                />
                <StatCard
                    title="Drawdown Máximo"
                    value={`${stats.maxDrawdown.toFixed(2)}%`}
                    description="Pior queda do pico da banca"
                    icon={<TrendingDownIcon className="w-5 h-5 text-brand-danger"/>}
                    colorClass="text-brand-danger"
                />
                 <StatCard
                    title="Total Investido"
                    value={formatCurrency(stats.totalInvested)}
                    description="Soma de todos os stakes"
                    icon={<CircleStackIcon className="w-5 h-5 text-brand-text-secondary"/>}
                    colorClass="text-brand-text-primary"
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

            {/* Bankroll Goal Modal */}
            <Modal isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)}>
                <h2 className="text-lg font-bold mb-4">Definir Meta de Banca</h2>
                <div className="flex flex-col gap-4">
                    <label htmlFor="bankrollGoal" className="text-sm text-brand-text-secondary">
                        Qual sua meta de banca? (R$)
                    </label>
                    <input
                        type="number"
                        id="bankrollGoal"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        className="bg-brand-surface border border-brand-border rounded-md p-2 w-full focus:ring-1 focus:ring-brand-violet focus:outline-none"
                        placeholder="Ex: 500.00"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setIsGoalModalOpen(false)} className="px-4 py-2 rounded-md bg-brand-border hover:bg-gray-600 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSaveGoal} className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-primary-hover transition-colors flex items-center gap-2 font-semibold">
                            Salvar Meta
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default StatsCards;