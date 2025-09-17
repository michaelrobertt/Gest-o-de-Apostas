
import React, { useState, useMemo, useEffect } from 'react';
import { Bet, BetStatus, Market, LolLeague } from '../types';
import { CheckCircleIcon, XCircleIcon, TrashIcon, PencilIcon } from './icons';
import Modal from './Modal';
import { toast } from 'react-hot-toast';
import { MARKETS, LOL_LEAGUES } from '../constants';

interface BetHistoryProps {
    bets: Bet[];
    onDelete: (betId: string) => void;
    onUpdateStatus: (betId: string, newStatus: BetStatus.WON | BetStatus.LOST) => void;
    onUpdateBet: (betId: string, updatedBet: Bet) => void;
}

const BetRow: React.FC<{ bet: Bet; onDelete: (id: string) => void; onUpdateStatus: (id: string, status: BetStatus.WON | BetStatus.LOST) => void; onEdit: (bet: Bet) => void; }> = ({ bet, onDelete, onUpdateStatus, onEdit }) => {
    const statusPillClass = {
        [BetStatus.PENDING]: 'bg-yellow-500/20 text-yellow-400',
        [BetStatus.WON]: 'bg-green-500/20 text-brand-win',
        [BetStatus.LOST]: 'bg-red-500/20 text-brand-loss',
    };
    
    const profitColor = bet.profitLoss > 0 ? 'text-brand-win' : 'text-brand-loss';
    
    return (
        <tr className="border-b border-brand-border hover:bg-brand-bg">
            <td className="p-3 text-sm text-brand-text-secondary hidden md:table-cell">{new Date(bet.date).toLocaleString('pt-BR')}</td>
            <td className="p-3">
                <div className="font-medium text-brand-text-primary">{bet.market}</div>
                <div className="text-sm text-brand-text-secondary">{bet.league}</div>
            </td>
            <td className="p-3">
                <div className="font-medium text-brand-text-primary">{bet.details}</div>
                <div className="text-sm text-brand-text-secondary">{bet.betType}</div>
            </td>
            <td className="p-3 text-brand-text-secondary hidden lg:table-cell">R$ {bet.value.toFixed(2)}</td>
            <td className="p-3 text-brand-text-secondary hidden lg:table-cell">@{bet.odd.toFixed(2)}</td>
            <td className="p-3">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusPillClass[bet.status]}`}>
                    {bet.status}
                </span>
            </td>
            <td className={`p-3 font-medium hidden md:table-cell ${profitColor}`}>
                {bet.status !== BetStatus.PENDING ? `R$ ${bet.profitLoss.toFixed(2)}` : '-'}
            </td>
            <td className="p-3">
                <div className="flex items-center gap-1">
                    {bet.status === BetStatus.PENDING && (
                        <>
                            <button onClick={() => onUpdateStatus(bet.id, BetStatus.WON)} className="p-2 rounded-md hover:bg-brand-win/20 text-brand-win" title="Marcar como Ganha">
                                <CheckCircleIcon className="w-5 h-5"/>
                            </button>
                             <button onClick={() => onUpdateStatus(bet.id, BetStatus.LOST)} className="p-2 rounded-md hover:bg-brand-loss/20 text-brand-loss" title="Marcar como Perdida">
                                <XCircleIcon className="w-5 h-5"/>
                            </button>
                        </>
                    )}
                     <button onClick={() => onEdit(bet)} className="p-2 rounded-md hover:bg-brand-primary/20 text-brand-primary" title="Editar Aposta">
                        <PencilIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => onDelete(bet.id)} className="p-2 rounded-md hover:bg-brand-danger/20 text-brand-danger" title="Excluir Aposta">
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                </div>
            </td>
        </tr>
    );
};


const BetHistory: React.FC<BetHistoryProps> = ({ bets, onDelete, onUpdateStatus, onUpdateBet }) => {
    const [marketFilter, setMarketFilter] = useState('Todos Mercados');
    const [statusFilter, setStatusFilter] = useState('Todos Status');
    const [editingBet, setEditingBet] = useState<Bet | null>(null);
    const [formState, setFormState] = useState<Bet | null>(null);
    
    useEffect(() => {
        setFormState(editingBet);
    }, [editingBet]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!formState) return;
        const { name, value } = e.target;
        
        const newState = { ...formState, [name]: value };

        if (name === 'market') {
            if (value === Market.LOL) {
                newState.league = LolLeague.LPL;
            } else {
                newState.league = 'N/A';
            }
        }
        setFormState(newState);
    };

    const handleSave = () => {
        if (formState) {
            const betToUpdate: Bet = {
                ...formState,
                value: parseFloat(String(formState.value)),
                odd: parseFloat(String(formState.odd)),
                units: parseFloat(String(formState.units)),
            };

            if (isNaN(betToUpdate.value) || isNaN(betToUpdate.odd)) {
                toast.error("Valor e Odd devem ser números válidos.");
                return;
            }
            if (betToUpdate.details.trim() === '' || betToUpdate.betType.trim() === '') {
                 toast.error("Detalhes e Tipo de Aposta não podem ser vazios.");
                return;
            }

            onUpdateBet(formState.id, betToUpdate);
            toast.success("Aposta atualizada com sucesso!");
            setEditingBet(null);
        }
    };


    const filteredBets = useMemo(() => {
        return bets.filter(bet => {
            const marketMatch = marketFilter === 'Todos Mercados' || bet.market === marketFilter;
            const statusMatch = statusFilter === 'Todos Status' || bet.status === statusFilter;
            return marketMatch && statusMatch;
        });
    }, [bets, marketFilter, statusFilter]);

    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border">
            <h3 className="text-lg font-semibold mb-4 text-brand-text-primary">Histórico de Apostas</h3>
            <div className="flex flex-wrap gap-4 mb-4">
                 <select value={marketFilter} onChange={e => setMarketFilter(e.target.value)} className="bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                    <option>Todos Mercados</option>
                    {Object.values(Market).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                    <option>Todos Status</option>
                    {Object.values(BetStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-brand-border">
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary hidden md:table-cell">Data</th>
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary">Mercado/Contexto</th>
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary">Aposta</th>
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary hidden lg:table-cell">Valor</th>
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary hidden lg:table-cell">Odd</th>
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary">Status</th>
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary hidden md:table-cell">Lucro/Prejuízo</th>
                            <th className="p-3 text-sm font-semibold text-brand-text-secondary">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBets.length > 0 ? (
                            filteredBets.map(bet => <BetRow key={bet.id} bet={bet} onDelete={onDelete} onUpdateStatus={onUpdateStatus} onEdit={setEditingBet} />)
                        ) : (
                            <tr>
                                <td colSpan={8} className="text-center p-8 text-brand-text-secondary">Nenhuma aposta encontrada.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
             <Modal isOpen={!!editingBet} onClose={() => setEditingBet(null)}>
                {formState && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold mb-4 text-brand-text-primary">Editar Aposta</h2>
                        <p className="text-sm text-brand-text-secondary">Data: {new Date(formState.date).toLocaleString('pt-BR')}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Mercado</label>
                                <select name="market" value={formState.market} onChange={handleFormChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                                    {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            {formState.market === Market.LOL && (
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-secondary mb-1">Liga</label>
                                    <select name="league" value={formState.league} onChange={handleFormChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                                        {LOL_LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Detalhes (Times)</label>
                            <input type="text" name="details" value={formState.details} onChange={handleFormChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Tipo de Aposta</label>
                            <input type="text" name="betType" value={formState.betType} onChange={handleFormChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Valor (R$)</label>
                                <input type="number" step="0.01" name="value" value={formState.value} onChange={handleFormChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Odd</label>
                                <input type="number" step="0.01" name="odd" value={formState.odd} onChange={handleFormChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Status</label>
                                <select name="status" value={formState.status} onChange={handleFormChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                                    {Object.values(BetStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditingBet(null)} className="px-4 py-2 rounded-md bg-brand-border hover:bg-gray-600 transition-colors">Cancelar</button>
                            <button onClick={handleSave} className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-primary-hover transition-colors font-semibold">Salvar Alterações</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default BetHistory;