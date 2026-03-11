import { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useCards } from '../hooks/useCards'
import { useCategories } from '../hooks/useCategories'
import { useMonthlySummary } from '../hooks/useMonthlySummary'
import { MonthNav } from '../components/MonthNav'
import { CardDropdown } from '../components/CardDropdown'
import { ExpenseList } from '../components/ExpenseList'
import { ExpenseBottomSheet } from '../components/ExpenseBottomSheet'
import { api } from '../api/client'

function CategoryChart({ expenses, categories }) {
    const data = useMemo(() => {
        const totals = {}
        for (const e of expenses) {
            const key = e.category_id ?? 0
            totals[key] = (totals[key] ?? 0) + e.installment_amount
        }
        return Object.entries(totals)
            .map(([id, total]) => {
                const cat = categories.find(c => c.id === Number(id))
                return {
                    id: Number(id),
                    name: cat ? `${cat.icon} ${cat.name}` : 'Other',
                    color: cat?.color_hex ?? '#9ca3af',
                    total,
                }
            })
            .filter(d => d.total > 0)
            .sort((a, b) => b.total - a.total)
    }, [expenses, categories])

    if (!data.length) return null

    return (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">By category</p>
            <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="total"
                        strokeWidth={2}
                    >
                        {data.map(entry => (
                            <Cell key={entry.id} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value) => [`$${value.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`, '']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1 mt-1">
                {data.map(entry => (
                    <div key={entry.id} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-700">{entry.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">
                            ${entry.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function Dashboard({ initialMonth, initialYear }) {
    const now = new Date()
    const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1)
    const [year, setYear] = useState(initialYear ?? now.getFullYear())
    const [selectedCardId, setSelectedCardId] = useState(null)
    const [selectedCategoryId, setSelectedCategoryId] = useState(null)
    const [selectedExpense, setSelectedExpense] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [recurring, setRecurring] = useState([])
    const [closestRate, setClosestRate] = useState(null)

    const { cards } = useCards()
    const { categories } = useCategories()
    const { summary, allExpenses, byCard, loading } = useMonthlySummary(month, year, selectedCardId, refreshKey)

    useEffect(() => {
        api.getRecurring().then(setRecurring).catch(() => setRecurring([]))
    }, [refreshKey])

    useEffect(() => {
        api.getClosestExchangeRate(month, year)
            .then(setClosestRate)
            .catch(() => setClosestRate(null))
    }, [month, year])

    useEffect(() => {
        setSelectedCategoryId(null)
    }, [month, year, selectedCardId])

    function refresh() {
        setRefreshKey(k => k + 1)
    }

    const rate = closestRate?.usd_to_ars ?? 0

    // Set of recurring_ids that have already been generated this month (across all cards)
    const generatedRecurringIds = useMemo(() => {
        const ids = new Set()
        for (const e of allExpenses) {
            if (e.recurring_id != null) ids.add(e.recurring_id)
        }
        return ids
    }, [allExpenses])

    // Estimated recurring rows for the selected card (not yet generated this month)
    const estimatedRows = useMemo(() => {
        if (!selectedCardId) return []
        return recurring
            .filter(r => r.card_id === selectedCardId && !generatedRecurringIds.has(r.id))
            .map(r => ({
                expense_id: `est-${r.id}`,
                merchant: r.merchant,
                installment_amount: r.amount_usd * rate,
                installment_number: 1,
                total_installments: 1,
                card_id: r.card_id,
                card_name: '',
                category_id: r.category_id,
                is_recurring: true,
                recurring_id: r.id,
                is_estimated: true,
                amount_usd: r.amount_usd,
                purchase_date: null,
                total_amount: r.amount_usd * rate,
            }))
    }, [recurring, selectedCardId, generatedRecurringIds, rate])

    // Merge real expenses + estimated rows for the selected card
    const mergedExpenses = useMemo(() => {
        const real = summary?.expenses ?? []
        return [...real, ...estimatedRows]
    }, [summary?.expenses, estimatedRows])

    // Category filter applied to merged list
    const filteredExpenses = useMemo(() => {
        if (!selectedCategoryId) return mergedExpenses
        return mergedExpenses.filter(e => e.category_id === selectedCategoryId)
    }, [mergedExpenses, selectedCategoryId])

    // Extra ARS from not-yet-generated recurring, per card (for all-cards view)
    const estimatedByCardId = useMemo(() => {
        const map = {}
        for (const r of recurring) {
            if (!generatedRecurringIds.has(r.id)) {
                map[r.card_id] = (map[r.card_id] ?? 0) + r.amount_usd * rate
            }
        }
        return map
    }, [recurring, generatedRecurringIds, rate])

    // Adjusted card totals (generated + estimated)
    const adjustedByCard = useMemo(() =>
        byCard.map(c => ({
            ...c,
            adjustedTotal: c.total + (estimatedByCardId[c.card_id] ?? 0),
            hasEstimates: (estimatedByCardId[c.card_id] ?? 0) > 0,
        })),
        [byCard, estimatedByCardId]
    )

    const grandTotal = adjustedByCard.reduce((sum, c) => sum + c.adjustedTotal, 0)
    const grandHasEstimates = adjustedByCard.some(c => c.hasEstimates)

    // For the selected card: generated total + estimated recurring
    const estimatedTotal = estimatedRows.reduce((sum, e) => sum + e.installment_amount, 0)
    const cardTotal = (summary?.total ?? 0) + estimatedTotal
    const cardHasEstimates = estimatedTotal > 0

    function exportCSV() {
        const cardName = cards.find(c => c.id === selectedCardId)?.name ?? 'card'
        const header = ['Fecha', 'Comercio', 'Monto Total', 'Cuotas', 'Monto Cuota', 'Nro Cuota', 'Categoria', 'Recurrente']
        const rows = filteredExpenses
            .filter(e => !e.is_estimated)
            .map(e => {
                const cat = categories.find(c => c.id === e.category_id)
                return [
                    e.purchase_date?.substring(0, 10) ?? '',
                    e.merchant,
                    e.total_amount,
                    e.total_installments,
                    e.installment_amount,
                    e.installment_number,
                    cat ? `${cat.icon} ${cat.name}` : 'Otros',
                    e.is_recurring ? 'Si' : 'No',
                ]
            })
        const csv = [header, ...rows].map(r => r.join(';')).join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `expenses-${cardName}-${month}-${year}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // ── Reusable blocks ──

    const kpiBlock = (
        <div className="bg-gray-900 text-white rounded-xl px-4 py-3 mb-4">
            <p className="text-xs opacity-60 uppercase tracking-wide">
                {selectedCardId ? cards.find(c => c.id === selectedCardId)?.name : 'Monthly total'}
            </p>
            <p className="text-2xl font-bold">
                {(selectedCardId ? cardHasEstimates : grandHasEstimates) ? '~' : ''}
                ${(selectedCardId ? cardTotal : grandTotal)
                .toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </p>
            {(selectedCardId ? cardHasEstimates : grandHasEstimates) && (
                <p className="text-xs opacity-50 mt-0.5">includes estimated recurring</p>
            )}
        </div>
    )

    const byCardBlock = !selectedCardId && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">By card</p>
            {adjustedByCard.map(c => (
                <div key={c.card_id}
                     className="flex justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4"
                     onClick={() => setSelectedCardId(c.card_id)}>
                    <span className={`text-sm ${c.adjustedTotal === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                        {c.card_name}
                    </span>
                    <span className={`text-sm font-bold ${c.adjustedTotal === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                        {c.hasEstimates ? '~' : ''}${c.adjustedTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                    </span>
                </div>
            ))}
        </div>
    )

    const exportButton = filteredExpenses.some(e => !e.is_estimated) && (
        <button
            onClick={exportCSV}
            className="w-full mt-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
        >
            Export CSV
        </button>
    )

    const categoryFilter = selectedCardId && summary && (
        <select
            value={selectedCategoryId ?? ''}
            onChange={e => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="w-full mb-3 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none bg-white"
        >
            <option value="">All categories</option>
            {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
        </select>
    )

    return (
        <div>
            {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
            ) : (
                <div className="md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-6 xl:gap-8 md:items-start">

                    {/* ── LEFT COLUMN ── */}
                    <div className="xl:col-span-2">
                        <MonthNav month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
                        <CardDropdown cards={cards} selectedId={selectedCardId} onChange={setSelectedCardId} />

                        {/* KPI + by-card — mobile only */}
                        <div className="md:hidden">
                            {kpiBlock}
                            {byCardBlock}
                        </div>

                        {selectedCardId && (
                            <>
                                {categoryFilter}

                                {/* Chart — mobile only */}
                                <div className="md:hidden">
                                    <CategoryChart expenses={mergedExpenses} categories={categories} />
                                </div>

                                <ExpenseList
                                    expenses={filteredExpenses}
                                    onSelect={setSelectedExpense}
                                    onDeleted={refresh}
                                />

                                {/* Export — mobile only */}
                                <div className="md:hidden">{exportButton}</div>
                            </>
                        )}
                    </div>

                    {/* ── RIGHT COLUMN — desktop only ── */}
                    <div className="hidden md:block">
                        {kpiBlock}
                        {byCardBlock}
                        {selectedCardId && summary && (
                            <>
                                {categoryFilter}
                                <CategoryChart expenses={mergedExpenses} categories={categories} />
                                {exportButton}
                            </>
                        )}
                    </div>
                </div>
            )}

            <ExpenseBottomSheet
                expense={selectedExpense}
                cards={cards}
                categories={categories}
                onClose={() => setSelectedExpense(null)}
                onSaved={refresh}
                onDeleted={refresh}
            />
        </div>
    )
}
