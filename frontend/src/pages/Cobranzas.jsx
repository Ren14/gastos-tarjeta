import { useState, useEffect } from 'react'
import { api } from '../api/client'

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const W_CONCEPTO = 140
const W_MONTH    = 90

function fmt(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function ClassificationMatrix({ group, months, isPast, isCurrent }) {
    const hasAnyValue = group.monthly_totals.some(v => v > 0)

    function headerCls(m) {
        if (isCurrent(m)) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
        if (isPast(m))    return 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
        return 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
    }

    return (
        <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span>{group.clasificacion_name}</span>
                {!hasAnyValue && (
                    <span className="text-xs font-normal text-gray-300 dark:text-gray-600">sin datos</span>
                )}
            </h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
                    <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                            <th
                                className="sticky left-0 z-30 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 text-left px-3 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide overflow-hidden"
                                style={{ minWidth: W_CONCEPTO, width: W_CONCEPTO }}>
                                Concepto
                            </th>
                            {months.map(m => (
                                <th key={m}
                                    className={`text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${headerCls(m)}`}
                                    style={{ minWidth: W_MONTH, width: W_MONTH }}>
                                    {MONTHS_SHORT[m - 1]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {group.categories.map(cat => (
                            <tr key={cat.category_id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                <td
                                    className="sticky left-0 z-20 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 overflow-hidden"
                                    style={{ minWidth: W_CONCEPTO, width: W_CONCEPTO }}>
                                    <div title={cat.category_name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {cat.category_name}
                                    </div>
                                </td>
                                {months.map(m => {
                                    const val  = cat.monthly_amounts[m - 1] ?? 0
                                    const past = isPast(m)
                                    const cur  = isCurrent(m)
                                    return (
                                        <td key={m}
                                            className={`px-3 py-2 text-right text-sm whitespace-nowrap tabular-nums ${
                                                cur  ? 'bg-blue-50 dark:bg-blue-900/20' :
                                                past ? 'bg-gray-50 dark:bg-gray-800' : ''
                                            } ${val > 0
                                                ? past ? 'text-gray-400 dark:text-gray-500 font-medium'
                                                       : 'text-gray-800 dark:text-gray-200 font-medium'
                                                : 'text-gray-200 dark:text-gray-700'
                                            }`}
                                            style={{ minWidth: W_MONTH, width: W_MONTH }}>
                                            {val > 0 ? `$${fmt(val)}` : ''}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}

                        {/* TOTAL row */}
                        <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                            <td
                                className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 px-3 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider overflow-hidden"
                                style={{ minWidth: W_CONCEPTO, width: W_CONCEPTO }}>
                                Total
                            </td>
                            {months.map(m => {
                                const val  = group.monthly_totals[m - 1] ?? 0
                                const past = isPast(m)
                                const cur  = isCurrent(m)
                                return (
                                    <td key={m}
                                        className={`px-3 py-2.5 text-right text-sm font-bold whitespace-nowrap tabular-nums ${
                                            cur  ? 'bg-blue-100/50 dark:bg-blue-900/30' :
                                            past ? 'bg-gray-100 dark:bg-gray-800'       : 'bg-gray-50 dark:bg-gray-800/60'
                                        } ${val > 0
                                            ? past ? 'text-gray-400 dark:text-gray-500'
                                                   : 'text-gray-900 dark:text-gray-100'
                                            : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                        style={{ minWidth: W_MONTH, width: W_MONTH }}>
                                        {val > 0 ? `$${fmt(val)}` : ''}
                                    </td>
                                )
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export function Cobranzas() {
    const now          = new Date()
    const currentYear  = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const [selectedYear, setSelectedYear] = useState(currentYear)
    const [data,         setData]         = useState(null)
    const [loading,      setLoading]      = useState(true)
    const [hidePast,     setHidePast]     = useState(true)

    const isPast    = (m) => selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth)
    const isCurrent = (m) => m === currentMonth && selectedYear === currentYear

    useEffect(() => {
        setLoading(true)
        api.getCobranzas(selectedYear)
            .then(d => setData(d))
            .finally(() => setLoading(false))
    }, [selectedYear])

    const allMonths = [1,2,3,4,5,6,7,8,9,10,11,12]
    const months    = hidePast ? allMonths.filter(m => !isPast(m)) : allMonths

    if (loading) return <p className="text-center text-gray-400 py-8 text-sm">Cargando…</p>

    const groups = data?.groups ?? []

    return (
        <div>
            {/* Controls */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="flex items-center gap-1">
                    <button onClick={() => setSelectedYear(y => y - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-lg leading-none">‹</button>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-12 text-center tabular-nums">{selectedYear}</span>
                    <button onClick={() => setSelectedYear(y => y + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-lg leading-none">›</button>
                    {selectedYear !== currentYear && (
                        <button onClick={() => setSelectedYear(currentYear)}
                            className="text-xs text-blue-600 hover:underline ml-1">Hoy</button>
                    )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={hidePast}
                        onChange={e => setHidePast(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ocultar meses anteriores</span>
                </label>
            </div>

            {groups.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
                    Sin datos de cobranzas para {selectedYear}.
                </p>
            ) : (
                groups.map(group => (
                    <ClassificationMatrix
                        key={group.clasificacion_id}
                        group={group}
                        months={months}
                        isPast={isPast}
                        isCurrent={isCurrent}
                    />
                ))
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" />
                    mes actual
                </span>
            </div>
        </div>
    )
}
