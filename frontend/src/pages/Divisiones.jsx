import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

const NOW = new Date()
const CUR_MONTH = NOW.getMonth() + 1
const CUR_YEAR  = NOW.getFullYear()

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const COLORS = [
    { value: '',      label: '—',     bg: 'bg-white dark:bg-gray-800',        ring: 'ring-gray-300 dark:ring-gray-600' },
    { value: 'green', label: '🟢',    bg: 'bg-green-100 dark:bg-green-900/40', ring: 'ring-green-400' },
    { value: 'blue',  label: '🔵',    bg: 'bg-blue-100 dark:bg-blue-900/40',   ring: 'ring-blue-400' },
    { value: 'gray',  label: '⚫',    bg: 'bg-gray-200 dark:bg-gray-700',      ring: 'ring-gray-400' },
]

function colorBg(color) {
    const c = COLORS.find(c => c.value === (color || ''))
    return c ? c.bg : ''
}

// ── Color picker cell ────────────────────────────────────────────────────────
function SplitCell({ color, onSave, isPast }) {
    const [open, setOpen] = useState(false)

    function pick(val) {
        setOpen(false)
        if (val !== color) onSave(val)
    }

    return (
        <td className={`px-2 py-2 text-center relative ${isPast ? 'opacity-60' : ''}`}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 transition-colors ${colorBg(color)}`}
            />
            {open && (
                <div className="absolute z-20 top-8 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 flex gap-1">
                    {COLORS.map(c => (
                        <button
                            key={c.value}
                            onClick={() => pick(c.value)}
                            title={c.label}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${c.bg} ${color === c.value ? `ring-2 ${c.ring}` : 'border-gray-200 dark:border-gray-600'}`}
                        />
                    ))}
                </div>
            )}
        </td>
    )
}

// ── Matrix view ──────────────────────────────────────────────────────────────
function SplitMatrix({ splitId, onBack }) {
    const [year, setYear]         = useState(CUR_YEAR)
    const [data, setData]         = useState(null)
    const [loading, setLoading]   = useState(true)
    const [hidePast, setHidePast] = useState(true)

    const load = useCallback(() => {
        setLoading(true)
        api.getSplitMatrix(splitId, year)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [splitId, year])

    useEffect(() => { load() }, [load])

    function handleSave(participantId, month, color) {
        api.saveSplitEntry(splitId, {
            participant_id: participantId,
            month,
            year,
            color,
        }).then(load)
    }

    if (loading || !data) return (
        <p className="text-center text-gray-400 dark:text-gray-500 py-12">Cargando…</p>
    )

    const { split, participants, months } = data

    const displayMonths = hidePast
        ? months.filter(m => !(m.year < CUR_YEAR || (m.year === CUR_YEAR && m.month < CUR_MONTH)))
        : months

    const isPast = (m) => m.year < CUR_YEAR || (m.year === CUR_YEAR && m.month < CUR_MONTH)
    const isCurrent = (m) => m.month === CUR_MONTH && m.year === CUR_YEAR

    const fmt = (n) => n == null ? '' : Math.round(n).toLocaleString('es-AR')

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div>
                    <button
                        onClick={onBack}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2 flex items-center gap-1"
                    >
                        ‹ Volver
                    </button>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{split.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {split.recurring_name} ·{' '}
                        {split.currency === 'ARS'
                            ? `ARS $${fmt(split.amount_ars)}`
                            : `USD $${split.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        }
                        {' · '}{participants.length} participantes
                    </p>
                </div>

                {/* Year selector */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setYear(y => y - 1)}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-xl px-2"
                    >‹</button>
                    <span className="font-bold text-gray-900 dark:text-gray-100 w-12 text-center">{year}</span>
                    <button
                        onClick={() => setYear(y => y + 1)}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-xl px-2"
                    >›</button>
                </div>
            </div>

            {/* Hide past toggle */}
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={hidePast}
                    onChange={e => setHidePast(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600"
                />
                Ocultar meses anteriores
            </label>

            {/* Matrix */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="border-collapse text-sm w-full">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 px-4 py-2.5 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap"
                                style={{ minWidth: 160 }}>
                                Participante
                            </th>
                            {displayMonths.map(m => (
                                <th key={m.month}
                                    className={`px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                                        isCurrent(m)
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : isPast(m)
                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
                                    }`}
                                    style={{ minWidth: 90 }}>
                                    {MONTH_NAMES[m.month - 1]}
                                    {m.is_estimated && <span className="text-orange-400 ml-0.5">~</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map(p => (
                            <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 group">
                                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 border-r border-gray-100 dark:border-gray-800 px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap transition-colors">
                                    {p.name}
                                </td>
                                {displayMonths.map(m => {
                                    const entry = m.entries.find(e => e.participant_id === p.id)
                                    const color = entry?.color || ''
                                    const past = isPast(m)
                                    const cur = isCurrent(m)

                                    return (
                                        <td key={m.month}
                                            className={`px-3 py-2 text-center whitespace-nowrap ${
                                                colorBg(color) ||
                                                (cur ? 'bg-blue-50/50 dark:bg-blue-900/10'
                                                    : past ? 'bg-gray-50 dark:bg-gray-800/60'
                                                        : 'bg-white dark:bg-gray-900')
                                            }`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={`text-xs font-bold tabular-nums ${
                                                    m.is_estimated
                                                        ? 'text-orange-500 dark:text-orange-400'
                                                        : past
                                                            ? 'text-gray-400 dark:text-gray-500'
                                                            : 'text-gray-800 dark:text-gray-200'
                                                }`}>
                                                    {m.is_estimated ? '~' : ''}${fmt(m.per_person_ars)}
                                                </span>
                                                {m.per_person_usd != null && (
                                                    <span className="text-[10px] text-green-600 dark:text-green-400 tabular-nums">
                                                        (${m.per_person_usd.toFixed(2)})
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        const idx = COLORS.findIndex(c => c.value === color)
                                                        const next = COLORS[(idx + 1) % COLORS.length]
                                                        handleSave(p.id, m.month, next.value)
                                                    }}
                                                    className={`mt-0.5 w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 transition-colors ${colorBg(color)}`}
                                                    title="Cambiar color"
                                                />
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}

                        {/* Total row */}
                        <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-900">
                            <td className="sticky left-0 z-10 bg-gray-900 border-r border-gray-700 px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">
                                Total
                            </td>
                            {displayMonths.map(m => (
                                <td key={m.month} className="px-3 py-2.5 text-center bg-gray-900">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className={`text-xs font-bold tabular-nums ${
                                            m.is_estimated ? 'text-orange-300' : 'text-white'
                                        }`}>
                                            {m.is_estimated ? '~' : ''}${fmt(m.amount_ars)}
                                        </span>
                                        {m.amount_usd != null && (
                                            <span className="text-[10px] text-green-400 tabular-nums">
                                                (${m.amount_usd.toFixed(2)})
                                            </span>
                                        )}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ── Create split form ─────────────────────────────────────────────────────────
function CreateSplitForm({ recurringList, onCreated, onCancel }) {
    const [recurringId, setRecurringId] = useState(recurringList[0]?.id ?? '')
    const [name, setName]               = useState(recurringList[0]?.merchant ?? '')
    const [participants, setParticipants] = useState(['', ''])
    const [loading, setLoading]         = useState(false)
    const [error, setError]             = useState(null)

    function selectRecurring(id) {
        setRecurringId(id)
        const re = recurringList.find(r => r.id === Number(id))
        if (re) setName(re.merchant)
    }

    function setParticipant(i, val) {
        setParticipants(ps => ps.map((p, idx) => idx === i ? val : p))
    }

    function addParticipant() {
        setParticipants(ps => [...ps, ''])
    }

    function removeParticipant(i) {
        if (participants.length <= 2) return
        setParticipants(ps => ps.filter((_, idx) => idx !== i))
    }

    async function handleCreate() {
        const names = participants.map(p => p.trim()).filter(Boolean)
        if (!recurringId || !name.trim() || names.length < 2) {
            setError('Completá todos los campos y agregá al menos 2 participantes')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const res = await api.createSplit({
                recurring_id: Number(recurringId),
                name: name.trim(),
                participant_names: names,
            })
            onCreated(res.id)
        } catch (e) {
            setError('Error al crear la división')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 max-w-md">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Nueva división</h3>

            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gasto recurrente</label>
                <select
                    value={recurringId}
                    onChange={e => selectRecurring(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm dark:bg-gray-700 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-400 outline-none"
                >
                    {recurringList.map(r => (
                        <option key={r.id} value={r.id}>
                            {r.merchant} ({r.currency === 'ARS' ? `ARS $${r.amount_ars ?? 0}` : `USD $${r.amount_usd}`})
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nombre de la división</label>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm dark:bg-gray-700 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-400 outline-none"
                />
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Participantes</label>
                <div className="mt-1 space-y-2">
                    {participants.map((p, i) => (
                        <div key={i} className="flex gap-2">
                            <input
                                value={p}
                                onChange={e => setParticipant(i, e.target.value)}
                                placeholder={`Participante ${i + 1}`}
                                className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-sm dark:bg-gray-700 dark:text-gray-100 focus:border-gray-900 dark:focus:border-gray-400 outline-none"
                            />
                            {participants.length > 2 && (
                                <button
                                    onClick={() => removeParticipant(i)}
                                    className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 px-2"
                                >×</button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={addParticipant}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1"
                    >
                        + Agregar participante
                    </button>
                </div>
            </div>

            {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}

            <div className="flex gap-3">
                <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
                >
                    {loading ? 'Creando…' : 'Crear'}
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-400"
                >
                    Cancelar
                </button>
            </div>
        </div>
    )
}

// ── Split list ────────────────────────────────────────────────────────────────
function SplitList({ splits, onSelect, onNew }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Divisiones</h2>
                <button
                    onClick={onNew}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold rounded-xl"
                >
                    + Nueva división
                </button>
            </div>

            {splits.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-12">
                    No hay divisiones todavía
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {splits.map(s => (
                        <button
                            key={s.id}
                            onClick={() => onSelect(s.id)}
                            className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                        >
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{s.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {s.recurring_name} ·{' '}
                                {s.currency === 'ARS'
                                    ? `ARS $${Math.round(s.amount_ars ?? 0).toLocaleString('es-AR')}`
                                    : `USD $${s.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                }
                                {' · '}{s.participant_count} participantes
                            </p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Divisiones() {
    const [view, setView]                 = useState('list') // 'list' | 'create' | 'matrix'
    const [splits, setSplits]             = useState([])
    const [recurringList, setRecurringList] = useState([])
    const [selectedId, setSelectedId]     = useState(null)
    const [loading, setLoading]           = useState(true)

    useEffect(() => {
        Promise.all([api.getSplits(), api.getRecurring()])
            .then(([s, r]) => {
                setSplits(s)
                setRecurringList(r)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    function reloadSplits() {
        api.getSplits().then(setSplits).catch(console.error)
    }

    if (loading) return <p className="text-center text-gray-400 dark:text-gray-500 py-12">Cargando…</p>

    if (view === 'matrix' && selectedId != null) {
        return (
            <SplitMatrix
                splitId={selectedId}
                onBack={() => { setView('list'); setSelectedId(null) }}
            />
        )
    }

    if (view === 'create') {
        return (
            <CreateSplitForm
                recurringList={recurringList}
                onCreated={(id) => {
                    reloadSplits()
                    setSelectedId(id)
                    setView('matrix')
                }}
                onCancel={() => setView('list')}
            />
        )
    }

    return (
        <SplitList
            splits={splits}
            onSelect={(id) => { setSelectedId(id); setView('matrix') }}
            onNew={() => setView('create')}
        />
    )
}
