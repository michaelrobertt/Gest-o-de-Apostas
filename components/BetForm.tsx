import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Bet, Market, LolLeague } from '../types';
import { MARKETS, LOL_LEAGUES, BET_TYPES, UNITS, UNIT_PERCENTAGE, HANDICAP_OPTIONS } from '../constants';
import { parseBetsFromImage } from '../services/geminiService';
import { UploadIcon, SparklesIcon, TrashIcon } from './icons';

// --- Custom TeamInput Component ---
interface TeamInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
    teams: string[];
    onDeleteTeam: (team: string) => void;
}

const TeamInput: React.FC<TeamInputProps> = ({ value, onChange, placeholder, teams, onDeleteTeam }) => {
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredTeams = teams.filter(team => team.toLowerCase().includes(value.toLowerCase()) && team.toLowerCase() !== value.toLowerCase());

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setDropdownVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectTeam = (team: string) => {
        onChange({ target: { value: team } } as any);
        setDropdownVisible(false);
    };

    const handleDelete = (e: React.MouseEvent, team: string) => {
        e.stopPropagation();
        onDeleteTeam(team);
        toast.success(`'${team}' removido das sugestões.`);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <input
                type="text"
                value={value}
                onChange={onChange}
                onFocus={() => setDropdownVisible(true)}
                className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none"
                placeholder={placeholder}
                autoComplete="off"
            />
            {dropdownVisible && value && filteredTeams.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-brand-surface border border-brand-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredTeams.map(team => (
                        <div
                            key={team}
                            className="flex justify-between items-center p-2 hover:bg-brand-bg cursor-pointer"
                            onMouseDown={() => handleSelectTeam(team)}
                        >
                            <span>{team}</span>
                            <button
                                type="button"
                                onMouseDown={(e) => handleDelete(e, team)}
                                className="p-1 rounded-full hover:bg-brand-danger/20 text-brand-danger"
                                title={`Remover '${team}' das sugestões`}
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- BetForm Component ---
interface BetFormProps {
    currentBankroll: number;
    addBet: (bet: Omit<Bet, 'id' | 'date' | 'profitLoss' | 'status'>) => void;
    existingTeams: Record<Market, string[]>;
    deleteTeamSuggestion: (team: string) => void;
}

interface BetFormState {
    market: Market;
    league: LolLeague | string;
    betType: string;
    customBetType: string;
    teamA: string;
    teamB: string;
    handicapValue: string;
    handicapOnTeam: 'A' | 'B';
    units: string;
    value: string;
    odd: string;
}

const initialFormState: BetFormState = {
    market: Market.LOL,
    league: LolLeague.LPL,
    betType: BET_TYPES[Market.LOL][0],
    customBetType: '',
    teamA: '',
    teamB: '',
    handicapValue: '',
    handicapOnTeam: 'A',
    units: '1',
    value: '',
    odd: '',
};

const BetForm: React.FC<BetFormProps> = ({ currentBankroll, addBet, existingTeams, deleteTeamSuggestion }) => {
    const [formState, setFormState] = useState(initialFormState);
    const [isAiSectionOpen, setIsAiSectionOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selection, setSelection] = useState<'A' | 'B' | null>(null);

    const isHandicap = formState.betType.includes('Handicap');
    const selectionNeeded = ['Moneyline (ML)', '1x2 (Resultado Final)', 'Vencedor do Mapa'].includes(formState.betType);

    useEffect(() => {
      setSelection(null);
    }, [formState.betType, formState.teamA, formState.teamB]);


    const handleMarketChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMarket = e.target.value as Market;
        setFormState(prev => ({
            ...prev,
            market: newMarket,
            betType: BET_TYPES[newMarket][0],
            league: newMarket === Market.LOL ? LolLeague.LPL : 'N/A',
        }));
    };

    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newUnits = e.target.value;
        const unitValue = parseFloat(newUnits);
        if (!isNaN(unitValue)) {
            const betValue = currentBankroll * UNIT_PERCENTAGE * unitValue;
            setFormState(prev => ({
                ...prev,
                units: newUnits,
                value: betValue.toFixed(2),
            }));
        } else {
            setFormState(prev => ({ ...prev, units: newUnits, value: '' }));
        }
    };
    
    useEffect(() => {
        handleUnitChange({ target: { value: formState.units } } as React.ChangeEvent<HTMLSelectElement>);
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentBankroll]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { market, league, betType, customBetType, teamA, teamB, units, value, odd, handicapValue, handicapOnTeam } = formState;

        const betValue = parseFloat(value);
        const betOdd = parseFloat(odd);
        const betUnits = parseFloat(units);

        if (!teamA.trim() || !teamB.trim() || isNaN(betValue) || betValue <= 0 || isNaN(betOdd) || betOdd <= 1) {
            toast.error('Preencha todos os campos corretamente, incluindo ambos os times.');
            return;
        }

        let finalBetType = betType === 'Outro' ? customBetType : betType;
        if (!finalBetType) {
            toast.error('Especifique o tipo de aposta.');
            return;
        }

        if (selectionNeeded) {
            if (!selection) {
                toast.error('Por favor, selecione um time/resultado para este tipo de aposta.');
                return;
            }
            const selectedTeamName = selection === 'A' ? teamA.trim() : teamB.trim();
            finalBetType = `${finalBetType}: ${selectedTeamName}`;
        }


        let finalDetails = `${teamA.trim()} vs ${teamB.trim()}`;
        if (isHandicap && handicapValue) {
             if (handicapOnTeam === 'A') {
                finalDetails = `${teamA.trim()} ${handicapValue} vs ${teamB.trim()}`;
            } else {
                finalDetails = `${teamA.trim()} vs ${teamB.trim()} ${handicapValue}`;
            }
        }

        addBet({
            market,
            league: market === Market.LOL ? league : 'N/A',
            betType: finalBetType,
            details: finalDetails,
            units: betUnits,
            value: betValue,
            odd: betOdd,
        });

        toast.success('Aposta registrada com sucesso!');
        setFormState(prev => ({ ...prev, teamA: '', teamB: '', odd: '', customBetType: '', handicapValue: '' }));
        setSelection(null);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        toast.loading('Analisando imagem com IA...');

        try {
            const parsedBets = await parseBetsFromImage(file);
            
            if (!parsedBets || parsedBets.length === 0) {
                throw new Error("Nenhuma aposta válida foi encontrada na imagem.");
            }

            let successfulAdds = 0;
            let errors = 0;

            for (const pBet of parsedBets) {
                if (pBet.details && pBet.value && pBet.odd && pBet.market && pBet.betType) {
                    addBet({
                        market: pBet.market,
                        league: pBet.league || 'N/A',
                        betType: pBet.betType,
                        details: pBet.details,
                        units: pBet.units || 0,
                        value: Number(pBet.value),
                        odd: Number(pBet.odd),
                    });
                    successfulAdds++;
                } else {
                    errors++;
                }
            }

            toast.dismiss();
            if (successfulAdds > 0) {
                toast.success(`${successfulAdds} aposta(s) registrada(s) com sucesso!`);
            }
            if (errors > 0) {
                toast.error(`${errors} aposta(s) na imagem não puderam ser lidas.`);
            }
        } catch (error) {
            toast.dismiss();
            toast.error(error instanceof Error ? error.message : 'Erro desconhecido.');
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    return (
        <div className="bg-brand-surface p-6 rounded-lg border border-brand-border space-y-6">
            <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setIsAiSectionOpen(!isAiSectionOpen)}
            >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-brand-primary" />
                    Registro Rápido com IA (Screenshot)
                </h3>
                <span className={`transform transition-transform ${isAiSectionOpen ? 'rotate-180' : ''}`}>▼</span>
            </div>

            {isAiSectionOpen && (
                <div className="border-t border-brand-border pt-4">
                    <label
                        htmlFor="ai-upload"
                        className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-brand-border rounded-lg cursor-pointer hover:bg-brand-bg transition-colors"
                    >
                        <UploadIcon className="w-10 h-10 text-brand-text-secondary mb-2" />
                        <span className="text-brand-text-primary">Clique para carregar uma imagem</span>
                        <span className="text-xs text-brand-text-secondary">Pode conter múltiplas apostas. PNG, JPG, etc.</span>
                        <input id="ai-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isProcessing} />
                    </label>
                    {isProcessing && <p className="text-center mt-2 text-brand-primary animate-pulse">Processando...</p>}
                </div>
            )}

            <h3 className="text-lg font-semibold border-t border-brand-border pt-4">Registrar Nova Aposta</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="market" className="block text-sm font-medium text-brand-text-secondary mb-1">Mercado</label>
                        <select id="market" value={formState.market} onChange={handleMarketChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                            {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    {formState.market === Market.LOL && (
                        <div>
                            <label htmlFor="league" className="block text-sm font-medium text-brand-text-secondary mb-1">Liga</label>
                            <select id="league" value={formState.league} onChange={e => setFormState(p => ({ ...p, league: e.target.value as LolLeague }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                                {LOL_LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="betType" className="block text-sm font-medium text-brand-text-secondary mb-1">Tipo de Aposta</label>
                    <select id="betType" value={formState.betType} onChange={e => setFormState(p => ({ ...p, betType: e.target.value }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                        {BET_TYPES[formState.market].map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                </div>
                
                {formState.betType === 'Outro' && (
                     <div>
                        <label htmlFor="customBetType" className="block text-sm font-medium text-brand-text-secondary mb-1">Especifique o Tipo de Aposta</label>
                        <input id="customBetType" type="text" value={formState.customBetType} onChange={e => setFormState(p => ({ ...p, customBetType: e.target.value }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none" placeholder="Ex: Total de Barões Over 1.5" />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-brand-text-secondary mb-1">Times (Time A vs Time B)</label>
                    <div className="flex items-center gap-2">
                         <TeamInput
                            value={formState.teamA}
                            onChange={e => setFormState(p => ({ ...p, teamA: e.target.value }))}
                            placeholder="Time A"
                            teams={existingTeams[formState.market] || []}
                            onDeleteTeam={deleteTeamSuggestion}
                        />
                        <span className="text-brand-text-secondary">vs</span>
                        <TeamInput
                            value={formState.teamB}
                            onChange={e => setFormState(p => ({ ...p, teamB: e.target.value }))}
                            placeholder="Time B"
                            teams={existingTeams[formState.market] || []}
                            onDeleteTeam={deleteTeamSuggestion}
                        />
                    </div>
                </div>

                {selectionNeeded && (
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Seleção</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelection('A')}
                                disabled={!formState.teamA}
                                className={`w-full p-2 rounded-md border text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selection === 'A' ? 'bg-brand-primary border-brand-primary-hover text-white' : 'bg-brand-bg border-brand-border hover:border-brand-text-secondary'}`}
                            >
                                {formState.teamA || 'Time A'}
                            </button>
                             <button
                                type="button"
                                onClick={() => setSelection('B')}
                                disabled={!formState.teamB}
                                className={`w-full p-2 rounded-md border text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selection === 'B' ? 'bg-brand-primary border-brand-primary-hover text-white' : 'bg-brand-bg border-brand-border hover:border-brand-text-secondary'}`}
                            >
                                {formState.teamB || 'Time B'}
                            </button>
                        </div>
                    </div>
                )}
                
                {isHandicap && (
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Detalhes do Handicap</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <input
                                list="handicaps"
                                id="handicapValue"
                                type="text"
                                value={formState.handicapValue}
                                onChange={e => setFormState(p => ({ ...p, handicapValue: e.target.value }))}
                                className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none"
                                placeholder="Ex: -1.5"
                            />
                             <datalist id="handicaps">
                                {HANDICAP_OPTIONS.map(h => <option key={h} value={h} />)}
                            </datalist>
                            <div className="flex items-center gap-4 bg-brand-bg border border-brand-border rounded-md p-2">
                                <span className="text-sm text-brand-text-secondary">Aplicar em:</span>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="handicapOnTeam" value="A" checked={formState.handicapOnTeam === 'A'} onChange={() => setFormState(p => ({...p, handicapOnTeam: 'A'}))} className="form-radio bg-brand-bg text-brand-primary"/>
                                    Time A
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" name="handicapOnTeam" value="B" checked={formState.handicapOnTeam === 'B'} onChange={() => setFormState(p => ({...p, handicapOnTeam: 'B'}))} className="form-radio bg-brand-bg text-brand-primary"/>
                                    Time B
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="units" className="block text-sm font-medium text-brand-text-secondary mb-1">Unidades</label>
                        <select id="units" value={formState.units} onChange={handleUnitChange} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none">
                            <option value="manual">Manual</option>
                            {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="value" className="block text-sm font-medium text-brand-text-secondary mb-1">Valor (R$)</label>
                        <input id="value" type="number" step="0.01" value={formState.value} onChange={e => setFormState(p => ({ ...p, value: e.target.value, units: 'manual' }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none" placeholder="25.00" />
                    </div>
                    <div>
                        <label htmlFor="odd" className="block text-sm font-medium text-brand-text-secondary mb-1">Odd</label>
                        <input id="odd" type="number" step="0.01" value={formState.odd} onChange={e => setFormState(p => ({ ...p, odd: e.target.value }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-brand-primary focus:outline-none" placeholder="1.85" />
                    </div>
                </div>

                <button type="submit" className="w-full bg-brand-primary text-white font-bold py-3 rounded-md hover:bg-brand-primary-hover transition-colors disabled:bg-gray-500">
                    Adicionar Aposta
                </button>
            </form>
        </div>
    );
};

export default BetForm;