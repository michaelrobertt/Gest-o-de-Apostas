
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { MarketPerformancePoint } from '../types';

interface PerformanceChartProps {
    data: MarketPerformancePoint[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border h-80">
            <h3 className="text-lg font-semibold mb-4 text-brand-text-primary">Performance por Mercado/Liga</h3>
            {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                        <XAxis dataKey="name" stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                        <Tooltip
                             contentStyle={{
                                backgroundColor: '#1e1e1e',
                                border: '1px solid #2c2c2c',
                                color: '#e0e0e0',
                            }}
                            formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} />
                        <Bar dataKey="profit" name="Lucro/Prejuízo">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-brand-text-secondary">
                    <p>Nenhum dado de performance para exibir.</p>
                </div>
            )}
        </div>
    );
};

export default PerformanceChart;
