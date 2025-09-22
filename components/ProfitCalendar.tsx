import React, { useState, useMemo } from 'react';
import { DailyProfitPoint } from '../types';

interface ProfitCalendarProps {
    data: DailyProfitPoint[];
    availableYears: number[];
    selectedYear: number;
    onYearChange: (year: number) => void;
}

const ProfitCalendar: React.FC<ProfitCalendarProps> = ({ data, availableYears, selectedYear, onYearChange }) => {
    // Padrão para o mês atual no carregamento inicial.
    // Como App.tsx padroniza selectedYear para o ano atual, isso exibirá corretamente o mês e o ano atuais.
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    
    const profitByDate = useMemo(() => new Map(data.map(d => [d.date, d])), [data]);
    
    const calendarGrid = useMemo(() => {
        const gridDays = [];
        const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
        
        // A data de início da grade é o domingo da semana em que o mês começa.
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

        // Precisamos de 6 semanas para garantir, então 42 dias.
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            const dateString = currentDate.toISOString().split('T')[0];
            const dayData = profitByDate.get(dateString);

            gridDays.push({
                date: currentDate,
                isCurrentMonth: currentDate.getMonth() === selectedMonth,
                profit: dayData?.profit,
                profitUnits: dayData?.profitUnits,
            });
        }
        return gridDays;
    }, [selectedYear, selectedMonth, profitByDate]);

    const getDayColor = (profit: number | undefined) => {
        if (profit === undefined) return 'bg-brand-border/30 hover:bg-brand-border/60';
        if (profit > 20) return 'bg-brand-win hover:bg-green-400';
        if (profit > 0) return 'bg-brand-win/60 hover:bg-green-500';
        if (profit < -20) return 'bg-brand-loss hover:bg-red-400';
        if (profit < 0) return 'bg-brand-loss/60 hover:bg-red-500';
        return 'bg-brand-border hover:bg-gray-600'; // Breakeven
    };

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const formatProfit = (profit: number) => {
        const prefix = profit < 0 ? '-R$' : 'R$';
        const value = Math.abs(profit).toFixed(2).replace('.', ',');
        return `${prefix}${value}`;
    };

    const formatUnits = (units: number) => {
        if (units >= 0) {
            return `+${units.toFixed(2).replace('.', ',')}U`;
        }
        return `${units.toFixed(2).replace('.', ',')}U`;
    };

    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
                <h3 className="text-lg font-semibold text-brand-text-primary">
                    Atividade Diária
                </h3>
                <div className="flex gap-2">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-brand-bg border border-brand-border rounded-md py-1 px-2 text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                        aria-label="Selecionar mês"
                    >
                        {monthNames.map((name, index) => (
                            <option key={name} value={index}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        className="bg-brand-bg border border-brand-border rounded-md py-1 px-2 text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                        aria-label="Selecionar ano"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-text-secondary font-medium mb-2">
                {weekdays.map(day => (
                    <div key={day}>{day}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
                {calendarGrid.map(({ date, isCurrentMonth, profit, profitUnits }, index) => {
                    const cellClasses = isCurrentMonth
                        ? `transition-colors ${getDayColor(profit)}`
                        : 'bg-transparent';

                    return (
                        <div 
                            key={index} 
                            className={`w-full aspect-square rounded-sm flex flex-col items-center justify-center p-1 relative ${cellClasses}`}
                            style={{ textShadow: '0px 0px 3px rgba(0,0,0,0.7)' }}
                            title={isCurrentMonth ? `${date.toLocaleDateString('pt-BR')}: ${profit !== undefined ? `${formatProfit(profit)} / ${formatUnits(profitUnits || 0)}` : 'Sem apostas'}` : date.toLocaleDateString('pt-BR')}
                        >
                            <span className={`absolute top-1 right-1 text-[10px] ${isCurrentMonth ? 'opacity-70' : 'text-brand-text-secondary/30'}`}>{date.getDate()}</span>
                            {isCurrentMonth && profit !== undefined && (
                                <div className="flex flex-col items-center justify-center leading-tight">
                                    <span className="text-sm text-white font-bold">{formatProfit(profit)}</span>
                                    {profitUnits !== undefined && (
                                       <span className="text-[11px] text-white/80 font-normal">{formatUnits(profitUnits)}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
             <div className="flex justify-end items-center text-xs text-brand-text-secondary mt-3">
                Menos &nbsp;
                <div className="flex gap-1">
                    <div className="w-5 h-5 rounded-sm bg-brand-loss/60"></div>
                    <div className="w-5 h-5 rounded-sm bg-brand-border"></div>
                    <div className="w-5 h-5 rounded-sm bg-brand-win/60"></div>
                </div>
                &nbsp; Mais
            </div>
        </div>
    );
};

export default ProfitCalendar;