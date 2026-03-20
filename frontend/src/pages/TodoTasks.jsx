import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

const MONTHS_ES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

function fmt(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtTs(dateStr) {
    return new Date(dateStr).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

function ColorDot({ hex }) {
    if (!hex) return null
    return (
        <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: hex }}
        />
    )
}

function TaskRow({ task, onComplete, onUncomplete, completing }) {
    const [confirmUncheck, setConfirmUncheck] = useState(false)
    const done = !!task.completed_at

    function handleCheck() {
        if (done) {
            setConfirmUncheck(true)
        } else {
            onComplete(task)
        }
    }

    return (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-colors ${
            done ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-800'
        }`}>
            {/* Checkbox */}
            <button
                onClick={handleCheck}
                disabled={completing}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    done
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400 bg-transparent'
                } ${completing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={done ? 'Desmarcar' : 'Marcar como completado'}
            >
                {done && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {task.task_type === 'card_payment' && <ColorDot hex={task.color_hex} />}
                    <span className={`text-sm font-semibold ${
                        done
                            ? 'line-through text-gray-400 dark:text-gray-500'
                            : 'text-gray-800 dark:text-gray-200'
                    }`}>
                        {task.reference_name}
                    </span>
                </div>
                {done && task.completed_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Marcado el {fmtTs(task.completed_at)}
                    </p>
                )}
                {!done && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Pendiente</p>
                )}
            </div>

            {/* Amount */}
            <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                done ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
            }`}>
                ${fmt(task.amount)}
            </span>

            {/* Uncheck confirmation */}
            {confirmUncheck && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
                            ¿Desmarcar tarea?
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                            Se va a quitar la marca de completado de <strong>{task.reference_name}</strong>.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmUncheck(false)}
                                className="px-4 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setConfirmUncheck(false); onUncomplete(task) }}
                                className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                                Desmarcar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function Section({ title, tasks, onComplete, onUncomplete, completing }) {
    if (tasks.length === 0) return null
    return (
        <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">
                {title}
            </h2>
            <div className="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-700/50">
                {tasks.map(t => (
                    <TaskRow
                        key={`${t.task_type}-${t.reference_id}`}
                        task={t}
                        onComplete={onComplete}
                        onUncomplete={onUncomplete}
                        completing={completing}
                    />
                ))}
            </div>
        </div>
    )
}

export function TodoTasks() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year,  setYear]  = useState(now.getFullYear())
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(false)
    const [completing, setCompleting] = useState(false)

    const load = useCallback(async (m, y) => {
        setLoading(true)
        try {
            const data = await api.getTodos(m, y)
            setTasks(data ?? [])
        } catch {
            setTasks([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load(month, year) }, [month, year, load])

    function prevMonth() {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    function nextMonth() {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    async function handleComplete(task) {
        setCompleting(true)
        try {
            const updated = await api.completeTodo({
                month: task.month,
                year:  task.year,
                task_type:      task.task_type,
                reference_id:   task.reference_id,
                reference_name: task.reference_name,
                amount:         task.amount,
            })
            setTasks(prev => prev.map(t =>
                t.task_type === task.task_type && t.reference_id === task.reference_id
                    ? { ...t, id: updated.id, completed_at: updated.completed_at }
                    : t
            ))
        } catch (e) {
            if (e.status === 409) {
                // already completed — reload to sync
                load(month, year)
            }
        } finally {
            setCompleting(false)
        }
    }

    async function handleUncomplete(task) {
        setCompleting(true)
        try {
            await api.uncompleteTodo({
                month:        task.month,
                year:         task.year,
                task_type:    task.task_type,
                reference_id: task.reference_id,
            })
            setTasks(prev => prev.map(t =>
                t.task_type === task.task_type && t.reference_id === task.reference_id
                    ? { ...t, completed_at: null }
                    : t
            ))
        } finally {
            setCompleting(false)
        }
    }

    const cardTasks     = tasks.filter(t => t.task_type === 'card_payment')
    const cobranzaTasks = tasks.filter(t => t.task_type === 'cobranza')
    const completed     = tasks.filter(t => !!t.completed_at).length
    const total         = tasks.length
    const pct           = total > 0 ? Math.round((completed / total) * 100) : 0

    return (
        <div className="max-w-xl">
            {/* Month selector */}
            <div className="flex items-center gap-2 mb-6">
                <button onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg leading-none">
                    ‹
                </button>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-36 text-center">
                    {MONTHS_ES[month - 1]} {year}
                </span>
                <button onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg leading-none">
                    ›
                </button>
            </div>

            {loading ? (
                <p className="text-center text-sm text-gray-400 py-8">Cargando…</p>
            ) : tasks.length === 0 ? (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
                    Sin tareas para {MONTHS_ES[month - 1]} {year}.
                </p>
            ) : (
                <>
                    {/* Progress summary */}
                    <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {completed} de {total} completados
                            </span>
                            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    <Section
                        title="Pagos de tarjetas"
                        tasks={cardTasks}
                        onComplete={handleComplete}
                        onUncomplete={handleUncomplete}
                        completing={completing}
                    />
                    <Section
                        title="Cobranzas"
                        tasks={cobranzaTasks}
                        onComplete={handleComplete}
                        onUncomplete={handleUncomplete}
                        completing={completing}
                    />
                </>
            )}
        </div>
    )
}
