import { useState, useEffect, useMemo } from 'react'
import { useCards } from '../hooks/useCards'
import { useCategories } from '../hooks/useCategories'
import { ExpenseBottomSheet } from '../components/ExpenseBottomSheet'
import { api } from '../api/client'

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Mirrors backend getFirstImpactMonth: given a purchase date string "YYYY-MM-DD",
// returns {year, month} of the first billing month.
function getFirstImpactDate(dateStr) {
    const y = parseInt(dateStr.substring(0, 4), 10)
    const m = parseInt(dateStr.substring(5, 7), 10) // 1-indexed
    const d = parseInt(dateStr.substring(8, 10), 10)
    const lastDay = new Date(y, m, 0).getDate() // last day of month m
    const offset = (lastDay - d) < 2 ? 2 : 1
    const dt = new Date(y, m - 1 + offset, 1)
    return { year: dt.getFullYear(), month: dt.getMonth() + 1 }
}

// Returns a 12-element array (0 = Jan … 11 = Dec) with the installment amount
// for each month of `selectedYear` that this expense impacts.
function getYearlyAmounts(expense, selectedYear) {
    const amounts = new Array(12).fill(0)
    const installments = expense.installments || 1
    const perInstallment = expense.total_amount / installments

    let firstYear, firstMonth
    if (expense.recurring_id != null) {
        // Generated recurring: impacts directly in its purchase_date month (no shift)
        firstYear = parseInt(expense.purchase_date.substring(0, 4), 10)
        firstMonth = parseInt(expense.purchase_date.substring(5, 7), 10)
    } else {
        const fi = getFirstImpactDate(expense.purchase_date)
        firstYear = fi.year
        firstMonth = fi.month
    }

    for (let i = 0; i < installments; i++) {
        let yr = firstYear
        let mo = firstMonth + i
        while (mo > 12) { mo -= 12; yr++ }
        if (yr === selectedYear) amounts[mo - 1] = perInstallment
    }
    return amounts
}

function fmt(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(dateStr) {
    if (!dateStr) return ''
    return `${dateStr.substring(8, 10)}/${dateStr.substring(5, 7)}`
}

// Sticky column pixel widths
const W_DATE     = 56
const W_MERCHANT = 160
const W_CARD     = 60
const W_MONTH    = 88

export function Dashboard({ initialYear }) {
    const now          = new Date()
    const currentYear  = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-indexed

    const [selectedYear,   setSelectedYear]   = useState(initialYear ?? currentYear)
    const [selectedCardId, setSelectedCardId] = useState(null)
    const [expenses,       setExpenses]       = useState([])
    const [recurring,      setRecurring]      = useState([])
    const [closestRate,    setClosestRate]    = useState(null)
    const [loading,        setLoading]        = useState(false)
    const [selectedExpense, setSelectedExpense] = useState(null)
    const [refreshKey,     setRefreshKey]     = useState(0)

    const { cards }      = useCards()
    const { categories } = useCategories()

    // Sync year when navigating here from Projection
    useEffect(() => {
        if (initialYear != null) setSelectedYear(initialYear)
    }, [initialYear])

    // Default to first card once cards load
    useEffect(() => {
        if (cards.length > 0 && selectedCardId === null) {
            setSelectedCardId(cards[0].id)
        }
    }, [cards])

    // Fetch expenses + recurring definitions + exchange rate
    useEffect(() => {
        if (!selectedCardId) return
        setLoading(true)
        Promise.all([
            api.getExpenses(selectedCardId),
            api.getRecurring(),
            api.getClosestExchangeRate(currentMonth, currentYear).catch(() => null),
        ])
            .then(([expData, recData, rateData]) => {
                setExpenses(expData ?? [])
                setRecurring((recData ?? []).filter(r => r.card_id === selectedCardId))
                setClosestRate(rateData)
            })
            .finally(() => setLoading(false))
    }, [selectedCardId, refreshKey])

    const rate = closestRate?.usd_to_ars ?? 0

    function refresh() { setRefreshKey(k => k + 1) }

    // ── Data preparation ──────────────────────────────────────────────

    // Generated recurring expenses grouped: recurring_id → { "YYYY-MM" → expense }
    const generatedByRecurringId = useMemo(() => {
        const map = {}
        for (const e of expenses) {
            if (e.recurring_id == null) continue
            if (!map[e.recurring_id]) map[e.recurring_id] = {}
            map[e.recurring_id][e.purchase_date.substring(0, 7)] = e
        }
        return map
    }, [expenses])

    // Non-recurring expenses sorted by date descending
    const regularExpenses = useMemo(() =>
        expenses
            .filter(e => e.recurring_id == null)
            .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)),
        [expenses]
    )

    // Recurring definitions sorted alphabetically
    const recurringDefs = useMemo(() =>
        [...recurring].sort((a, b) => a.merchant.localeCompare(b.merchant)),
        [recurring]
    )

    // For a recurring definition: per-month {value, estimated} for selectedYear
    function recurringAmounts(def) {
        const genByMonth = generatedByRecurringId[def.id] ?? {}
        return Array.from({ length: 12 }, (_, i) => {
            const mo  = i + 1
            const key = `${selectedYear}-${String(mo).padStart(2, '0')}`
            if (genByMonth[key]) {
                return { value: genByMonth[key].installment_amount, estimated: false }
            }
            const isPast = selectedYear < currentYear ||
                           (selectedYear === currentYear && mo < currentMonth)
            if (isPast) return { value: 0, estimated: false }
            return { value: def.amount_usd * rate, estimated: true }
        })
    }

    // Monthly column totals (recurring + regular)
    const monthlyTotals = useMemo(() => {
        const totals = new Array(12).fill(0)
        for (const e of regularExpenses) {
            const a = getYearlyAmounts(e, selectedYear)
            for (let i = 0; i < 12; i++) totals[i] += a[i]
        }
        for (const def of recurringDefs) {
            const a = recurringAmounts(def)
            for (let i = 0; i < 12; i++) totals[i] += a[i].value
        }
        return totals
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regularExpenses, recurringDefs, selectedYear, rate, generatedByRecurringId])

    // Regular expenses that have at least one amount in selectedYear
    const visibleRegular = useMemo(() =>
        regularExpenses.filter(e => getYearlyAmounts(e, selectedYear).some(a => a > 0)),
        [regularExpenses, selectedYear]
    )

    const selectedCard = cards.find(c => c.id === selectedCardId)
    const cardLabel    = selectedCard?.name?.split(' ')[0]?.substring(0, 7) ?? ''

    function openEdit(e) {
        setSelectedExpense({
            expense_id:         e.id,
            card_id:            e.card_id,
            merchant:           e.merchant,
            total_amount:       e.total_amount,
            total_installments: e.installments,
            installment_amount: e.installment_amount,
            purchase_date:      e.purchase_date,
            category_id:        e.category_id,
            notes:              e.notes,
        })
    }

    const isCurMonth = (m) => m === currentMonth && selectedYear === currentYear

    if (!cards.length) {
        return <p className="text-center text-gray-400 py-8">Loading...</p>
    }

    return (
        <div>
            {/* ── Controls ── */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
                <select
                    value={selectedCardId ?? ''}
                    onChange={e => setSelectedCardId(Number(e.target.value))}
                    className="px-3 py-2 border-2 border-gray-900 rounded-xl text-sm font-bold outline-none bg-white appearance-none"
                >
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <div className="flex items-center gap-1">
                    <button onClick={() => setSelectedYear(y => y - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors text-lg leading-none">‹</button>
                    <span className="text-sm font-bold text-gray-800 w-12 text-center tabular-nums">{selectedYear}</span>
                    <button onClick={() => setSelectedYear(y => y + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors text-lg leading-none">›</button>
                    {selectedYear !== currentYear && (
                        <button onClick={() => setSelectedYear(currentYear)}
                                className="text-xs text-blue-600 hover:underline ml-1">Hoy</button>
                    )}
                </div>
            </div>

            {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                    <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>

                        {/* ── HEADER ── */}
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th className="sticky z-20 bg-gray-50 border-r border-gray-200 text-left px-3 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                                    style={{ left: 0, width: W_DATE, minWidth: W_DATE }}>
                                    Fecha
                                </th>
                                <th className="sticky z-20 bg-gray-50 border-r border-gray-200 text-left px-3 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wide"
                                    style={{ left: W_DATE, width: W_MERCHANT, minWidth: W_MERCHANT }}>
                                    Comercio
                                </th>
                                <th className="sticky z-20 bg-gray-50 border-r border-gray-200 text-left px-3 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                                    style={{ left: W_DATE + W_MERCHANT, width: W_CARD, minWidth: W_CARD }}>
                                    Tarjeta
                                </th>
                                {MONTHS_SHORT.map((name, i) => (
                                    <th key={i}
                                        className={`text-right px-2 py-2.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                                            isCurMonth(i + 1)
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'bg-gray-50 text-gray-400'
                                        }`}
                                        style={{ width: W_MONTH, minWidth: W_MONTH }}>
                                        {name}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {/* ── TOTAL row ── */}
                            <tr className="border-b-2 border-gray-300">
                                <td className="sticky z-10 bg-gray-900 border-r border-gray-700 px-3 py-3 text-xs text-gray-500"
                                    style={{ left: 0 }}>—</td>
                                <td className="sticky z-10 bg-gray-900 border-r border-gray-700 px-3 py-3 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap"
                                    style={{ left: W_DATE }}>Total</td>
                                <td className="sticky z-10 bg-gray-900 border-r border-gray-700 px-3 py-3"
                                    style={{ left: W_DATE + W_MERCHANT }} />
                                {monthlyTotals.map((total, i) => (
                                    <td key={i}
                                        className={`px-2 py-3 text-right text-sm font-bold whitespace-nowrap tabular-nums ${
                                            isCurMonth(i + 1) ? 'bg-gray-800' : 'bg-gray-900'
                                        } ${total > 0 ? 'text-white' : 'text-gray-700'}`}>
                                        {total > 0 ? `$${fmt(total)}` : ''}
                                    </td>
                                ))}
                            </tr>

                            {/* ── RECURRING DEFINITION rows ── */}
                            {recurringDefs.map((def, idx) => {
                                const amounts = recurringAmounts(def)
                                const isEven  = idx % 2 === 0
                                const base    = isEven ? 'bg-white' : 'bg-orange-50/20'
                                return (
                                    <tr key={def.id} className="group border-b border-gray-100">
                                        <td className={`sticky z-10 border-r border-gray-100 px-2 py-2 text-center text-xs ${base} group-hover:bg-orange-50/60`}
                                            style={{ left: 0, borderLeft: '3px solid #fb923c' }}>
                                            🔁
                                        </td>
                                        <td className={`sticky z-10 border-r border-gray-100 px-3 py-2 text-sm font-medium text-gray-800 overflow-hidden ${base} group-hover:bg-orange-50/60`}
                                            style={{ left: W_DATE, maxWidth: W_MERCHANT }}>
                                            <span className="block truncate">{def.merchant}</span>
                                        </td>
                                        <td className={`sticky z-10 border-r border-gray-100 px-3 py-2 text-xs text-gray-400 overflow-hidden ${base} group-hover:bg-orange-50/60`}
                                            style={{ left: W_DATE + W_MERCHANT, maxWidth: W_CARD }}>
                                            <span className="block truncate">{cardLabel}</span>
                                        </td>
                                        {amounts.map((cell, i) => (
                                            <td key={i}
                                                className={`px-2 py-2 text-right text-sm whitespace-nowrap tabular-nums group-hover:bg-orange-50/60 ${
                                                    isCurMonth(i + 1) ? 'bg-blue-50 group-hover:bg-blue-100/30' : ''
                                                } ${cell.estimated
                                                    ? 'text-orange-400'
                                                    : cell.value > 0 ? 'text-gray-800 font-medium' : ''}`}>
                                                {cell.value > 0
                                                    ? `${cell.estimated ? '~' : ''}$${fmt(cell.value)}`
                                                    : ''}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}

                            {/* Divider between recurring and regular */}
                            {recurringDefs.length > 0 && visibleRegular.length > 0 && (
                                <tr><td colSpan={15} className="p-0 h-px bg-gray-200" /></tr>
                            )}

                            {/* ── REGULAR EXPENSE rows ── */}
                            {visibleRegular.map((e, idx) => {
                                const amounts = getYearlyAmounts(e, selectedYear)
                                const isEven  = (recurringDefs.length + idx) % 2 === 0
                                const base    = isEven ? 'bg-white' : 'bg-gray-50/50'
                                return (
                                    <tr key={e.id}
                                        onClick={() => openEdit(e)}
                                        className="group border-b border-gray-100 last:border-0 cursor-pointer">
                                        <td className={`sticky z-10 border-r border-gray-100 px-3 py-2 text-xs text-gray-500 whitespace-nowrap tabular-nums ${base} group-hover:bg-gray-100`}
                                            style={{ left: 0 }}>
                                            {fmtDate(e.purchase_date)}
                                        </td>
                                        <td className={`sticky z-10 border-r border-gray-100 px-3 py-2 text-sm font-medium text-gray-800 overflow-hidden ${base} group-hover:bg-gray-100`}
                                            style={{ left: W_DATE, maxWidth: W_MERCHANT }}>
                                            <span className="block truncate">{e.merchant}</span>
                                        </td>
                                        <td className={`sticky z-10 border-r border-gray-100 px-3 py-2 text-xs text-gray-400 overflow-hidden ${base} group-hover:bg-gray-100`}
                                            style={{ left: W_DATE + W_MERCHANT, maxWidth: W_CARD }}>
                                            <span className="block truncate">{cardLabel}</span>
                                        </td>
                                        {amounts.map((amount, i) => (
                                            <td key={i}
                                                className={`px-2 py-2 text-right text-sm whitespace-nowrap tabular-nums group-hover:bg-gray-100 ${
                                                    isCurMonth(i + 1)
                                                        ? 'bg-blue-50 group-hover:bg-blue-100/50'
                                                        : ''
                                                } ${amount > 0 ? 'text-gray-800 font-medium' : ''}`}>
                                                {amount > 0 ? `$${fmt(amount)}` : ''}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}

                            {/* Empty state */}
                            {visibleRegular.length === 0 && recurringDefs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={15} className="px-4 py-10 text-center text-sm text-gray-400">
                                        No hay gastos para {selectedCard?.name ?? ''} en {selectedYear}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                    <span className="text-orange-400 font-medium">~</span>
                    estimado (no generado aún)
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 border border-blue-200" />
                    mes actual
                </span>
                <span className="flex items-center gap-1 text-gray-300">
                    · clic en fila para editar
                </span>
            </div>

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
