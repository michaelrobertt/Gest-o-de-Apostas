import React from 'react';
import { DailyProfitPoint } from '../types';

interface ProfitCalendarProps {
    data: DailyProfitPoint[];
    availableYears: number[];
    selectedYear: number;
    onYearChange: (year: number) => void;
}

const Tooltip: React.FC<{ children: React.ReactNode; text: string }> = ({ children, text }) => (
    <div className="relative group flex items-center justify-center">
        {children}
        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-brand-bg text-white text-xs rounded-md border border-brand-border opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
            {text}
        </div>
    </div>
);

const ProfitCalendar: React.FC<ProfitCalendarProps> = ({ data, availableYears, selectedYear, onYearChange }) => {
    const year = selectedYear;
    const profitByDate = new Map(data.map(d => [d.date, d]));
    
    const days = [];
    const monthLabels = [];

    // The grid will start on the Sunday on or before Jan 1st of the selected year.
    const firstDayOfYear = new Date(year, 0, 1);
    const gridStartDate = new Date(firstDayOfYear);
    gridStartDate.setDate(firstDayOfYear.getDate() - firstDayOfYear.getDay());

    let lastMonth = -1;

    // A year's calendar grid is usually 53 weeks wide at most.
    const totalGridDays = 53 * 7;

    for (let i = 0; i < totalGridDays; i++) {
        const currentDate = new Date(gridStartDate);
        currentDate.setDate(gridStartDate.getDate() + i);

        // Add month labels only for the selected year
        if (currentDate.getFullYear() === year && currentDate.getMonth() !== lastMonth) {
            const weekIndex = Math.floor(i / 7);
            if (!monthLabels.some(l => l.weekIndex === weekIndex)) {
                const monthName = currentDate.toLocaleString('pt-BR', { month: 'short' });
                monthLabels.push({
                    name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                    weekIndex: weekIndex
                });
            }
            lastMonth = currentDate.getMonth();
        }

        // A cell is a valid day if it's within the selected year
        if (currentDate.getFullYear() !== year) {
            days.push({ type: 'empty' });
        } else {
            const dateString = currentDate.toISOString().split('T')[0];
            const dayData = profitByDate.get(dateString);
            days.push({
                type: 'day',
                date: currentDate,
                profit: dayData?.profit,
                count: dayData?.count,
            });
        }
    }


    const getDayColor = (profit: number | undefined) => {
        if (profit === undefined) return 'bg-brand-border/30 hover:bg-brand-border/60';
        if (profit > 20) return 'bg-brand-win hover:bg-green-400';
        if (profit > 0) return 'bg-brand-win/60 hover:bg-green-500';
        if (profit < -20) return 'bg-brand-loss hover:bg-red-400';
        if (profit < 0) return 'bg-brand-loss/60 hover:bg-red-500';
        return 'bg-brand-border hover:bg-gray-600'; // Breakeven
    };

    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-brand-text-primary">
                    Atividade Diária ({selectedYear})
                </h3>
                <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    className="bg-brand-bg border border-brand-border rounded-md py-1 px-2 text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                    aria-label="Selecionar ano para o calendário de atividade"
                >
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>

            <div className="flex gap-3">
                {/* Weekday Labels */}
                <div className="flex flex-col text-xs text-brand-text-secondary mt-8 shrink-0 space-y-1">
                    <span className="h-3 leading-3">Dom</span>
                    <span className="h-3 leading-3">Seg</span>
                    <span className="h-3 leading-3">Ter</span>
                    <span className="h-3 leading-3">Qua</span>
                    <span className="h-3 leading-3">Qui</span>
                    <span className="h-3 leading-3">Sex</span>
                    <span className="h-3 leading-3">Sáb</span>
                </div>

                <div className="w-full overflow-x-auto">
                    {/* Month Labels */}
                    <div className="grid mb-1" style={{ gridTemplateColumns: 'repeat(53, minmax(0, 1fr))' }}>
                        {monthLabels.map(({ name, weekIndex }) => (
                            <div key={`${name}-${weekIndex}`} className="text-xs text-brand-text-secondary" style={{ gridColumnStart: weekIndex + 1 }}>
                                {name}
                            </div>
                        ))}
                    </div>
                    {/* Calendar Grid */}
                    <div className="grid grid-rows-7 grid-flow-col gap-1">
                        {days.map((day, index) => {
                            if (day.type === 'empty') {
                                return <div key={index} className="w-3 h-3 rounded-sm bg-transparent" />;
                            }
                            const { date, profit, count } = day;
                            const tooltipText = `${date.toLocaleDateString('pt-BR')}: ${profit !== undefined ? `R$ ${profit.toFixed(2)} (${count} apostas)` : 'Sem apostas'}`;
                            return (
                                <Tooltip key={date.toISOString()} text={tooltipText}>
                                    <div className={`w-3 h-3 rounded-sm transition-colors ${getDayColor(profit)}`} />
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>
            </div>
             <div className="flex justify-end items-center text-xs text-brand-text-secondary mt-3">
                Menos &nbsp;
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm bg-brand-border/30"></div>
                    <div className="w-3 h-3 rounded-sm bg-brand-loss/60"></div>
                    <div className="w-3 h-3 rounded-sm bg-brand-border"></div>
                    <div className="w-3 h-3 rounded-sm bg-brand-win/60"></div>
                    <div className="w-3 h-3 rounded-sm bg-brand-win"></div>
                </div>
                &nbsp; Mais
            </div>
        </div>
    );
};

export default ProfitCalendar;