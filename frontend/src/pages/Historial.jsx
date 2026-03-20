import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

const ENTITY_OPTIONS = [
    { value: '',               label: 'Todos' },
    { value: 'expense',        label: 'Gastos' },
    { value: 'recurring',      label: 'Recurrentes' },
    { value: 'exchange_rate',  label: 'Cotizaciones' },
    { value: 'cashflow_entry', label: 'Flujo' },
    { value: 'card',           label: 'Tarjetas' },
]

const ACTION_ICONS = {
    create: { icon: '➕', cls: 'text-green-600 dark:text-green-400' },
    update: { icon: '✏️', cls: 'text-blue-600 dark:text-blue-400' },
    delete: { icon: '🗑️', cls: 'text-red-600 dark:text-red-400' },
}

function relativeTime(dateStr) {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now - date
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr  = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffSec < 60)  return 'hace un momento'
    if (diffMin < 60)  return `hace ${diffMin} min`
    if (diffHr  < 24)  return `hace ${diffHr}h`
    if (diffDay < 7)   return `hace ${diffDay}d`
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function absoluteTime(dateStr) {
    return new Date(dateStr).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

const PAGE_SIZE = 50

export function Historial() {
    const [items,      setItems]      = useState([])
    const [total,      setTotal]      = useState(0)
    const [page,       setPage]       = useState(0)
    const [entityType, setEntityType] = useState('')
    const [loading,    setLoading]    = useState(false)
    const [error,      setError]      = useState(null)

    const load = useCallback(async (pg, et) => {
        setLoading(true)
        setError(null)
        try {
            const data = await api.getAuditLog(PAGE_SIZE, pg * PAGE_SIZE, et)
            setItems(data.items ?? [])
            setTotal(data.total ?? 0)
        } catch (e) {
            setError('Error al cargar el historial')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load(page, entityType)
    }, [page, entityType, load])

    function handleEntityChange(e) {
        setEntityType(e.target.value)
        setPage(0)
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={entityType}
                    onChange={handleEntityChange}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                >
                    {ENTITY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {total} registro{total !== 1 ? 's' : ''}
                </span>
                <button
                    onClick={() => load(page, entityType)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                >
                    Actualizar
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                {loading && (
                    <div className="py-12 text-center text-sm text-gray-400">Cargando…</div>
                )}
                {error && (
                    <div className="py-12 text-center text-sm text-red-500">{error}</div>
                )}
                {!loading && !error && items.length === 0 && (
                    <div className="py-12 text-center text-sm text-gray-400">Sin registros</div>
                )}
                {!loading && !error && items.length > 0 && (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-700">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-8"></th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Descripción</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Entidad</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cuando</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {items.map(item => {
                                const act = ACTION_ICONS[item.action] ?? { icon: '•', cls: 'text-gray-400' }
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-base leading-none ${act.cls}`} title={item.action}>
                                                {act.icon}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-xs truncate" title={item.description}>
                                            {item.description}
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                                                {ENTITY_OPTIONS.find(o => o.value === item.entity_type)?.label ?? item.entity_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap" title={absoluteTime(item.created_at)}>
                                            {relativeTime(item.created_at)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        ‹ Anterior
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Página {page + 1} de {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Siguiente ›
                    </button>
                </div>
            )}
        </div>
    )
}
