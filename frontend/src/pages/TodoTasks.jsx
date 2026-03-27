import { useState, useEffect, useCallback, useRef } from 'react'
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

function fmtDateShort(yyyy_mm_dd) {
    const [, m, d] = yyyy_mm_dd.split('-')
    return `${d}/${m}`
}

function todayStr() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Pill with an invisible date input overlaid — clicking the pill opens the native date picker
function DueDatePill({ dueDate, done, onChange, savedFlash }) {
    const today = todayStr()
    const inputRef = useRef(null)

    let pillCls, label
    if (!dueDate) {
        pillCls = 'border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400'
        label   = '+ Vencimiento'
    } else if (done) {
        pillCls = 'border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50'
        label   = `📅 ${fmtDateShort(dueDate)}`
    } else if (dueDate < today) {
        pillCls = 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400'
        label   = `🔴 Vencido ${fmtDateShort(dueDate)}`
    } else if (dueDate === today) {
        pillCls = 'bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400'
        label   = `⚠️ Hoy`
    } else {
        pillCls = 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 text-blue-600 dark:text-blue-400'
        label   = `📅 ${fmtDateShort(dueDate)}`
    }

    return (
        <div className="flex items-center gap-1.5">
            {/* Pill wraps a hidden date input — click pill → native date picker */}
            <button
                type="button"
                onClick={() => inputRef.current?.showPicker()}
                className={`relative inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full cursor-pointer transition-all select-none ${pillCls}`}
            >
                {label}
                <input
                    ref={inputRef}
                    type="date"
                    value={dueDate ?? ''}
                    onChange={onChange}
                    className="sr-only"
                    tabIndex={-1}
                />
            </button>
            {savedFlash && (
                <span className="text-xs font-semibold text-green-500 dark:text-green-400">✓</span>
            )}
        </div>
    )
}

function ColorDot({ hex }) {
    if (!hex) return null
    return (
        <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: hex }}
        />
    )
}

function TaskRow({ task, onComplete, onUncomplete, onDueDateChange, completing }) {
    const [confirmUncheck, setConfirmUncheck] = useState(false)
    const [savedFlash,     setSavedFlash]     = useState(false)
    const flashTimer = useRef(null)
    const done   = !!task.completed_at
    const isCard = task.task_type === 'card_payment'

    function handleCheck() {
        if (done) setConfirmUncheck(true)
        else onComplete(task)
    }

    function handleDueDateChange(e) {
        const val = e.target.value || null
        onDueDateChange(task, val)
        clearTimeout(flashTimer.current)
        setSavedFlash(true)
        flashTimer.current = setTimeout(() => setSavedFlash(false), 1500)
    }

    return (
        <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${
            done ? 'bg-green-50/60 dark:bg-green-900/10' : 'bg-white dark:bg-gray-800'
        }`}>

            {/* Checkbox */}
            <button
                onClick={handleCheck}
                disabled={completing}
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    done
                        ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-200 dark:shadow-green-900'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 bg-transparent'
                } ${completing ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                title={done ? 'Desmarcar' : 'Marcar como completado'}
            >
                {done && (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                )}
            </button>

            {/* Name + metadata */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {isCard && <ColorDot hex={task.color_hex} />}
                    <span className={`text-sm font-semibold leading-tight transition-colors ${
                        done
                            ? 'line-through text-gray-400 dark:text-gray-500'
                            : 'text-gray-800 dark:text-gray-200'
                    }`}>
                        {task.reference_name}
                    </span>
                </div>
                {done && task.completed_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Pagado el {fmtTs(task.completed_at)}
                    </p>
                )}
            </div>

            {/* Right side: amount + due date pill */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={`text-sm font-bold tabular-nums ${
                    done ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
                }`}>
                    ${fmt(task.amount)}
                </span>
                {isCard && (
                    <DueDatePill
                        dueDate={task.due_date}
                        done={done}
                        onChange={handleDueDateChange}
                        savedFlash={savedFlash}
                    />
                )}
            </div>

            {/* Uncheck confirmation modal */}
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

function Section({ title, tasks, icon, onComplete, onUncomplete, onDueDateChange, completing }) {
    if (tasks.length === 0) return null
    const doneCount = tasks.filter(t => !!t.completed_at).length
    return (
        <div className="mb-5">
            <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-base leading-none">{icon}</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {title}
                </h2>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                    {doneCount}/{tasks.length}
                </span>
            </div>
            <div className="rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-700/40">
                {tasks.map(t => (
                    <TaskRow
                        key={`${t.task_type}-${t.reference_id}`}
                        task={t}
                        onComplete={onComplete}
                        onUncomplete={onUncomplete}
                        onDueDateChange={onDueDateChange}
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
    const [loading,    setLoading]    = useState(false)
    const [completing, setCompleting] = useState(false)

    const load = useCallback(async (m, y) => {
        setLoading(true)
        try {
            setTasks(await api.getTodos(m, y) ?? [])
        } catch {
            setTasks([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load(month, year) }, [month, year, load])

    function prevMonth() {
        if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
    }
    function nextMonth() {
        if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
    }

    async function handleComplete(task) {
        setCompleting(true)
        try {
            const updated = await api.completeTodo({
                month: task.month, year: task.year,
                task_type: task.task_type, reference_id: task.reference_id,
                reference_name: task.reference_name, amount: task.amount,
            })
            setTasks(prev => prev.map(t =>
                t.task_type === task.task_type && t.reference_id === task.reference_id
                    ? { ...t, id: updated.id, completed_at: updated.completed_at }
                    : t
            ))
        } catch (e) {
            if (e.status === 409) load(month, year)
        } finally {
            setCompleting(false)
        }
    }

    async function handleUncomplete(task) {
        setCompleting(true)
        try {
            await api.uncompleteTodo({
                month: task.month, year: task.year,
                task_type: task.task_type, reference_id: task.reference_id,
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

    async function handleDueDateChange(task, dueDate) {
        setTasks(prev => prev.map(t =>
            t.task_type === task.task_type && t.reference_id === task.reference_id
                ? { ...t, due_date: dueDate }
                : t
        ))
        try {
            await api.updateTodoDueDate({
                month: task.month, year: task.year,
                task_type: task.task_type, reference_id: task.reference_id,
                reference_name: task.reference_name, amount: task.amount,
                due_date: dueDate,
            })
        } catch {
            load(month, year)
        }
    }

    const cardTasks     = tasks.filter(t => t.task_type === 'card_payment')
    const cobranzaTasks = tasks.filter(t => t.task_type === 'cobranza')
    const completed     = tasks.filter(t => !!t.completed_at).length
    const total         = tasks.length
    const pct           = total > 0 ? Math.round((completed / total) * 100) : 0
    const allDone       = total > 0 && completed === total

    return (
        <div className="max-w-lg">
            {/* Month selector */}
            <div className="flex items-center gap-1 mb-6">
                <button onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xl leading-none">
                    ‹
                </button>
                <span className="text-base font-bold text-gray-800 dark:text-gray-200 w-40 text-center">
                    {MONTHS_ES[month - 1]} {year}
                </span>
                <button onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xl leading-none">
                    ›
                </button>
            </div>

            {loading ? (
                <p className="text-center text-sm text-gray-400 py-12">Cargando…</p>
            ) : tasks.length === 0 ? (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-12">
                    Sin tareas para {MONTHS_ES[month - 1]} {year}.
                </p>
            ) : (
                <>
                    {/* Progress card */}
                    <div className={`mb-6 rounded-2xl px-5 py-4 transition-colors ${
                        allDone
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40'
                            : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 shadow-sm'
                    }`}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${
                                    allDone ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                                }`}>
                                    {allDone ? '¡Todo al día! 🎉' : 'Progreso del mes'}
                                </p>
                                <p className={`text-2xl font-bold tabular-nums ${
                                    allDone ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-gray-100'
                                }`}>
                                    {completed}
                                    <span className={`text-base font-normal ${allDone ? 'text-green-500' : 'text-gray-400'}`}>
                                        /{total}
                                    </span>
                                </p>
                            </div>
                            <span className={`text-3xl font-black tabular-nums ${
                                allDone ? 'text-green-500' : pct >= 50 ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'
                            }`}>
                                {pct}%
                            </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                    allDone ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    <Section
                        title="Pagos de tarjetas"
                        icon="💳"
                        tasks={cardTasks}
                        onComplete={handleComplete}
                        onUncomplete={handleUncomplete}
                        onDueDateChange={handleDueDateChange}
                        completing={completing}
                    />
                    <Section
                        title="Cobranzas"
                        icon="🧾"
                        tasks={cobranzaTasks}
                        onComplete={handleComplete}
                        onUncomplete={handleUncomplete}
                        onDueDateChange={handleDueDateChange}
                        completing={completing}
                    />
                </>
            )}
        </div>
    )
}
