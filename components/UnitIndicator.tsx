import React from 'react';
import { UNITS, UNIT_PERCENTAGE } from '../constants';
import { LightBulbIcon } from './icons';

interface UnitIndicatorProps {
    currentBankroll: number;
}

const UnitIndicator: React.FC<UnitIndicatorProps> = ({ currentBankroll }) => {
    
    const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border">
            <h3 className="text-base font-semibold text-brand-text-primary mb-3 flex items-center gap-2">
                <LightBulbIcon className="w-5 h-5 text-brand-yellow" />
                Indicador de Unidade (Stake)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {UNITS.map(unit => {
                    const valueInCurrency = currentBankroll * UNIT_PERCENTAGE * unit.value;
                    return (
                        <div key={unit.value} className="bg-brand-bg p-2 rounded-md border border-brand-border/50">
                            <p className="text-sm font-bold text-brand-primary">{unit.value}U</p>
                            <p className="text-xs text-brand-text-secondary">{formatCurrency(valueInCurrency)}</p>
                        </div>
                    );
                })}
            </div>
             <p className="text-xs text-brand-text-secondary mt-3 text-center">
                Baseado na sua banca atual de {formatCurrency(currentBankroll)}. 1 Unidade (1U) = 1%.
            </p>
        </div>
    );
};

export default UnitIndicator;
