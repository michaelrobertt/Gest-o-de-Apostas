import React, { useState, useMemo, useEffect } from 'react';
import { Bet, BetStatus, Market, LolLeague } from '../types';
import { PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from './icons';
import Modal from './Modal';
import { toast } from 'react-hot-toast';
import { MARKETS, LOL_LEAGUES } from '../constants';

interface EditBetFormProps {
    bet: Bet;
    onSave: (updatedBet: Bet) => void;
    onCancel: () => void;
}

const EditBetForm: React.FC<EditBetFormProps> = ({ bet, onSave, onCancel }) => {
    // FIX: Corrected syntax for useState declaration by adding '='.
    const [formData, setFormData] = useState<Bet>(bet);

    useEffect(() => {
        setFormData(bet);
    }, [bet]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.odd <= 1) {
            toast.error("A odd deve ser maior que 1.");
            return;
        }
        if (formData.value <= 0) {
            toast.error("O valor da aposta deve ser positivo.");
            return;
        }
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-bold text-brand-text-primary">Editar Aposta</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-brand-text-secondary mb-1">Mercado</label>
                    <select name="market" value={formData.market} onChange={handleChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2">
                         {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                {formData.market === Market.LOL && (
                <div>
                    <label className="block text-sm font-medium text-brand-text-secondary mb-1">Liga (LOL)</label>
                    <select name="league" value={formData.league} onChange={handleChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2">
                        {LOL_LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
                     </select>
                </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Detalhes</label>
                <textarea name="details" value={formData.details} onChange={handleChange} rows={3} className="w-full bg-brand-bg border border-brand-border rounded-md p-2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-brand-text-secondary mb-1">Valor (R$)</label>
                    <input type="number" step="0.01" name="value" value={formData.value} onChange={handleNumberChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-brand-text-secondary mb-1">Odd</label>
                    <input type="number" step="0.01" name="odd" value={formData.odd} onChange={handleNumberChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-brand-text-secondary mb-1">Unidades</label>
                    <input type="number" step="0.1" name="units" value={formData.units} onChange={handleNumberChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2" />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2">
                    <option value={BetStatus.PENDING}>Pendente</option>
                    <option value={BetStatus.WON}>Ganhou</option>
                    <option value={BetStatus.LOST}>Perdeu</option>
                </select>
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-brand-border hover:bg-gray-600 transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-primary-hover transition-colors font-semibold">Salvar Alterações</button>
            </div>
        </form>
    );
};


interface BetHistoryProps {
    bets: Bet[];
    onDelete: (betId: string) => void;
    onUpdateStatus: (betId: string, newStatus: BetStatus.WON | BetStatus.LOST) => void;
    onUpdateBet: (betId: string, updatedBet: Bet) => void;
}

const BetRow: React.FC<{ bet: Bet; onDelete: (id: string) => void; onUpdateStatus: (id: string, status: BetStatus.WON | BetStatus.LOST) => void; onEdit: (bet: Bet) => void; }> = ({ bet, onDelete, onUpdateStatus, onEdit }) => {
    
    const handleDelete = () => {
        toast((t) => (
            <div className="text-brand-text-primary p-2">
                <p className="font-semibold mb-3">Confirmar Exclusão</p>
                <p className="text-sm text-brand-text-secondary mb-4">Tem certeza que deseja apagar esta aposta? Esta ação não pode ser desfeita.</p>
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        className="px-4 py-2 rounded-md bg-brand-border hover:bg-gray-600 transition-colors text-sm font-semibold"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={() => {
                            onDelete(bet.id);
                            toast.dismiss(t.id);
                            toast.success("Aposta apagada.");
                        }}
                        className="px-4 py-2 rounded-md bg-brand-danger hover:bg-brand-danger-hover transition-colors text-sm font-semibold text-white"
                    >
                        Apagar
                    </button>
                </div>
            </div>
        ));
    };

    const getStatusIndicator = () => {
        switch(bet.status) {
            case BetStatus.WON: return <div className="flex items-center gap-1 text-brand-win"><CheckCircleIcon className="w-4 h-4" /> Ganhou</div>;
            case BetStatus.LOST: return <div className="flex items-center gap-1 text-brand-loss"><XCircleIcon className="w-4 h-4" /> Perdeu</div>;
            default: return <div className="flex items-center gap-1 text-brand-text-secondary"><ClockIcon className="w-4 h-4" /> Pendente</div>;
        }
    };
    
    const statusClasses = useMemo(() => {
        switch(bet.status) {
            case BetStatus.WON:
                return 'border-l-brand-win bg-brand-win/5';
            case BetStatus.LOST:
                return 'border-l-brand-loss bg-brand-loss/5';
            default:
                return 'border-l-brand-border';
        }
    }, [bet.status]);

    const profitColor = bet.profitLoss > 0 ? 'text-brand-win' : bet.profitLoss < 0 ? 'text-brand-loss' : 'text-brand-text-secondary';
    
    return (
        <div className={`bg-brand-bg p-4 rounded-lg border-l-4 border border-brand-border/50 hover:border-brand-border transition-all ${statusClasses}`}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
                        <span>{new Date(bet.date).toLocaleDateString('pt-BR')}</span>
                        <span className="font-bold text-brand-primary">{bet.market}</span>
                        {bet.league && bet.league !== 'N/A' && <span>({bet.league})</span>}
                    </div>
                    {bet.betStructure === 'Accumulator' && bet.selections ? (
                        <div>
                            <p className="font-semibold text-brand-text-primary">{bet.betType}</p>
                            <ul className="list-disc list-inside text-brand-text-secondary text-sm pl-2 mt-1 space-y-0.5">
                                {bet.selections.map((s, i) => (
                                    <li key={i}>{s.details} (@{s.odd.toFixed(2)})</li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div>
                            <p className="font-semibold text-brand-text-primary">{bet.details.split('|')[0].trim()}</p>
                            <p className="text-sm text-brand-text-secondary">{bet.details.split('|')[1]?.trim() || bet.betType}</p>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2 text-sm w-48 text-right">
                    <div className="font-bold text-base">{getStatusIndicator()}</div>
                    {bet.status !== BetStatus.PENDING && (
                         <div className={`font-semibold ${profitColor}`}>
                            {bet.profitLoss >= 0 ? '+' : ''}R$ {bet.profitLoss.toFixed(2)}
                        </div>
                    )}
                    <div className="text-brand-text-secondary">
                        R$ {bet.value.toFixed(2)} @ {bet.odd.toFixed(2)}
                    </div>
                     <div className="text-xs text-brand-text-secondary">{bet.units.toFixed(2)} U</div>
                </div>
            </div>
            <div className="flex justify-end items-center gap-2 mt-3 pt-3 border-t border-brand-border">
                 {bet.status === BetStatus.PENDING && (
                    <>
                        <button onClick={() => onUpdateStatus(bet.id, BetStatus.WON)} className="px-3 py-1 text-sm rounded-md bg-brand-win/20 text-brand-win hover:bg-brand-win/40 transition-colors">Ganhou</button>
                        <button onClick={() => onUpdateStatus(bet.id, BetStatus.LOST)} className="px-3 py-1 text-sm rounded-md bg-brand-loss/20 text-brand-loss hover:bg-brand-loss/40 transition-colors">Perdeu</button>
                        <div className="h-4 border-l border-brand-border mx-2"></div>
                    </>
                 )}
                 <button onClick={() => onEdit(bet)} className="p-2 rounded-md hover:bg-brand-border transition-colors" title="Editar Aposta">
                    <PencilIcon className="w-4 h-4 text-brand-text-secondary" />
                 </button>
                 <button onClick={handleDelete} className="p-2 rounded-md hover:bg-brand-border transition-colors" title="Apagar Aposta">
                    <TrashIcon className="w-4 h-4 text-brand-danger" />
                 </button>
            </div>
        </div>
    )
};


const BetHistory: React.FC<BetHistoryProps> = ({ bets, onDelete, onUpdateStatus, onUpdateBet }) => {
    // FIX: Corrected syntax for useState declaration by adding '='.
    const [editingBet, setEditingBet] = useState<Bet | null>(null);
    const [filter, setFilter] = useState<BetStatus | 'all'>('all');
    const [page, setPage] = useState(1);
    const betsPerPage = 10;

    const filteredBets = useMemo(() => {
        return bets.filter(bet => filter === 'all' || bet.status === filter);
    }, [bets, filter]);

    const paginatedBets = useMemo(() => {
        const start = (page - 1) * betsPerPage;
        return filteredBets.slice(start, start + betsPerPage);
    }, [filteredBets, page, betsPerPage]);

    const totalPages = Math.ceil(filteredBets.length / betsPerPage);

    const handleUpdateBet = (updatedBet: Bet) => {
        if (editingBet) {
            onUpdateBet(editingBet.id, updatedBet);
            toast.success("Aposta atualizada com sucesso!");
            setEditingBet(null);
        }
    };
    
    const renderPagination = () => {
        if (totalPages <= 1) return null;
        return (
             <div className="flex justify-center items-center gap-2 mt-4 text-sm">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-md bg-brand-bg border border-brand-border disabled:opacity-50">Anterior</button>
                <span>Página {page} de {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded-md bg-brand-bg border border-brand-border disabled:opacity-50">Próxima</button>
            </div>
        )
    };
    
    const filterButtonClass = (f: BetStatus | 'all') => `px-4 py-2 text-sm rounded-md transition-colors ${filter === f ? 'bg-brand-primary text-white font-semibold' : 'bg-brand-bg hover:bg-brand-border'}`;

    return (
        <div className="bg-brand-surface p-6 rounded-lg border border-brand-border space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h3 className="text-lg font-semibold text-brand-text-primary">Histórico de Apostas ({filteredBets.length})</h3>
                <div className="flex items-center gap-2 p-1 bg-brand-surface rounded-lg border border-brand-border">
                    <button onClick={() => setFilter('all')} className={filterButtonClass('all')}>Todas</button>
                    <button onClick={() => setFilter(BetStatus.PENDING)} className={filterButtonClass(BetStatus.PENDING)}>Pendentes</button>
                    <button onClick={() => setFilter(BetStatus.WON)} className={filterButtonClass(BetStatus.WON)}>Ganhas</button>
                    <button onClick={() => setFilter(BetStatus.LOST)} className={filterButtonClass(BetStatus.LOST)}>Perdidas</button>
                </div>
            </div>
            
            {paginatedBets.length > 0 ? (
                 <div className="space-y-4">
                    {paginatedBets.map(bet => (
                        <BetRow key={bet.id} bet={bet} onDelete={onDelete} onUpdateStatus={onUpdateStatus} onEdit={setEditingBet} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-brand-text-secondary">
                    <p>Nenhuma aposta encontrada para este filtro.</p>
                </div>
            )}
            
            {renderPagination()}

            {editingBet && (
                <Modal isOpen={!!editingBet} onClose={() => setEditingBet(null)}>
                    <EditBetForm 
                        bet={editingBet}
                        onSave={handleUpdateBet}
                        onCancel={() => setEditingBet(null)}
                    />
                </Modal>
            )}
        </div>
    );
};

export default BetHistory;