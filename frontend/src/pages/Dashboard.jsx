import { useState, useEffect, useMemo, useRef } from 'react'
import { useCards } from '../hooks/useCards'
import { useCategories } from '../hooks/useCategories'
import { useProjection } from '../hooks/useProjection'
import { ExpenseBottomSheet } from '../components/ExpenseBottomSheet'
import { api } from '../api/client'

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Pure helpers ─────────────────────────────────────────────────────────────

function getFirstImpactDate(dateStr) {
    const y = parseInt(dateStr.substring(0, 4), 10)
    const m = parseInt(dateStr.substring(5, 7), 10)
    const d = parseInt(dateStr.substring(8, 10), 10)
    const lastDay = new Date(y, m, 0).getDate()
    const offset  = (lastDay - d) < 2 ? 2 : 1
    const dt = new Date(y, m - 1 + offset, 1)
    return { year: dt.getFullYear(), month: dt.getMonth() + 1 }
}

function getYearlyAmounts(expense, selectedYear) {
    const amounts = new Array(12).fill(0)
    const installments   = expense.installments || 1
    const perInstallment = expense.total_amount / installments

    let firstYear, firstMonth
    if (expense.recurring_id != null) {
        firstYear  = parseInt(expense.purchase_date.substring(0, 4), 10)
        firstMonth = parseInt(expense.purchase_date.substring(5, 7), 10)
    } else {
        const fi = getFirstImpactDate(expense.purchase_date)
        firstYear  = fi.year
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

// Detail matrix sticky column widths
const W_DATE     = 56
const W_MERCHANT = 160
const W_CARD     = 60
const W_MONTH    = 88

// ── Summary matrix (top section) ─────────────────────────────────────────────

function SummaryMatrix({ projection, projLoading, selectedYear, selectedCardId, currentYear, currentMonth, onCardClick }) {
    const monthMap = useMemo(() => {
        const m = {}
        for (const d of projection) m[d.month] = d
        return m
    }, [projection])

    const projCards = useMemo(() => {
        const seen = {}
        for (const d of projection) {
            for (const c of d.by_card) {
                if (!seen[c.card_id]) seen[c.card_id] = c
            }
        }
        return Object.values(seen).sort((a, b) => a.card_name.localeCompare(b.card_name))
    }, [projection])

    const isCur  = (m) => m === currentMonth && selectedYear === currentYear
    const isPast = (m) => selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth)

    function monthTotal(m) {
        const md = monthMap[m]
        return { total: md?.total ?? 0, estimated: md?.has_pending_recurring ?? false }
    }

    function cardMonthTotal(m, cardId) {
        const md = monthMap[m]
        if (!md) return { total: 0, estimated: false }
        const c = md.by_card.find(c => c.card_id === cardId)
        return { total: c?.total ?? 0, estimated: md.has_pending_recurring }
    }

    if (projLoading) {
        return <p className="text-center text-gray-400 py-6 text-sm">Cargando resumen…</p>
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                <thead>
                    <tr className="border-b-2 border-gray-200">
                        <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                            style={{ minWidth: W_DATE + W_MERCHANT + W_CARD }}>
                            Tarjeta
                        </th>
                        {MONTHS_SHORT.map((name, i) => {
                            const md = monthMap[i + 1]
                            return (
                                <th key={i}
                                    className={`text-right px-3 py-2.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                                        isCur(i + 1) ? 'bg-blue-50 text-blue-700' : isPast(i + 1) ? 'bg-gray-100 text-gray-300' : 'bg-gray-50 text-gray-400'
                                    }`}
                                    style={{ minWidth: W_MONTH }}>
                                    {name}
                                    {md?.has_pending_recurring && (
                                        <span className="text-orange-400 font-normal ml-0.5">~</span>
                                    )}
                                </th>
                            )
                        })}
                    </tr>
                </thead>
                <tbody>
                    {/* Total row */}
                    <tr className="border-b-2 border-gray-300">
                        <td className="sticky left-0 z-10 bg-gray-900 border-r border-gray-700 px-4 py-3 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">
                            Total
                        </td>
                        {MONTHS_SHORT.map((_, i) => {
                            const { total, estimated } = monthTotal(i + 1)
                            return (
                                <td key={i}
                                    className={`px-3 py-3 text-right text-sm font-bold whitespace-nowrap tabular-nums ${
                                        isCur(i + 1) ? 'bg-gray-800' : 'bg-gray-900'
                                    } ${total > 0 ? (isPast(i + 1) ? 'text-gray-500' : 'text-white') : 'text-gray-700'}`}>
                                    {total > 0 && (
                                        <>{estimated && <span className="text-orange-300">~</span>}${fmt(total)}</>
                                    )}
                                </td>
                            )
                        })}
                    </tr>

                    {/* Card rows */}
                    {projCards.map(card => {
                        const isSelected = card.card_id === selectedCardId
                        return (
                            <tr key={card.card_id}
                                onClick={() => onCardClick(card.card_id)}
                                className={`group border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                }`}>
                                <td className={`sticky left-0 z-10 border-r px-4 py-2.5 whitespace-nowrap transition-colors ${
                                    isSelected
                                        ? 'bg-blue-50 border-blue-200 group-hover:bg-blue-100'
                                        : 'bg-white border-gray-100 group-hover:bg-gray-50'
                                }`}
                                    style={{ borderLeft: `3px solid ${card.color_hex || '#9ca3af'}` }}>
                                    <span className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                                        {card.card_name}
                                    </span>
                                </td>
                                {MONTHS_SHORT.map((_, i) => {
                                    const { total, estimated } = cardMonthTotal(i + 1, card.card_id)
                                    return (
                                        <td key={i}
                                            className={`px-3 py-2.5 text-right text-sm whitespace-nowrap tabular-nums transition-colors ${
                                                isCur(i + 1)
                                                    ? isSelected ? 'bg-blue-100' : 'bg-blue-50 group-hover:bg-blue-100/60'
                                                    : isPast(i + 1) ? 'bg-gray-100' : ''
                                            } ${total === 0 ? 'text-gray-300' : isPast(i + 1) ? 'text-gray-400 font-medium' : estimated ? 'text-orange-500' : 'text-gray-800 font-medium'}`}>
                                            {total > 0 && (
                                                <>{estimated && '~'}${fmt(total)}</>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}

                    {projCards.length === 0 && (
                        <tr>
                            <td colSpan={13} className="px-4 py-8 text-center text-sm text-gray-400">
                                No hay datos para {selectedYear}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

// ── Main unified page ─────────────────────────────────────────────────────────

export function Dashboard() {
    const now          = new Date()
    const currentYear  = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const [selectedYear,    setSelectedYear]    = useState(currentYear)
    const [selectedCardId,  setSelectedCardId]  = useState(null)
    const [expenses,        setExpenses]        = useState([])
    const [recurring,       setRecurring]       = useState([])
    const [closestRate,     setClosestRate]     = useState(null)
    const [detailLoading,   setDetailLoading]   = useState(false)
    const [selectedExpense, setSelectedExpense] = useState(null)
    const [refreshKey,      setRefreshKey]      = useState(0)

    const detailRef = useRef(null)

    const { cards }                          = useCards()
    const { categories }                     = useCategories()
    const { projection, loading: projLoading } = useProjection(12, 1, selectedYear)

    // Default to first card
    useEffect(() => {
        if (cards.length > 0 && selectedCardId === null) {
            setSelectedCardId(cards[0].id)
        }
    }, [cards])

    // Fetch detail data when card or refreshKey changes
    useEffect(() => {
        if (!selectedCardId) return
        setDetailLoading(true)
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
            .finally(() => setDetailLoading(false))
    }, [selectedCardId, refreshKey])

    const rate = closestRate?.usd_to_ars ?? 0

    function refresh() { setRefreshKey(k => k + 1) }

    // Card row click → select + scroll to detail
    function handleCardRowClick(cardId) {
        setSelectedCardId(cardId)
        setTimeout(() => {
            detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
    }

    // ── Detail data preparation ───────────────────────────────────────

    const generatedByRecurringId = useMemo(() => {
        const map = {}
        for (const e of expenses) {
            if (e.recurring_id == null) continue
            if (!map[e.recurring_id]) map[e.recurring_id] = {}
            map[e.recurring_id][e.purchase_date.substring(0, 7)] = e
        }
        return map
    }, [expenses])

    const regularExpenses = useMemo(() =>
        expenses
            .filter(e => e.recurring_id == null)
            .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)),
        [expenses]
    )

    const recurringDefs = useMemo(() =>
        [...recurring].sort((a, b) => a.merchant.localeCompare(b.merchant)),
        [recurring]
    )

    function recurringAmounts(def) {
        const genByMonth = generatedByRecurringId[def.id] ?? {}
        return Array.from({ length: 12 }, (_, i) => {
            const mo  = i + 1
            const key = `${selectedYear}-${String(mo).padStart(2, '0')}`
            if (genByMonth[key]) return { value: genByMonth[key].installment_amount, estimated: false }
            const isPast = selectedYear < currentYear ||
                           (selectedYear === currentYear && mo < currentMonth)
            if (isPast) return { value: 0, estimated: false }
            return { value: def.amount_usd * rate, estimated: true }
        })
    }

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

    const isCurMonth  = (m) => m === currentMonth && selectedYear === currentYear
    const isPastMonth = (m) => selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth)

    const prestoCategoryId = useMemo(() =>
        categories.find(c => c.name.toLowerCase() === 'presto tarjeta')?.id ?? null,
        [categories]
    )

    if (!cards.length) {
        return <p className="text-center text-gray-400 py-8">Loading…</p>
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

            {/* ── TOP: Summary matrix ── */}
            <SummaryMatrix
                projection={projection}
                projLoading={projLoading}
                selectedYear={selectedYear}
                selectedCardId={selectedCardId}
                currentYear={currentYear}
                currentMonth={currentMonth}
                onCardClick={handleCardRowClick}
            />

            {/* ── BOTTOM: Expense detail matrix ── */}
            <div ref={detailRef} className="mt-6">
                {/* Detail section header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                        {selectedCard
                            ? `Detalle — ${selectedCard.name}`
                            : 'Detalle'}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                </div>

                {detailLoading ? (
                    <p className="text-center text-gray-400 py-6 text-sm">Cargando detalle…</p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                        <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
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
                                                isCurMonth(i + 1) ? 'bg-blue-50 text-blue-700' : isPastMonth(i + 1) ? 'bg-gray-100 text-gray-300' : 'bg-gray-50 text-gray-400'
                                            }`}
                                            style={{ width: W_MONTH, minWidth: W_MONTH }}>
                                            {name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {/* Total row */}
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
                                            } ${total > 0 ? (isPastMonth(i + 1) ? 'text-gray-500' : 'text-white') : 'text-gray-700'}`}>
                                            {total > 0 ? `$${fmt(total)}` : ''}
                                        </td>
                                    ))}
                                </tr>

                                {/* Recurring rows */}
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
                                                        isCurMonth(i + 1) ? 'bg-blue-50 group-hover:bg-blue-100/30' : isPastMonth(i + 1) ? 'bg-gray-100/60' : ''
                                                    } ${cell.estimated ? 'text-orange-400' : cell.value > 0 ? (isPastMonth(i + 1) ? 'text-gray-400 font-medium' : 'text-gray-800 font-medium') : ''}`}>
                                                    {cell.value > 0 ? `${cell.estimated ? '~' : ''}$${fmt(cell.value)}` : ''}
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}

                                {/* Divider */}
                                {recurringDefs.length > 0 && visibleRegular.length > 0 && (
                                    <tr><td colSpan={15} className="p-0 h-px bg-gray-200" /></tr>
                                )}

                                {/* Regular expense rows */}
                                {visibleRegular.map((e, idx) => {
                                    const amounts  = getYearlyAmounts(e, selectedYear)
                                    const isEven   = (recurringDefs.length + idx) % 2 === 0
                                    const base     = isEven ? 'bg-white' : 'bg-gray-50/50'
                                    const isPresto = prestoCategoryId !== null && e.category_id === prestoCategoryId
                                    return (
                                        <tr key={e.id}
                                            onClick={() => openEdit(e)}
                                            className="group border-b border-gray-100 last:border-0 cursor-pointer">
                                            <td className={`sticky z-10 border-r border-gray-100 px-3 py-2 text-xs text-gray-500 whitespace-nowrap tabular-nums ${base} group-hover:bg-gray-100`}
                                                style={{ left: 0 }}>
                                                {fmtDate(e.purchase_date)}
                                            </td>
                                            <td className={`sticky z-10 border-r border-gray-100 px-3 py-2 text-sm font-medium overflow-hidden ${base} group-hover:bg-gray-100 ${isPresto ? 'text-gray-500' : 'text-gray-800'}`}
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
                                                        isCurMonth(i + 1) ? 'bg-blue-50 group-hover:bg-blue-100/50' : isPastMonth(i + 1) ? 'bg-gray-100/60' : ''
                                                    } ${amount > 0 ? (isPresto || isPastMonth(i + 1) ? 'text-gray-400 font-medium' : 'text-gray-800 font-medium') : ''}`}>
                                                    {amount > 0 ? `$${fmt(amount)}` : ''}
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}

                                {/* Empty state */}
                                {visibleRegular.length === 0 && recurringDefs.length === 0 && (
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
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                    <span className="text-orange-400 font-medium">~</span>
                    estimado
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 border border-blue-200" />
                    mes actual
                </span>
                <span className="text-gray-300">· clic en tarjeta o fila para navegar/editar</span>
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
