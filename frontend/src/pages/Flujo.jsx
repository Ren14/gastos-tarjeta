import { useState, useEffect, useMemo, useRef } from 'react'
import { api } from '../api/client'

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const W_DETAIL = 200
const W_MONTH  = 100

const COLOR_OPTIONS = [
    { value: null,    dot: 'bg-gray-800' },
    { value: 'green', dot: 'bg-green-500' },
    { value: 'blue',  dot: 'bg-blue-500' },
    { value: 'gray',  dot: 'bg-gray-300' },
]

function fmt(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Category management modal ─────────────────────────────────────────────────

function CategoryModal({ categories, onClose, onSaved }) {
    const [name, setName] = useState('')
    const [type, setType] = useState('income')
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editName, setEditName] = useState('')
    const [editType, setEditType] = useState('')

    async function handleCreate(e) {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        try {
            await api.createCashflowCategory({ name: name.trim(), type, sort_order: categories.length })
            setName('')
            onSaved()
        } finally {
            setSaving(false)
        }
    }

    async function handleUpdate(cat) {
        await api.updateCashflowCategory(cat.id, {
            name: editName.trim() || cat.name,
            type: editType || cat.type,
            sort_order: cat.sort_order,
            active: true,
        })
        setEditingId(null)
        onSaved()
    }

    async function handleDeactivate(cat) {
        await api.updateCashflowCategory(cat.id, {
            name: cat.name,
            type: cat.type,
            sort_order: cat.sort_order,
            active: false,
        })
        onSaved()
    }

    const income  = categories.filter(c => c.type === 'income')
    const expense = categories.filter(c => c.type === 'expense')

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-gray-900">Categorías de Flujo</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
                </div>

                {/* Create form */}
                <form onSubmit={handleCreate} className="flex gap-2 mb-5">
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Nueva categoría…"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400"
                    />
                    <select value={type} onChange={e => setType(e.target.value)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-sm outline-none">
                        <option value="income">Ingreso</option>
                        <option value="expense">Egreso</option>
                    </select>
                    <button type="submit" disabled={saving || !name.trim()}
                        className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-40">
                        +
                    </button>
                </form>

                {/* Lists */}
                {[['income', 'Ingresos', income], ['expense', 'Egresos', expense]].map(([t, label, cats]) => (
                    <div key={t} className="mb-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
                        {cats.map(cat => (
                            <div key={cat.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                                {editingId === cat.id ? (
                                    <>
                                        <input value={editName} onChange={e => setEditName(e.target.value)}
                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm outline-none"
                                            autoFocus />
                                        <button onClick={() => handleUpdate(cat)}
                                            className="text-xs text-green-600 font-medium">✓</button>
                                        <button onClick={() => setEditingId(null)}
                                            className="text-xs text-gray-400">✕</button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
                                        <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditType(cat.type) }}
                                            className="text-xs text-gray-400 hover:text-gray-700">✏</button>
                                        <button onClick={() => handleDeactivate(cat)}
                                            className="text-xs text-red-400 hover:text-red-600">✕</button>
                                    </>
                                )}
                            </div>
                        ))}
                        {cats.length === 0 && (
                            <p className="text-xs text-gray-300 py-1">Sin categorías</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({ value, color, onSave, isPast, isCurrent }) {
    const [editing,   setEditing]   = useState(false)
    const [inputVal,  setInputVal]  = useState('')
    const [editColor, setEditColor] = useState(null)
    const inputRef = useRef(null)

    function startEdit() {
        setInputVal(value > 0 ? String(Math.round(value)) : '')
        setEditColor(color ?? null)
        setEditing(true)
    }

    useEffect(() => {
        if (editing) inputRef.current?.focus()
    }, [editing])

    function commit() {
        const n = parseFloat(inputVal.replace(/\./g, '').replace(',', '.')) || 0
        onSave(n, editColor)
        setEditing(false)
    }

    function handleKey(e) {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
    }

    function getTextCls() {
        if (color === 'green') return 'text-green-600 font-medium'
        if (color === 'blue')  return 'text-blue-600 font-medium'
        if (color === 'gray')  return 'text-gray-400 font-medium'
        return isPast ? 'text-gray-300' : value > 0 ? 'text-gray-800 font-medium' : 'text-gray-300'
    }

    const cellBg = isCurrent ? 'bg-blue-50' : isPast ? 'bg-gray-50' : ''

    if (editing) {
        return (
            <td className={`px-2 py-1 whitespace-nowrap align-top ${cellBg}`}
                style={{ minWidth: W_MONTH }}>
                <div className="flex flex-col items-end gap-1.5 pt-0.5">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onBlur={commit}
                        onKeyDown={handleKey}
                        className="w-full text-right text-sm font-medium outline-none border-b-2 border-blue-400 bg-transparent tabular-nums"
                        placeholder="0"
                    />
                    <div className="flex gap-1 justify-end pb-0.5">
                        {COLOR_OPTIONS.map(opt => (
                            <button key={String(opt.value)}
                                type="button"
                                onMouseDown={ev => { ev.preventDefault(); setEditColor(opt.value) }}
                                className={`w-3.5 h-3.5 rounded-full ${opt.dot} transition-opacity ${editColor === opt.value ? 'ring-2 ring-offset-1 ring-blue-500 opacity-100' : 'opacity-50 hover:opacity-100'}`}
                            />
                        ))}
                    </div>
                </div>
            </td>
        )
    }

    return (
        <td
            onClick={startEdit}
            className={`px-2 py-1.5 text-right text-sm whitespace-nowrap tabular-nums group/cell ${cellBg} ${getTextCls()} cursor-pointer hover:bg-blue-50/60`}
            style={{ minWidth: W_MONTH }}>
            {value > 0
                ? `$${fmt(value)}`
                : <span className="invisible group-hover/cell:visible text-gray-300 text-xs select-none">+</span>
            }
        </td>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Flujo() {
    const now          = new Date()
    const currentYear  = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const [selectedYear, setSelectedYear] = useState(currentYear)
    const [categories,   setCategories]   = useState([])
    const [entries,      setEntries]      = useState([])
    const [cardTotals,   setCardTotals]   = useState([])  // [{month, total}]
    const [showModal,    setShowModal]    = useState(false)
    const [loading,      setLoading]      = useState(true)

    const isCurrent = (m) => m === currentMonth && selectedYear === currentYear
    const isPast    = (m) => selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth)

    async function loadAll() {
        setLoading(true)
        try {
            const [cats, ents, cards] = await Promise.all([
                api.getCashflowCategories(),
                api.getCashflowEntries(selectedYear),
                api.getCardTotals(selectedYear),
            ])
            setCategories(cats ?? [])
            setEntries(ents ?? [])
            setCardTotals(cards ?? [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadAll() }, [selectedYear])

    async function handleSave(categoryId, month, amount, color) {
        await api.saveCashflowEntry({ category_id: categoryId, month, year: selectedYear, amount, color: color ?? null, notes: '' })
        // Optimistic local update
        setEntries(prev => {
            const idx = prev.findIndex(e => e.category_id === categoryId && e.month === month && e.year === selectedYear)
            if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = { ...copy[idx], amount, color: color ?? null }
                return copy
            }
            return [...prev, { id: Date.now(), category_id: categoryId, month, year: selectedYear, amount, color: color ?? null, notes: '' }]
        })
    }

    // Build lookup: entryMap[categoryId][month] = { amount, color }
    const entryMap = useMemo(() => {
        const m = {}
        for (const e of entries) {
            if (!m[e.category_id]) m[e.category_id] = {}
            m[e.category_id][e.month] = { amount: e.amount, color: e.color ?? null }
        }
        return m
    }, [entries])

    // cardTotals as map indexed by month (1-12)
    const cardTotalByMonth = useMemo(() => {
        const t = {}
        for (const ct of cardTotals) t[ct.month] = { total: ct.total, pending: ct.has_pending_recurring ?? false }
        return t
    }, [cardTotals])

    const incomeCategories  = categories.filter(c => c.type === 'income')
    const expenseCategories = categories.filter(c => c.type === 'expense')

    // Per-month totals
    const incomeTotals  = useMemo(() => Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        return incomeCategories.reduce((sum, cat) => sum + (entryMap[cat.id]?.[m]?.amount ?? 0), 0)
    }), [incomeCategories, entryMap])

    const expenseTotals = useMemo(() => Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const catSum = expenseCategories.reduce((sum, cat) => sum + (entryMap[cat.id]?.[m]?.amount ?? 0), 0)
        return catSum + (cardTotalByMonth[m]?.total ?? 0)
    }), [expenseCategories, entryMap, cardTotalByMonth])

    const disponible = useMemo(() =>
        incomeTotals.map((inc, i) => inc - expenseTotals[i]),
        [incomeTotals, expenseTotals]
    )

    const months = [1,2,3,4,5,6,7,8,9,10,11,12]

    function headerCls(m) {
        if (isCurrent(m)) return 'bg-blue-50 text-blue-700'
        if (isPast(m))    return 'bg-gray-100 text-gray-300'
        return 'bg-gray-50 text-gray-400'
    }

    if (loading) return <p className="text-center text-gray-400 py-8 text-sm">Cargando…</p>

    return (
        <div>
            {/* Controls */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
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
                <button onClick={() => setShowModal(true)}
                    className="ml-auto px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    Categorías
                </button>
            </div>

            {/* Matrix */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                    <thead>
                        {/* Month header row */}
                        <tr className="border-b-2 border-gray-200">
                            <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                                style={{ minWidth: W_DETAIL }}>
                                Concepto
                            </th>
                            {months.map(m => (
                                <th key={m}
                                    className={`text-right px-3 py-2.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${headerCls(m)}`}
                                    style={{ minWidth: W_MONTH }}>
                                    {MONTHS_SHORT[m-1]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Disponible row */}
                        <tr className="border-b-2 border-gray-300">
                            <td className="sticky left-0 z-10 bg-gray-900 border-r border-gray-700 px-4 py-3 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">
                                Disponible
                            </td>
                            {disponible.map((val, i) => {
                                const m = i + 1
                                const positive = val > 0
                                const isZero   = val === 0
                                const past     = isPast(m)
                                return (
                                    <td key={m}
                                        className={`px-3 py-3 text-right text-sm font-bold whitespace-nowrap tabular-nums ${
                                            isCurrent(m) ? 'bg-gray-800' : 'bg-gray-900'
                                        } ${isZero ? 'text-gray-700' : past ? 'text-gray-500' : positive ? 'text-green-400' : 'text-red-400'}`}
                                        style={{ minWidth: W_MONTH }}>
                                        {!isZero && `${positive ? '+' : ''}$${fmt(val)}`}
                                    </td>
                                )
                            })}
                        </tr>

                        {/* ── INCOME section ── */}
                        {/* Total Ingresos row */}
                        <tr className="border-b border-gray-200 bg-green-50/40">
                            <td className="sticky left-0 z-10 bg-green-50 border-r border-gray-200 px-4 py-2.5 text-xs font-bold text-green-800 uppercase tracking-wider whitespace-nowrap">
                                Total Ingresos
                            </td>
                            {incomeTotals.map((total, i) => {
                                const m = i + 1
                                return (
                                    <td key={m}
                                        className={`px-3 py-2.5 text-right text-sm font-bold whitespace-nowrap tabular-nums ${
                                            isCurrent(m) ? 'bg-green-100/50' : isPast(m) ? 'bg-gray-50' : 'bg-green-50/40'
                                        } ${total > 0 ? (isPast(m) ? 'text-gray-400' : 'text-green-700') : 'text-gray-300'}`}
                                        style={{ minWidth: W_MONTH }}>
                                        {total > 0 ? `$${fmt(total)}` : ''}
                                    </td>
                                )
                            })}
                        </tr>

                        {/* Income category rows */}
                        {incomeCategories.map(cat => (
                            <tr key={cat.id} className="group border-b border-gray-100 last:border-0">
                                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-100 px-4 py-2 text-sm text-gray-700 whitespace-nowrap transition-colors"
                                    style={{ paddingLeft: 24 }}>
                                    {cat.name}
                                </td>
                                {months.map(m => (
                                    <EditableCell
                                        key={m}
                                        value={entryMap[cat.id]?.[m]?.amount ?? 0}
                                        color={entryMap[cat.id]?.[m]?.color ?? null}
                                        onSave={(amount, color) => handleSave(cat.id, m, amount, color)}
                                        isPast={isPast(m)}
                                        isCurrent={isCurrent(m)}
                                    />
                                ))}
                            </tr>
                        ))}

                        {incomeCategories.length === 0 && (
                            <tr>
                                <td colSpan={13} className="px-4 py-3 text-xs text-gray-300 text-center">
                                    Sin categorías de ingreso — agregar desde "Categorías"
                                </td>
                            </tr>
                        )}

                        {/* Separator */}
                        <tr><td colSpan={13} className="p-0 h-px bg-gray-200" /></tr>

                        {/* ── EXPENSE section ── */}
                        {/* Total Egresos row */}
                        <tr className="border-b border-gray-200 bg-red-50/30">
                            <td className="sticky left-0 z-10 bg-red-50/60 border-r border-gray-200 px-4 py-2.5 text-xs font-bold text-red-800 uppercase tracking-wider whitespace-nowrap">
                                Total Egresos
                            </td>
                            {expenseTotals.map((total, i) => {
                                const m = i + 1
                                return (
                                    <td key={m}
                                        className={`px-3 py-2.5 text-right text-sm font-bold whitespace-nowrap tabular-nums ${
                                            isCurrent(m) ? 'bg-red-100/40' : isPast(m) ? 'bg-gray-50' : 'bg-red-50/30'
                                        } ${total > 0 ? (isPast(m) ? 'text-gray-400' : 'text-red-700') : 'text-gray-300'}`}
                                        style={{ minWidth: W_MONTH }}>
                                        {total > 0 ? `$${fmt(total)}` : ''}
                                    </td>
                                )
                            })}
                        </tr>

                        {/* Tarjetas de crédito — read-only */}
                        <tr className="group border-b border-gray-100">
                            <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-100 px-4 py-2 text-sm text-gray-600 whitespace-nowrap transition-colors"
                                style={{ paddingLeft: 24 }}>
                                💳 Tarjetas de crédito
                            </td>
                            {months.map(m => {
                                const entry   = cardTotalByMonth[m]
                                const total   = entry?.total ?? 0
                                const pending = entry?.pending ?? false
                                const past    = isPast(m)
                                const cur     = isCurrent(m)
                                const textCls = total > 0
                                    ? past    ? 'text-gray-300 font-medium'
                                    : pending ? 'text-orange-500 font-medium'
                                    :           'text-gray-600 font-medium'
                                    : 'text-gray-200'
                                return (
                                    <td key={m}
                                        className={`px-2 py-2 text-right text-sm whitespace-nowrap tabular-nums ${
                                            cur ? 'bg-blue-50' : past ? 'bg-gray-50' : ''
                                        } ${textCls}`}
                                        style={{ minWidth: W_MONTH }}>
                                        {total > 0 ? `${pending ? '~' : ''}$${fmt(total)}` : ''}
                                    </td>
                                )
                            })}
                        </tr>

                        {/* Expense category rows */}
                        {expenseCategories.map(cat => (
                            <tr key={cat.id} className="group border-b border-gray-100 last:border-0">
                                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-100 px-4 py-2 text-sm text-gray-700 whitespace-nowrap transition-colors"
                                    style={{ paddingLeft: 24 }}>
                                    {cat.name}
                                </td>
                                {months.map(m => (
                                    <EditableCell
                                        key={m}
                                        value={entryMap[cat.id]?.[m]?.amount ?? 0}
                                        color={entryMap[cat.id]?.[m]?.color ?? null}
                                        onSave={(amount, color) => handleSave(cat.id, m, amount, color)}
                                        isPast={isPast(m)}
                                        isCurrent={isCurrent(m)}
                                    />
                                ))}
                            </tr>
                        ))}

                        {expenseCategories.length === 0 && (
                            <tr>
                                <td colSpan={13} className="px-4 py-3 text-xs text-gray-300 text-center">
                                    Sin categorías de egreso — agregar desde "Categorías"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 border border-blue-200" />
                    mes actual
                </span>
                <span className="flex items-center gap-1 text-orange-400">
                    ~$ estimado (recurrentes pendientes)
                </span>
                <span className="text-gray-300">· clic en celda para editar</span>
            </div>

            {/* Category modal */}
            {showModal && (
                <CategoryModal
                    categories={categories}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); loadAll() }}
                />
            )}
        </div>
    )
}
