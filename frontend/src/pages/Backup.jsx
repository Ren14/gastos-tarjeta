import { useState } from 'react'
import { api } from '../api/client'

export function Backup() {
    const [exporting,       setExporting]       = useState(false)
    const [importFile,      setImportFile]       = useState(null)
    const [confirmed,       setConfirmed]        = useState(false)
    const [importing,       setImporting]        = useState(false)
    const [result,          setResult]           = useState(null) // { type: 'success'|'error', message }

    const [resetConfirmed,  setResetConfirmed]   = useState(false)
    const [resetTyped,      setResetTyped]       = useState('')
    const [resetting,       setResetting]        = useState(false)
    const [resetResult,     setResetResult]      = useState(null)

    async function handleExport() {
        setExporting(true)
        try {
            const blob = await api.exportDB()
            const url  = URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href     = url
            a.download = `gastos-tarjeta-backup-${new Date().toISOString().slice(0, 10)}.sql`
            a.click()
            URL.revokeObjectURL(url)
        } catch (e) {
            alert('Error al exportar: ' + e.message)
        } finally {
            setExporting(false)
        }
    }

    async function handleReset() {
        if (!resetConfirmed || resetTyped !== 'RESET') return
        setResetting(true)
        setResetResult(null)
        try {
            const res = await api.truncateDB()
            setResetResult({ type: 'success', message: res.message })
            setResetConfirmed(false)
            setResetTyped('')
            setTimeout(() => window.location.reload(), 2000)
        } catch (e) {
            setResetResult({ type: 'error', message: e.message })
        } finally {
            setResetting(false)
        }
    }

    async function handleImport() {
        if (!importFile || !confirmed) return
        setImporting(true)
        setResult(null)
        try {
            const res = await api.importDB(importFile)
            setResult({ type: 'success', message: res.message + ' — recargando…' })
            setImportFile(null)
            setConfirmed(false)
            setTimeout(() => window.location.reload(), 2000)
        } catch (e) {
            setResult({ type: 'error', message: e.message })
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="max-w-md space-y-8">

            {/* ── Export ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Exportar</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                    Genera un archivo <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">.sql</code> con
                    todos los datos actuales de la base de datos.
                </p>
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-gray-700 transition-colors"
                >
                    {exporting ? 'Generando…' : '📥 Descargar backup (.sql)'}
                </button>
            </div>

            {/* ── Import ── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Restaurar</h2>

                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <span className="flex-shrink-0 mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-800 leading-relaxed">
                        Esto reemplazará <strong>todos los datos existentes</strong>.
                        Esta acción no se puede deshacer.
                    </p>
                </div>

                <div className="space-y-3">
                    <label className="block">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                            Archivo SQL
                        </span>
                        <input
                            type="file"
                            accept=".sql"
                            onChange={e => {
                                setImportFile(e.target.files[0] ?? null)
                                setResult(null)
                            }}
                            className="block w-full text-sm text-gray-600
                                file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                                file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700
                                hover:file:bg-gray-200"
                        />
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={e => setConfirmed(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 leading-snug">
                            Entiendo que esto reemplazará todos los datos actuales
                        </span>
                    </label>

                    <button
                        onClick={handleImport}
                        disabled={!importFile || !confirmed || importing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-red-700 transition-colors"
                    >
                        {importing ? 'Restaurando…' : '🔄 Restaurar base de datos'}
                    </button>
                </div>

                {result && (
                    <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                        result.type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                        {result.type === 'success' ? '✅ ' : '❌ '}{result.message}
                    </div>
                )}
            </div>

            {/* ── Reset ── */}
            <div className="bg-white rounded-2xl border border-red-200 p-6 space-y-4">
                <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest">Resetear base de datos</h2>

                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <span className="flex-shrink-0 mt-0.5">🚨</span>
                    <p className="text-xs text-red-800 leading-relaxed">
                        Esto eliminará <strong>todos los datos permanentemente</strong>: gastos, tarjetas,
                        categorías, flujo de caja, cotizaciones y recurrentes. No se puede deshacer.
                    </p>
                </div>

                <div className="space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={resetConfirmed}
                            onChange={e => {
                                setResetConfirmed(e.target.checked)
                                setResetTyped('')
                                setResetResult(null)
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 leading-snug">
                            Entiendo que esto eliminará todos los datos permanentemente
                        </span>
                    </label>

                    {resetConfirmed && (
                        <div className="space-y-2">
                            <label className="block">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                                    Escribí <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">RESET</code> para confirmar
                                </span>
                                <input
                                    type="text"
                                    value={resetTyped}
                                    onChange={e => setResetTyped(e.target.value)}
                                    placeholder="RESET"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                                />
                            </label>

                            <button
                                onClick={handleReset}
                                disabled={resetTyped !== 'RESET' || resetting}
                                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-red-700 transition-colors"
                            >
                                {resetting ? 'Reseteando…' : '🗑️ Confirmar reset'}
                            </button>
                        </div>
                    )}
                </div>

                {resetResult && (
                    <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                        resetResult.type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                        {resetResult.type === 'success' ? '✅ ' : '❌ '}{resetResult.message}
                    </div>
                )}
            </div>
        </div>
    )
}
