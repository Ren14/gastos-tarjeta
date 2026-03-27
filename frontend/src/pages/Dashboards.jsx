import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useDarkMode } from '../hooks/useDarkMode'
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LabelList,
} from 'recharts'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmtAbbrev(v) {
    const abs = Math.abs(v)
    if (abs >= 1_000_000) {
        const n = v / 1_000_000
        return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}M`
    }
    if (abs >= 1_000) return `${Math.round(v / 1_000)}K`
    return Math.round(v).toString()
}

function fmtFull(v) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function Skeleton() {
    return <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
}

function ChartCard({ title, legend, children }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">{title}</h2>
            {legend && <div className="mb-3">{legend}</div>}
            {children}
        </div>
    )
}

function YearSelector({ year, onChange }) {
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => onChange(year - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-bold text-lg"
            >‹</button>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100 min-w-[3.5rem] text-center">{year}</span>
            <button
                onClick={() => onChange(year + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors font-bold text-lg"
            >›</button>
        </div>
    )
}

// ── Custom tooltips ────────────────────────────────────────────────────────────

function CardSpendingTooltip({ active, payload, label, cards, hasPending }) {
    if (!active || !payload?.length) return null
    const monthIdx = MONTH_NAMES.indexOf(label)
    const isEst = monthIdx >= 0 && hasPending[monthIdx]
    const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
            <p className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                {label}
                {isEst && <span className="text-orange-500 ml-1.5 font-normal">(estimado)</span>}
            </p>
            {cards.map(card => {
                const p = payload.find(x => x.dataKey === `c${card.card_id}`)
                if (!p?.value) return null
                return (
                    <div key={card.card_id} className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: card.color_hex || '#888' }} />
                            <span className="text-gray-500 dark:text-gray-400 truncate">{card.card_name}</span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100 flex-shrink-0">{fmtFull(p.value)}</span>
                    </div>
                )
            })}
            {total > 0 && (
                <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-gray-200 dark:border-gray-600">
                    <span className="font-bold text-gray-700 dark:text-gray-200">TOTAL</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{fmtFull(total)}</span>
                </div>
            )}
        </div>
    )
}

const CASHFLOW_LINES = [
    { key: 'income',    label: 'Ingresos',   color: '#16a34a' },
    { key: 'expenses',  label: 'Egresos',    color: '#dc2626' },
    { key: 'savings',   label: 'Ahorros',    color: '#2563eb' },
    { key: 'available', label: 'Disponible', color: '#ca8a04' },
]

function CashflowTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
            <p className="font-bold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
            {CASHFLOW_LINES.map(item => {
                const p = payload.find(x => x.dataKey === item.key)
                if (!p) return null
                return (
                    <div key={item.key} className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                        </div>
                        <span className="font-medium" style={{ color: item.color }}>{fmtFull(p.value)}</span>
                    </div>
                )
            })}
        </div>
    )
}

// ── Legend button ──────────────────────────────────────────────────────────────

function LegendButton({ color, label, hidden, onClick, square }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 transition-opacity hover:border-gray-400 dark:hover:border-gray-500 ${
                hidden ? 'opacity-30' : ''
            }`}
        >
            {square
                ? <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                : <svg width="20" height="4" className="flex-shrink-0"><line x1="0" y1="2" x2="20" y2="2" stroke={color} strokeWidth="2" /></svg>
            }
            <span className="text-gray-700 dark:text-gray-300">{label}</span>
        </button>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function Dashboards() {
    const [year, setYear] = useState(new Date().getFullYear())
    const [cardSpending, setCardSpending] = useState(null)
    const [cashflow, setCashflow] = useState(null)
    const [savings, setSavings] = useState(null)
    const [loading, setLoading] = useState(true)
    const [hiddenCard, setHiddenCard] = useState({})         // card_id => bool (TOTAL not included)
    const [hiddenCashflow, setHiddenCashflow] = useState({}) // key => bool
    const [showCashflowLabels, setShowCashflowLabels] = useState(true)
    const [dark] = useDarkMode()

    useEffect(() => {
        setLoading(true)
        setHiddenCard({})
        setHiddenCashflow({})
        Promise.all([
            api.getCardSpendingDashboard(year),
            api.getCashflowDashboard(year),
            api.getSavingsDashboard(year),
        ]).then(([cs, cf, sv]) => {
            setCardSpending(cs)
            setCashflow(cf)
            setSavings(sv)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [year])

    // ── Chart 1 data — one value per card per month (null = no spending) ─────────
    const chart1Data = cardSpending
        ? MONTH_NAMES.map((name, i) => {
            const entry = { month: name }
            cardSpending.by_card.forEach(card => {
                const v = card.values[i]
                entry[`c${card.card_id}`] = v > 0 ? v : null
            })
            return entry
        })
        : []

    // ── Chart 2 data ───────────────────────────────────────────────────────────
    const chart2Data = cashflow
        ? MONTH_NAMES.map((name, i) => ({
            month:     name,
            income:    cashflow.income[i],
            expenses:  cashflow.expenses[i],
            savings:   cashflow.savings[i],
            available: cashflow.available[i],
        }))
        : []

    // ── Chart 3 data ───────────────────────────────────────────────────────────
    const chart3Data = savings
        ? MONTH_NAMES.map((name, i) => ({ month: name, value: savings.values[i] }))
        : []

    const toggleCard = key => setHiddenCard(p => ({ ...p, [key]: !p[key] }))
    const toggleCashflow = key => setHiddenCashflow(p => ({ ...p, [key]: !p[key] }))

    const selectAllCards = () => setHiddenCard({})
    const deselectAllCards = () => {
        const hidden = {}
        cardSpending?.by_card.forEach(card => { hidden[card.card_id] = true })
        setHiddenCard(hidden)
    }

    const hasEstimated = cardSpending?.has_pending?.some(Boolean)
    const labelFill = dark ? '#d1d5db' : '#6b7280'

    // ── Card spending legend ────────────────────────────────────────────────────
    const chart1Legend = cardSpending && (
        <div className="flex flex-wrap items-center gap-2">
            {cardSpending.by_card.map(card => (
                <LegendButton
                    key={card.card_id}
                    square
                    color={card.color_hex || '#888'}
                    label={card.card_name}
                    hidden={hiddenCard[card.card_id]}
                    onClick={() => toggleCard(card.card_id)}
                />
            ))}
            {hasEstimated && (
                <span className="text-xs text-orange-500 px-2 py-1">* estimado</span>
            )}
        </div>
    )

    // ── Cashflow legend ────────────────────────────────────────────────────────
    const chart2Legend = (
        <div className="flex flex-wrap items-center gap-2">
            {CASHFLOW_LINES.map(item => (
                <LegendButton
                    key={item.key}
                    color={item.color}
                    label={item.label}
                    hidden={hiddenCashflow[item.key]}
                    onClick={() => toggleCashflow(item.key)}
                />
            ))}
            <button
                onClick={() => setShowCashflowLabels(v => !v)}
                className="ml-auto text-xs px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                {showCashflowLabels ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}
            </button>
        </div>
    )

    const axisStyle = { fontSize: 11, fill: '#9ca3af' }

    return (
        <div className="flex flex-col gap-6">
            <YearSelector year={year} onChange={setYear} />

            {/* ── Chart 1: Card spending ─────────────────────────────────────── */}
            <ChartCard title="Gastos por tarjeta" legend={chart1Legend}>
                {loading ? <Skeleton /> : !cardSpending ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chart1Data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }} barCategoryGap="20%" barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" vertical={false} />
                            <XAxis dataKey="month" tick={axisStyle} />
                            <YAxis tickFormatter={fmtAbbrev} tick={axisStyle} width={48} />
                            <Tooltip
                                content={
                                    <CardSpendingTooltip
                                        cards={cardSpending.by_card}
                                        hasPending={cardSpending.has_pending}
                                    />
                                }
                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            />
                            {cardSpending.by_card.map(card => (
                                <Bar
                                    key={card.card_id}
                                    dataKey={`c${card.card_id}`}
                                    name={card.card_name}
                                    fill={card.color_hex || '#888'}
                                    hide={hiddenCard[card.card_id]}
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={32}
                                    isAnimationActive={false}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* ── Chart 2: Cashflow ──────────────────────────────────────────── */}
            <ChartCard title="Flujo de caja" legend={chart2Legend}>
                {loading ? <Skeleton /> : !cashflow ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chart2Data} margin={{ top: showCashflowLabels ? 20 : 5, right: 16, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                            <XAxis dataKey="month" tick={axisStyle} />
                            <YAxis tickFormatter={fmtAbbrev} tick={axisStyle} width={48} />
                            <Tooltip content={<CashflowTooltip />} />
                            <Line
                                dataKey="income"
                                stroke="#16a34a"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#16a34a' }}
                                hide={hiddenCashflow.income}
                                legendType="none"
                                isAnimationActive={false}
                                label={showCashflowLabels ? { position: 'top', formatter: fmtAbbrev, style: { fontSize: 10, fill: labelFill } } : false}
                            />
                            <Line
                                dataKey="expenses"
                                stroke="#dc2626"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#dc2626' }}
                                hide={hiddenCashflow.expenses}
                                legendType="none"
                                isAnimationActive={false}
                                label={showCashflowLabels ? { position: 'top', formatter: fmtAbbrev, style: { fontSize: 10, fill: labelFill } } : false}
                            />
                            <Line
                                dataKey="savings"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#2563eb' }}
                                hide={hiddenCashflow.savings}
                                legendType="none"
                                isAnimationActive={false}
                                label={showCashflowLabels ? { position: 'top', formatter: fmtAbbrev, style: { fontSize: 10, fill: labelFill } } : false}
                            />
                            <Line
                                dataKey="available"
                                stroke="#ca8a04"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#ca8a04' }}
                                hide={hiddenCashflow.available}
                                legendType="none"
                                isAnimationActive={false}
                                label={showCashflowLabels ? { position: 'top', formatter: fmtAbbrev, style: { fontSize: 10, fill: labelFill } } : false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>

            {/* ── Chart 3: Savings ───────────────────────────────────────────── */}
            <ChartCard title="Ahorros mensuales">
                {loading ? <Skeleton /> : !savings ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chart3Data} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                            <XAxis dataKey="month" tick={axisStyle} />
                            <YAxis tickFormatter={fmtAbbrev} tick={axisStyle} width={48} />
                            <Tooltip
                                formatter={(v) => [fmtFull(v), 'Ahorros']}
                                labelStyle={{ fontWeight: 600 }}
                                contentStyle={{
                                    borderRadius: 8,
                                    border: '1px solid #e5e7eb',
                                    fontSize: 12,
                                }}
                            />
                            <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    formatter={(v) => v > 0 ? fmtAbbrev(v) : ''}
                                    style={{ fontSize: 11, fill: '#6b7280' }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>
        </div>
    )
}
