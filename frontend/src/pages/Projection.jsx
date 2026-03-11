import { useState, useMemo } from 'react'
import { useProjection } from '../hooks/useProjection'

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt(n) {
    if (n === 0) return '0'
    return n.toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

export function Projection({ onNavigateToDashboard }) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-indexed

    const [selectedYear, setSelectedYear] = useState(currentYear)

    const { projection, loading } = useProjection(12, 1, selectedYear)

    // month (1-12) → MonthData
    const monthMap = useMemo(() => {
        const m = {}
        for (const d of projection) m[d.month] = d
        return m
    }, [projection])

    // Unique cards across all months, sorted alphabetically
    const cards = useMemo(() => {
        const seen = {}
        for (const d of projection) {
            for (const c of d.by_card) {
                if (!seen[c.card_id]) seen[c.card_id] = c
            }
        }
        return Object.values(seen).sort((a, b) => a.card_name.localeCompare(b.card_name))
    }, [projection])

    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    function monthTotal(m) {
        const md = monthMap[m]
        return { total: md?.total ?? 0, estimated: md?.has_pending_recurring ?? false }
    }

    function cardTotal(m, cardId) {
        const md = monthMap[m]
        if (!md) return { total: 0, estimated: false }
        const c = md.by_card.find(c => c.card_id === cardId)
        return { total: c?.total ?? 0, estimated: md.has_pending_recurring }
    }

    function isCurrentMonth(m) {
        return m === currentMonth && selectedYear === currentYear
    }

    if (loading) return <p className="text-center text-gray-400 py-8">Loading...</p>

    return (
        <div>
            {/* Year navigation */}
            <div className="flex items-center gap-2 mb-5">
                <button
                    onClick={() => setSelectedYear(y => y - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors text-lg leading-none"
                >
                    ‹
                </button>
                <span className="text-sm font-bold text-gray-800 w-12 text-center">{selectedYear}</span>
                <button
                    onClick={() => setSelectedYear(y => y + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors text-lg leading-none"
                >
                    ›
                </button>
                {selectedYear !== currentYear && (
                    <button
                        onClick={() => setSelectedYear(currentYear)}
                        className="text-xs text-blue-600 hover:underline ml-1"
                    >
                        Año actual
                    </button>
                )}
            </div>

            {/* Matrix table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="border-collapse w-max min-w-full">
                    <thead>
                        <tr className="border-b-2 border-gray-200">
                            {/* Corner cell */}
                            <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap"
                                style={{ minWidth: 160 }}>
                                Tarjeta
                            </th>
                            {months.map(m => {
                                const current = isCurrentMonth(m)
                                const estimated = monthMap[m]?.has_pending_recurring
                                return (
                                    <th key={m}
                                        className={`px-3 py-3 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                                            current
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'bg-gray-50 text-gray-400'
                                        }`}
                                        style={{ minWidth: 104 }}>
                                        {MONTHS_SHORT[m - 1]}
                                        {estimated && (
                                            <span className="text-orange-400 font-normal ml-0.5">~</span>
                                        )}
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {/* ── TOTAL row ── */}
                        <tr className="border-b-2 border-gray-300">
                            <td className="sticky left-0 z-10 bg-gray-900 border-r border-gray-700 px-4 py-3 font-bold text-white text-xs uppercase tracking-wider whitespace-nowrap">
                                Total
                            </td>
                            {months.map(m => {
                                const { total, estimated } = monthTotal(m)
                                const current = isCurrentMonth(m)
                                return (
                                    <td key={m}
                                        onClick={() => total > 0 && onNavigateToDashboard(m, selectedYear)}
                                        className={`px-3 py-3 text-right font-bold text-sm whitespace-nowrap ${
                                            current ? 'bg-gray-800' : 'bg-gray-900'
                                        } ${total > 0 ? 'text-white cursor-pointer hover:bg-gray-700' : 'text-gray-600'}`}>
                                        {estimated && total > 0 && (
                                            <span className="text-orange-300 mr-0.5">~</span>
                                        )}
                                        ${fmt(total)}
                                    </td>
                                )
                            })}
                        </tr>

                        {/* ── Card rows ── */}
                        {cards.map(card => (
                            <tr key={card.card_id} className="group border-b border-gray-100 last:border-0">
                                {/* Card name — sticky */}
                                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-100 px-4 py-2.5 whitespace-nowrap transition-colors"
                                    style={{ borderLeft: `3px solid ${card.color_hex || '#9ca3af'}` }}>
                                    <span className="text-sm font-medium text-gray-800">
                                        {card.card_name}
                                    </span>
                                </td>

                                {/* Month cells */}
                                {months.map(m => {
                                    const { total, estimated } = cardTotal(m, card.card_id)
                                    const current = isCurrentMonth(m)
                                    return (
                                        <td key={m}
                                            onClick={() => total > 0 && onNavigateToDashboard(m, selectedYear)}
                                            className={`px-3 py-2.5 text-right text-sm whitespace-nowrap transition-colors ${
                                                current
                                                    ? 'bg-blue-50 group-hover:bg-blue-100/60'
                                                    : 'group-hover:bg-gray-50'
                                            } ${total === 0
                                                ? 'text-gray-300'
                                                : 'text-gray-900 cursor-pointer hover:text-blue-700 font-medium'
                                            }`}>
                                            {estimated && total > 0 && (
                                                <span className="text-orange-500 mr-0.5">~</span>
                                            )}
                                            {total === 0 ? '$0' : `$${fmt(total)}`}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}

                        {/* Empty state */}
                        {cards.length === 0 && (
                            <tr>
                                <td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-400">
                                    No hay datos para {selectedYear}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                    <span className="text-orange-400 font-medium">~</span>
                    incluye estimación de recurrentes
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 border border-blue-200" />
                    mes actual
                </span>
            </div>
        </div>
    )
}
