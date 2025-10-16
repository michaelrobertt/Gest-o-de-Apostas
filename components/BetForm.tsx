import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Bet, BetSelection, Market, LolLeague, AILeverageSuggestion } from '../types';
import { LOL_LEAGUES, BET_TYPES, UNIT_PERCENTAGE, HANDICAP_OPTIONS } from '../constants';
import { parseBetsFromImage } from '../services/geminiService';
import { UploadIcon, SparklesIcon, TrashIcon, XIcon } from './icons';

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

interface BetFormProps {
    currentBankroll: number;
    addBet: (bet: Omit<Bet, 'id' | 'date' | 'profitLoss' | 'status'>) => void;
    addBetsFromImage: (bets: Partial<Bet>[]) => Promise<string>;
    existingTeams: Record<string, string[]>;
    deleteTeamSuggestion: (team: string) => void;
    availableMarkets: string[];
    aiSuggestedStake?: AILeverageSuggestion['suggestedStake'] | null;
}

interface SelectionFormState {
    market: string;
    league: LolLeague | string;
    betType: string;
    details: string;
    odd: string;
}

interface SingleBetState {
    teamA: string;
    teamB: string;
    odd: string;
    betType: string;
    market: string;
    league: LolLeague | string;
}

interface SpecificSelectionState {
    winner?: string;
    line?: string;
    side?: 'Over' | 'Under' | string;
    result?: 'Time A' | 'Empate' | 'Time B';
    choice?: 'Sim' | 'Não';
    custom?: string;
}

interface FormAccumulatorSelection extends BetSelection {
    market: string;
    league: LolLeague | string;
}

const initialSelectionState: SelectionFormState = { market: Market.LOL, league: LolLeague.LPL, betType: BET_TYPES[Market.LOL][0], details: '', odd: '' };
const initialSingleBetState: SingleBetState = { teamA: '', teamB: '', odd: '', betType: BET_TYPES[Market.LOL][0], market: Market.LOL, league: LolLeague.LPL };

const BetForm: React.FC<BetFormProps> = ({ currentBankroll, addBet, addBetsFromImage, existingTeams, deleteTeamSuggestion, availableMarkets, aiSuggestedStake }) => {
    const [betStructure, setBetStructure] = useState<'Single' | 'Accumulator'>('Single');
    const [singleBetState, setSingleBetState] = useState<SingleBetState>(initialSingleBetState);
    const [specificSelection, setSpecificSelection] = useState<SpecificSelectionState>({});
    const [selections, setSelections] = useState<FormAccumulatorSelection[]>([]);
    const [currentSelection, setCurrentSelection] = useState<SelectionFormState>(initialSelectionState);
    const [units, setUnits] = useState('1');
    const [value, setValue] = useState('');
    const [isAiSectionOpen, setIsAiSectionOpen] = useState(true);
    const [isManualFormOpen, setIsManualFormOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    useEffect(() => { handleUnitChange(units) }, [currentBankroll, units]);
    
    useEffect(() => { setSpecificSelection({}) }, [singleBetState.betType, singleBetState.market]);

    useEffect(() => {
        setSingleBetState(initialSingleBetState);
        setSpecificSelection({});
        setSelections([]);
        setCurrentSelection(initialSelectionState);
        handleUnitChange('1');
    }, [betStructure]);

    const unitOptions = useMemo(() => {
        const standardUnits = [
            { label: '1U (1%)', value: '1' },
            { label: '2U (2%)', value: '2' },
            { label: '3U (3%)', value: '3' },
        ];
        if (aiSuggestedStake) {
            return [
                { label: `💡 IA Recomendado (${aiSuggestedStake.bankrollPercentage.toFixed(2)}%)`, value: aiSuggestedStake.bankrollPercentage.toString() },
                ...standardUnits,
            ];
        }
        return standardUnits;
    }, [aiSuggestedStake]);
    
    useEffect(() => {
        if (aiSuggestedStake) {
            handleUnitChange(aiSuggestedStake.bankrollPercentage.toString());
        } else {
            handleUnitChange('1');
        }
    }, [aiSuggestedStake]);


    const handleUnitChange = (newUnitsValue: string) => {
        setUnits(newUnitsValue);
        if (newUnitsValue !== 'manual' && !isNaN(parseFloat(newUnitsValue))) {
            const percentage = parseFloat(newUnitsValue);
            setValue((currentBankroll * (percentage / 100)).toFixed(2));
        } else {
            setValue('');
        }
    };

    const handleAddSelection = () => {
        const odd = parseFloat(currentSelection.odd);
        if (!currentSelection.details.trim() || !currentSelection.betType.trim() || isNaN(odd) || odd <= 1) {
            toast.error("Preencha a seleção corretamente (Detalhes, Tipo e Odd > 1).");
            return;
        }
        setSelections(prev => [...prev, { ...currentSelection, odd }]);
        setCurrentSelection({ ...initialSelectionState, market: currentSelection.market });
    };
    
    const handleRemoveSelection = (index: number) => setSelections(prev => prev.filter((_, i) => i !== index));

    const totalAccumulatorOdd = useMemo(() => selections.reduce((acc, s) => acc * s.odd, 1), [selections]);

    const constructBetDetails = (): string => {
        const { teamA, teamB, betType } = singleBetState;
        const base = `${teamA.trim()} vs ${teamB.trim()}`;
        let specific = '';
        switch (betType) {
            case 'Moneyline (ML)':
            case 'Vencedor do Mapa':
                specific = `Vencedor: ${specificSelection.winner}`; break;
            case 'Handicap de Mapas':
            case 'Handicap de Rounds':
            case 'Handicap Asiático':
            case 'Handicap':
                specific = `Handicap: ${specificSelection.winner} ${specificSelection.line}`; break;
            case 'Total de Mapas (Over/Under)':
            case 'Total de Rounds (Over/Under)':
            case 'Total de Gols (Mais/Menos)':
            case 'Total (Over/Under)':
                specific = `Total: ${specificSelection.side} ${specificSelection.line}`; break;
            case '1x2 (Resultado Final)':
                const winner = specificSelection.result === 'Time A' ? teamA : specificSelection.result === 'Time B' ? teamB : 'Empate';
                specific = `Resultado: ${winner}`; break;
            case 'Ambas Marcam':
                specific = `Ambas Marcam: ${specificSelection.choice}`; break;
            default:
                specific = specificSelection.custom || '';
        }
        return specific ? `${base} | ${specific}` : base;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const betValue = parseFloat(value);
        if (isNaN(betValue) || betValue <= 0) { toast.error('O valor da aposta é inválido.'); return; }

        let finalUnits: number;
        const parsedUnits = parseFloat(units);

        if (isNaN(parsedUnits) || units === 'manual') { 
             if (currentBankroll > 0) {
                finalUnits = (betValue / currentBankroll) * 100;
            } else {
                finalUnits = 0;
            }
        } else {
            finalUnits = parsedUnits; // This is now a direct percentage
        }
        
        // Convert percentage to 1U=1% units for storage
        const unitsForStorage = finalUnits / (UNIT_PERCENTAGE * 100);


        if (betStructure === 'Single') {
            const { market, league, betType, teamA, teamB, odd: oddStr } = singleBetState;
            const betOdd = parseFloat(oddStr);
            if (!teamA.trim() || !teamB.trim() || isNaN(betOdd) || betOdd <= 1) {
                toast.error('Preencha os times e a odd corretamente.');
                return;
            }
            const details = constructBetDetails();
            addBet({ market, league, betStructure: 'Single', betType, details, units: unitsForStorage, value: betValue, odd: betOdd });
            setSingleBetState(prev => ({ ...prev, teamA: '', teamB: '', odd: '' }));
            setSpecificSelection({});
        } else {
            if (selections.length < 2) { toast.error("Uma aposta múltipla precisa de pelo menos 2 seleções."); return; }
            addBet({ market: selections[0]?.market || 'Múltipla', league: 'Múltipla', betStructure: 'Accumulator', betType: `Acumulada (${selections.length} seleções)`, details: selections.map(s => s.details).join(' / '), selections, units: unitsForStorage, value: betValue, odd: totalAccumulatorOdd });
            setSelections([]);
        }
        toast.success('Aposta registrada com sucesso!');
        handleUnitChange('1');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
    
        setIsProcessing(true);
        const loadingToastId = toast.loading(`Analisando ${files.length} imagem(ns) com IA...`);
    
        try {
            const parsingPromises = Array.from(files).map((file: File) => parseBetsFromImage(file));
            const results = await Promise.allSettled(parsingPromises);
    
            const allParsedBets: Partial<Bet>[] = [];
            let totalFailedImages = 0;
    
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
                    allParsedBets.push(...result.value);
                } else if (result.status === 'rejected') {
                    totalFailedImages++;
                    console.error("Falha ao analisar imagem:", result.reason);
                }
            });
    
            if (allParsedBets.length > 0) {
                const successMessage = await addBetsFromImage(allParsedBets);
                toast.success(successMessage);
            } else {
                 toast("Nenhuma aposta foi encontrada nas imagens fornecidas.");
            }

            if (totalFailedImages > 0) {
                toast.error(`Falha ao processar ${totalFailedImages} imagem(ns).`);
            }
    
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
        } finally {
            toast.dismiss(loadingToastId);
            setIsProcessing(false);
            if (e.target) {
                e.target.value = '';
            }
        }
    };
    
    const renderBetTypeSpecificInputs = () => {
        const { betType, teamA, teamB } = singleBetState;
        const buttonClass = (isSelected: boolean) => `flex-1 py-2 text-sm rounded-md border transition-colors ${isSelected ? 'bg-brand-primary text-white border-brand-primary' : 'bg-brand-bg border-brand-border hover:bg-brand-border'}`;

        const renderTeamSelection = (key: 'winner' | 'result') => (
            <div className="flex gap-2">
                <button type="button" onClick={() => setSpecificSelection(p => ({...p, [key]: teamA || 'Time A'}))} className={buttonClass(specificSelection[key] === (teamA || 'Time A'))}>{teamA || 'Time A'}</button>
                {key === 'result' && <button type="button" onClick={() => setSpecificSelection(p => ({...p, result: 'Empate'}))} className={buttonClass(specificSelection.result === 'Empate')}>Empate</button>}
                <button type="button" onClick={() => setSpecificSelection(p => ({...p, [key]: teamB || 'Time B'}))} className={buttonClass(specificSelection[key] === (teamB || 'Time B'))}>{teamB || 'Time B'}</button>
            </div>
        );

        switch(betType) {
            case 'Moneyline (ML)':
            case 'Vencedor do Mapa':
                return renderTeamSelection('winner');
            case 'Handicap de Mapas':
            case 'Handicap de Rounds':
            case 'Handicap Asiático':
            case 'Handicap':
                return (
                    <div className="space-y-2">
                        {renderTeamSelection('winner')}
                        <select value={specificSelection.line || ''} onChange={e => setSpecificSelection(p => ({ ...p, line: e.target.value }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2">
                            <option value="">Selecione o Handicap</option>
                            {HANDICAP_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                );
            case 'Total de Mapas (Over/Under)':
            case 'Total de Rounds (Over/Under)':
            case 'Total de Gols (Mais/Menos)':
            case 'Total (Over/Under)':
                return (
                     <div className="flex items-center gap-2">
                        <div className="flex gap-2 w-2/3">
                            <button type="button" onClick={() => setSpecificSelection(p => ({...p, side: 'Over'}))} className={buttonClass(specificSelection.side === 'Over')}>Over</button>
                            <button type="button" onClick={() => setSpecificSelection(p => ({...p, side: 'Under'}))} className={buttonClass(specificSelection.side === 'Under')}>Under</button>
                        </div>
                        <input type="number" step="0.5" value={specificSelection.line || ''} onChange={e => setSpecificSelection(p => ({...p, line: e.target.value}))} placeholder="Linha (ex: 2.5)" className="w-1/3 bg-brand-bg border border-brand-border rounded-md p-2" />
                    </div>
                );
            case '1x2 (Resultado Final)':
                 return renderTeamSelection('result');
            case 'Ambas Marcam':
                 return (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setSpecificSelection(p => ({...p, choice: 'Sim'}))} className={buttonClass(specificSelection.choice === 'Sim')}>Sim</button>
                        <button type="button" onClick={() => setSpecificSelection(p => ({...p, choice: 'Não'}))} className={buttonClass(specificSelection.choice === 'Não')}>Não</button>
                    </div>
                 );
            case 'Outro':
                return <input type="text" value={specificSelection.custom || ''} onChange={e => setSpecificSelection({ custom: e.target.value })} placeholder="Descreva a aposta específica" className="w-full bg-brand-bg border border-brand-border rounded-md p-2"/>
            default:
                return null;
        }
    };

    const renderSingleBetForm = () => (
        <>
            <fieldset className="border border-brand-border p-3 rounded-md space-y-4">
                <legend className="text-sm font-medium text-brand-text-secondary px-2">Evento</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                        value={singleBetState.market}
                        onChange={e => setSingleBetState(p => {
                            const newMarket = e.target.value;
                            const defaultBetTypes = BET_TYPES[newMarket as Market];
                            return {
                                ...p,
                                market: newMarket,
                                league: newMarket === Market.LOL ? LolLeague.LPL : 'N/A',
                                betType: defaultBetTypes ? defaultBetTypes[0] : 'Moneyline (ML)'
                            };
                        })}
                        className="w-full bg-brand-bg border border-brand-border rounded-md p-2"
                    >
                        {availableMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {singleBetState.market === Market.LOL && (
                        <select value={singleBetState.league} onChange={e => setSingleBetState(p => ({ ...p, league: e.target.value as LolLeague }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2">
                            {LOL_LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <TeamInput value={singleBetState.teamA} onChange={e => setSingleBetState(p => ({ ...p, teamA: e.target.value }))} placeholder="Time A" teams={existingTeams[singleBetState.market] || []} onDeleteTeam={deleteTeamSuggestion} />
                    <span>vs</span>
                    <TeamInput value={singleBetState.teamB} onChange={e => setSingleBetState(p => ({ ...p, teamB: e.target.value }))} placeholder="Time B" teams={existingTeams[singleBetState.market] || []} onDeleteTeam={deleteTeamSuggestion} />
                </div>
            </fieldset>

            <fieldset className="border border-brand-border p-3 rounded-md space-y-4">
                <legend className="text-sm font-medium text-brand-text-secondary px-2">Aposta</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <select value={singleBetState.betType} onChange={e => setSingleBetState(p => ({ ...p, betType: e.target.value }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2">
                        {(BET_TYPES[singleBetState.market as Market] || ['Moneyline (ML)', 'Handicap', 'Total (Over/Under)', 'Outro']).map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                    <input type="number" step="0.01" value={singleBetState.odd} onChange={e => setSingleBetState(p => ({ ...p, odd: e.target.value }))} className="w-full bg-brand-bg border border-brand-border rounded-md p-2" placeholder="Odd. Ex: 1.85" />
                </div>
                {renderBetTypeSpecificInputs()}
            </fieldset>
        </>
    );

    const renderAccumulatorForm = () => (
        <div className="space-y-4">
            <div className="bg-brand-bg p-4 rounded-lg border border-brand-border space-y-3">
                <h4 className="font-semibold text-brand-text-primary">Adicionar Nova Seleção</h4>
                <div className="grid grid-cols-2 gap-2">
                 <select
                        value={currentSelection.market}
                        onChange={e => setCurrentSelection(p => ({...p, market: e.target.value }))}
                        className="w-full bg-brand-surface border border-brand-border rounded-md p-2"
                    >
                        {availableMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="text" value={currentSelection.betType} onChange={e => setCurrentSelection(p => ({...p, betType: e.target.value}))} placeholder="Tipo (Ex: Moneyline Time A)" className="w-full bg-brand-surface border border-brand-border rounded-md p-2" />
                </div>
                <input type="text" value={currentSelection.details} onChange={e => setCurrentSelection(p => ({...p, details: e.target.value}))} placeholder="Detalhes (Ex: Time A vs Time B)" className="w-full bg-brand-surface border border-brand-border rounded-md p-2" />
                <div className="grid grid-cols-2 gap-2">
                    <input type="number" step="0.01" value={currentSelection.odd} onChange={e => setCurrentSelection(p => ({...p, odd: e.target.value}))} placeholder="Odd" className="w-full bg-brand-surface border border-brand-border rounded-md p-2" />
                     <button type="button" onClick={handleAddSelection} className="w-full bg-brand-border text-brand-text-primary font-semibold py-2 rounded-md hover:bg-gray-700 transition-colors">Adicionar Seleção</button>
                </div>
            </div>
            {selections.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-semibold text-brand-text-primary">Seleções ({selections.length}) - Odd Total: @{totalAccumulatorOdd.toFixed(2)}</h4>
                    <ul className="max-h-40 overflow-y-auto space-y-2 pr-2">
                        {selections.map((sel, index) => (
                            <li key={index} className="flex justify-between items-center bg-brand-bg p-2 rounded-md text-sm">
                                <div>
                                    <p className="font-medium text-brand-text-primary">{sel.details}</p>
                                    <p className="text-brand-text-secondary">{sel.market} - {sel.betType}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                   <span className="font-bold text-brand-primary">@{sel.odd.toFixed(2)}</span>
                                   <button type="button" onClick={() => handleRemoveSelection(index)} className="text-brand-danger hover:text-red-400"><XIcon className="w-4 h-4" /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );

    return (
        <div className="bg-brand-surface p-6 rounded-lg border border-brand-border space-y-6">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsAiSectionOpen(!isAiSectionOpen)}>
                <h3 className="text-lg font-semibold flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-brand-primary" />Registro Rápido com IA</h3>
                <span className={`transform transition-transform ${isAiSectionOpen ? 'rotate-180' : ''}`}>▼</span>
            </div>
            {isAiSectionOpen && (
                 <div className="border-t border-brand-border pt-4">
                    <label htmlFor="ai-upload" className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-brand-border rounded-lg cursor-pointer hover:bg-brand-bg transition-colors">
                        <UploadIcon className="w-10 h-10 text-brand-text-secondary mb-2" />
                        <span className="text-brand-text-primary">Clique para carregar imagem(ns) do boletim</span>
                        <input id="ai-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isProcessing} multiple />
                    </label>
                    {isProcessing && <p className="text-center mt-2 text-brand-primary animate-pulse">Processando...</p>}
                </div>
            )}

            <div className="flex justify-between items-center cursor-pointer border-t border-brand-border pt-4" onClick={() => setIsManualFormOpen(!isManualFormOpen)}>
                <h3 className="text-lg font-semibold">Registrar Nova Aposta</h3>
                <span className={`transform transition-transform ${isManualFormOpen ? 'rotate-180' : ''}`}>▼</span>
            </div>

            {isManualFormOpen && (
                 <div className="space-y-4">
                    <div className="flex bg-brand-bg rounded-lg p-1 border border-brand-border">
                        <button onClick={() => setBetStructure('Single')} className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${betStructure === 'Single' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-border'}`}>Aposta Simples</button>
                        <button onClick={() => setBetStructure('Accumulator')} className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${betStructure === 'Accumulator' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-border'}`}>Aposta Múltipla</button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {betStructure === 'Single' ? renderSingleBetForm() : renderAccumulatorForm()}
                        
                        <fieldset className="border border-brand-border p-3 rounded-md">
                            <legend className="text-sm font-medium text-brand-text-secondary px-2">Investimento</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label htmlFor="units" className="block text-sm font-medium text-brand-text-secondary mb-1">Unidades (% da Banca)</label>
                                    <select 
                                        id="units" 
                                        value={units} 
                                        onChange={(e) => handleUnitChange(e.target.value)} 
                                        className="w-full bg-brand-bg border border-brand-border rounded-md p-2"
                                    >
                                        <option value="manual">Manual</option>
                                        {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="value" className="block text-sm font-medium text-brand-text-secondary mb-1">Valor (R$)</label>
                                    <input 
                                        id="value" 
                                        type="number" 
                                        step="0.01" 
                                        value={value} 
                                        onChange={e => { setValue(e.target.value); setUnits('manual'); }} 
                                        className="w-full bg-brand-bg border border-brand-border rounded-md p-2" 
                                        placeholder="25.00" 
                                        readOnly={units !== 'manual'}
                                    />
                                </div>
                            </div>
                        </fieldset>

                        <button type="submit" className="w-full bg-brand-primary text-white font-bold py-3 rounded-md hover:bg-brand-primary-hover transition-colors disabled:bg-gray-500">
                            Adicionar Aposta
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default BetForm;