import React from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, DotProps } from 'recharts';
import { BankrollHistoryPoint, BetStatus } from '../types';

interface BankrollChartProps {
    data: BankrollHistoryPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const dataPoint = payload[0].payload;
        const bet = dataPoint.bet;
        return (
            <div className="bg-brand-bg border border-brand-border p-3 rounded-lg shadow-lg text-sm max-w-xs">
                <p className="font-bold text-brand-text-primary mb-1">{`Aposta #${label}`}</p>
                <p className="text-brand-text-secondary mb-2">{`Banca: R$ ${dataPoint.value.toFixed(2)}`}</p>
                
                {bet && (
                    <div className="pt-2 border-t border-brand-border space-y-1">
                        <p className="text-xs text-brand-text-secondary">{new Date(bet.date).toLocaleString('pt-BR')}</p>
                        
                        {bet.betStructure === 'Accumulator' && bet.selections ? (
                             <div>
                                 <p className="font-semibold text-brand-text-primary">{bet.betType}</p>
                                 <ul className="list-disc list-inside text-brand-text-secondary text-xs pl-1 mt-1 space-y-0.5">
                                     {bet.selections.map((s, i) => (
                                         <li key={i}>{s.details} (@{s.odd.toFixed(2)})</li>
                                     ))}
                                 </ul>
                             </div>
                        ) : (
                             <div>
                                 <p className="font-semibold text-brand-text-primary">{bet.details.split('|')[0].trim()}</p>
                                 <p className="text-xs text-brand-text-secondary">{bet.details.split('|')[1]?.trim() || bet.betType}</p>
                             </div>
                        )}

                        <p className="font-semibold pt-1"><span className="text-brand-text-secondary">Resultado: </span> 
                           <span className={bet.profitLoss > 0 ? 'text-brand-win' : 'text-brand-loss'}>
                               {bet.status} (R$ {bet.profitLoss.toFixed(2)})
                           </span>
                        </p>
                    </div>
                )}
                 
                {label === 0 && <p className="mt-2 text-xs text-brand-text-secondary italic">Ponto inicial da banca.</p>}
            </div>
        );
    }
    return null;
};

const CustomizedDot: React.FC<DotProps & { payload?: BankrollHistoryPoint }> = (props) => {
    const { cx, cy, payload } = props;

    if (!payload || !payload.bet) {
        // Default dot for initial point
        return <circle cx={cx} cy={cy} r={4} fill="#10b981" />;
    }

    const color = payload.bet.status === BetStatus.WON ? '#10b981' : '#ef4444';
    
    return <circle cx={cx} cy={cy} r={4} fill={color} />;
};

const CustomizedActiveDot: React.FC<DotProps & { payload?: BankrollHistoryPoint }> = (props) => {
    const { cx, cy, payload } = props;

    if (!payload || !payload.bet) {
        return <circle cx={cx} cy={cy} r={8} fill="#10b981" stroke="rgba(255, 255, 255, 0.5)" strokeWidth={2} />;
    }

    const color = payload.bet.status === BetStatus.WON ? '#10b981' : '#ef4444';
    
    return <circle cx={cx} cy={cy} r={8} fill={color} stroke="rgba(255, 255, 255, 0.5)" strokeWidth={2} />;
};


const BankrollChart: React.FC<BankrollChartProps> = ({ data }) => {
    if (data.length <= 1) {
        return (
            <div className="bg-brand-surface p-4 rounded-lg border border-brand-border h-80">
                <h3 className="text-lg font-semibold mb-4 text-brand-text-primary">Evolução da Banca por Aposta</h3>
                <div className="flex items-center justify-center h-full text-brand-text-secondary">
                    <p>Adicione apostas resolvidas para ver a evolução da banca.</p>
                </div>
            </div>
        );
    }
    
    const initialBankroll = data[0]?.value || 0;
    const values = data.map(p => p.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const padding = Math.max(50, (dataMax - dataMin) * 0.1);
    const domainMin = Math.max(0, dataMin - padding);
    const domainMax = dataMax + padding;

    return (
        <div className="bg-brand-surface p-4 rounded-lg border border-brand-border h-80">
            <h3 className="text-lg font-semibold mb-4 text-brand-text-primary">Evolução da Banca por Aposta</h3>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                    <XAxis 
                        dataKey="betNumber" 
                        stroke="#a0a0a0" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        label={{ value: 'Número da Aposta', position: 'insideBottom', offset: -15, fill: '#a0a0a0' }}
                     />
                    <YAxis 
                        stroke="#a0a0a0" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `R$${Number(value).toFixed(0)}`}
                        domain={[domainMin, domainMax]} 
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={initialBankroll} stroke="#a0a0a0" strokeDasharray="4 4">
                         <Label 
                            value={`Inicial: R$${initialBankroll.toFixed(2)}`}
                            position="insideRight" 
                            fill='#a0a0a0' 
                            fontSize={12}
                            dy={-10}
                         />
                    </ReferenceLine>
                    {data.map((point) => 
                        point.isNewDay && point.betNumber > 0 ? (
                            <ReferenceLine key={`day-sep-${point.betNumber}`} x={point.betNumber} stroke="#555555" strokeDasharray="2 5">
                                <Label 
                                    value={new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} 
                                    position="top" 
                                    fill="#a0a0a0"
                                    fontSize={12}
                                    offset={10}
                                    style={{ textShadow: '0 0 5px #121212', fontWeight: 'bold' }}
                                />
                            </ReferenceLine>
                        ) : null
                    )}
                    <Area type="monotone" dataKey="value" stroke="transparent" fill="url(#colorValue)" />
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        name="Banca" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={<CustomizedDot />} 
                        activeDot={<CustomizedActiveDot />} 
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default BankrollChart;