
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BankrollHistoryPoint } from '../types';

interface BankrollChartProps {
    data: BankrollHistoryPoint[];
}

const BankrollChart: React.FC<BankrollChartProps> = ({ data }) => {
    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border h-80">
            <h3 className="text-lg font-semibold mb-4 text-brand-text-primary">Evolução da Banca</h3>
            {data.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                        <XAxis dataKey="date" stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e1e1e',
                                border: '1px solid #2c2c2c',
                                color: '#e0e0e0',
                            }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Banca']}
                        />
                         <Legend wrapperStyle={{paddingTop: '20px'}} />
                        <Line type="monotone" dataKey="value" name="Banca" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-brand-text-secondary">
                    <p>Adicione apostas resolvidas para ver a evolução da banca.</p>
                </div>
            )}
        </div>
    );
};

export default BankrollChart;
