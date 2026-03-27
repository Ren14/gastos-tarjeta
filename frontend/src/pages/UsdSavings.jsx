import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

function fmtUSD(v) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function fmtARS(v) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function KPI({ label, value, sub }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
            {sub && <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>}
        </div>
    )
}

function EditableCell({ value, numeric, placeholder, onSave }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    const inputRef = useRef(null)

    useEffect(() => { setDraft(value) }, [value])
    useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

    const commit = () => {
        setEditing(false)
        const parsed = numeric ? (parseFloat(draft) || 0) : draft
        if (String(parsed) !== String(value)) onSave(parsed)
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                type={numeric ? 'number' : 'text'}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
                className="w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 rounded px-2 py-0.5 text-sm text-gray-900 dark:text-gray-100 outline-none"
                placeholder={placeholder}
            />
        )
    }

    return (
        <div
            onClick={() => setEditing(true)}
            className="cursor-text min-h-[28px] px-2 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm text-gray-900 dark:text-gray-100"
        >
            {numeric && value > 0
                ? <span className="font-mono">U$D {fmtUSD(value)}</span>
                : (value || <span className="text-gray-400 italic">{placeholder}</span>)
            }
        </div>
    )
}

export function UsdSavings() {
    const [rows, setRows] = useState([])
    const [rate, setRate] = useState(null)
    const [rateLoading, setRateLoading] = useState(true)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            api.getUsdSavings(),
            api.getDolarRate(),
        ]).then(([savings, rateData]) => {
            setRows(savings)
            setRate(rateData.venta)
            setLoading(false)
            setRateLoading(false)
        }).catch(() => {
            setLoading(false)
            setRateLoading(false)
        })
    }, [])

    const totalUSD = rows.reduce((sum, r) => sum + (r.cuanto || 0), 0)
    const totalARS = rate ? totalUSD * rate : null

    const addRow = async () => {
        const newRow = await api.createUsdSaving({ donde: '', cuanto: 0, instrumento: '' })
        setRows(prev => [...prev, newRow])
    }

    const updateRow = async (id, field, value) => {
        const row = rows.find(r => r.id === id)
        if (!row) return
        const updated = await api.updateUsdSaving(id, { ...row, [field]: value })
        setRows(prev => prev.map(r => r.id === id ? updated : r))
    }

    const deleteRow = async (id) => {
        await api.deleteUsdSaving(id)
        setRows(prev => prev.filter(r => r.id !== id))
    }

    if (loading) {
        return <div className="flex flex-col gap-4 animate-pulse">
            <div className="grid grid-cols-2 gap-4"><div className="h-24 bg-gray-100 dark:bg-gray-700 rounded-2xl" /><div className="h-24 bg-gray-100 dark:bg-gray-700 rounded-2xl" /></div>
            <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded-2xl" />
        </div>
    }

    return (
        <div className="flex flex-col gap-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4">
                <KPI
                    label="Total ahorrado"
                    value={`U$D ${fmtUSD(totalUSD)}`}
                />
                <KPI
                    label="Equivalente en ARS"
                    value={totalARS != null ? `$ ${fmtARS(totalARS)}` : '—'}
                    sub={rateLoading ? 'cargando cotización…' : rate ? `Dólar blue: $${fmtARS(rate)}` : 'cotización no disponible'}
                />
            </div>

            {/* Tabla */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                            <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 w-[35%]">Dónde</th>
                            <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 w-[30%]">Cuánto</th>
                            <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-3 w-[30%]">Instrumento</th>
                            <th className="w-[5%]" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center text-gray-400 dark:text-gray-500 py-10 text-sm italic">
                                    No hay filas. Agregá una con el botón de abajo.
                                </td>
                            </tr>
                        )}
                        {rows.map((row, i) => (
                            <tr
                                key={row.id}
                                className={`border-b border-gray-50 dark:border-gray-700/50 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20'}`}
                            >
                                <td className="px-2 py-1">
                                    <EditableCell
                                        value={row.donde}
                                        placeholder="Ej: Santander"
                                        onSave={v => updateRow(row.id, 'donde', v)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <EditableCell
                                        value={row.cuanto}
                                        numeric
                                        placeholder="0.00"
                                        onSave={v => updateRow(row.id, 'cuanto', v)}
                                    />
                                </td>
                                <td className="px-2 py-1">
                                    <EditableCell
                                        value={row.instrumento}
                                        placeholder="Ej: Plazo fijo"
                                        onSave={v => updateRow(row.id, 'instrumento', v)}
                                    />
                                </td>
                                <td className="px-2 py-1 text-center">
                                    <button
                                        onClick={() => deleteRow(row.id)}
                                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none"
                                        title="Eliminar fila"
                                    >×</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                    >
                        <span className="text-lg leading-none">+</span> Agregar fila
                    </button>
                </div>
            </div>
        </div>
    )
}
