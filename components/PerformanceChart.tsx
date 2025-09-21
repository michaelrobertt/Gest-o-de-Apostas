import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MarketPerformancePoint } from '../types';

interface PerformanceChartProps {
    data: MarketPerformancePoint[];
    availableYears: number[];
    selectedYear: number;
    onYearChange: (year: number) => void;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const roi = (data.invested ?? 0) > 0 ? ((data.profit ?? 0) / (data.invested ?? 1)) * 100 : 0;
        return (
            <div className="bg-brand-bg border border-brand-border p-3 rounded-lg shadow-lg text-sm">
                <p className="font-bold text-brand-text-primary mb-1">{data.name}</p>
                <p className={(data.profit ?? 0) >= 0 ? 'text-brand-win' : 'text-brand-loss'}>
                    Lucro/Prejuízo: R$ {(data.profit ?? 0).toFixed(2)}
                </p>
                <p className="text-brand-text-secondary">Total Investido: R$ {(data.invested ?? 0).toFixed(2)}</p>
                <p className="text-brand-text-secondary">ROI: {roi.toFixed(2)}%</p>
                <p className="text-brand-text-secondary">Apostas: {data.betsCount}</p>
            </div>
        );
    }
    return null;
};


const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, availableYears, selectedYear, onYearChange }) => {
    const sortedData = [...data].sort((a,b) => a.profit - b.profit);

    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border h-80 flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-brand-text-primary">
                    Performance (Jan-Set {selectedYear})
                </h3>
                <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    className="bg-brand-bg border border-brand-border rounded-md py-1 px-2 text-sm focus:ring-1 focus:ring-brand-primary focus:outline-none"
                    aria-label="Selecionar ano para o gráfico de performance"
                >
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>
            <div className="flex-grow">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={sortedData}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 100,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                            <XAxis type="number" stroke="#a0a0a0" fontSize={12} tickFormatter={(value) => `R$${value}`} domain={['auto', 'auto']} />
                            <YAxis 
                                type="category" 
                                dataKey="name" 
                                stroke="#a0a0a0" 
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={100}
                                interval={0}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                            <Bar dataKey="profit" background={{ fill: 'rgba(255, 255, 255, 0.02)' }}>
                                {sortedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-brand-text-secondary">
                        <p>Nenhum dado encontrado para Jan-Set de {selectedYear}.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PerformanceChart;