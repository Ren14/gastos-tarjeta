import { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useCards } from '../hooks/useCards'
import { useCategories } from '../hooks/useCategories'
import { useMonthlySummary } from '../hooks/useMonthlySummary'
import { MonthNav } from '../components/MonthNav'
import { CardDropdown } from '../components/CardDropdown'
import { ExpenseList } from '../components/ExpenseList'
import { ExpenseBottomSheet } from '../components/ExpenseBottomSheet'

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

    const { cards } = useCards()
    const { categories } = useCategories()
    const { summary, byCard, loading } = useMonthlySummary(month, year, selectedCardId, refreshKey)

    const grandTotal = byCard.reduce((sum, c) => sum + c.total, 0)

    // Reset category filter when month or card changes
    useEffect(() => {
        setSelectedCategoryId(null)
    }, [month, year, selectedCardId])

    function refresh() {
        setRefreshKey(k => k + 1)
    }

    const filteredExpenses = useMemo(() => {
        if (!summary?.expenses) return []
        if (!selectedCategoryId) return summary.expenses
        return summary.expenses.filter(e => e.category_id === selectedCategoryId)
    }, [summary?.expenses, selectedCategoryId])

    function exportCSV() {
        const cardName = cards.find(c => c.id === selectedCardId)?.name ?? 'card'
        const header = ['Fecha', 'Comercio', 'Monto Total', 'Cuotas', 'Monto Cuota', 'Nro Cuota', 'Categoria', 'Recurrente']
        const rows = filteredExpenses.map(e => {
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

    return (
        <div>
            <MonthNav month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
            <CardDropdown cards={cards} selectedId={selectedCardId} onChange={setSelectedCardId} />

            {selectedCardId && (
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
            )}

            {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
            ) : (
                <>
                    <div className="bg-gray-900 text-white rounded-xl px-4 py-3 mb-4">
                        <p className="text-xs opacity-60 uppercase tracking-wide">
                            {selectedCardId ? cards.find(c => c.id === selectedCardId)?.name : 'Monthly total'}
                        </p>
                        <p className="text-2xl font-bold">
                            ${(selectedCardId ? (summary?.total ?? 0) : grandTotal)
                            .toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </p>
                    </div>

                    {!selectedCardId && (
                        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">By card</p>
                            {byCard.map(c => (
                                <div key={c.card_id}
                                     className="flex justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4"
                                     onClick={() => setSelectedCardId(c.card_id)}>
                  <span className={`text-sm ${c.total === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                    {c.card_name}
                  </span>
                                    <span className={`text-sm font-bold ${c.total === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                    ${c.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedCardId && summary && (
                        <>
                            <CategoryChart expenses={summary.expenses} categories={categories} />
                            {filteredExpenses.length > 0 && (
                                <button
                                    onClick={exportCSV}
                                    className="w-full mb-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
                                >
                                    Export CSV
                                </button>
                            )}
                            <ExpenseList
                                expenses={filteredExpenses}
                                onSelect={setSelectedExpense}
                                onDeleted={refresh}
                            />
                        </>
                    )}
                </>
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