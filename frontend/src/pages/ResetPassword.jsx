import { useState } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

export function ResetPassword({ token, onShowLogin }) {
    const [password, setPassword] = useState('')
    const [confirm,  setConfirm]  = useState('')
    const [loading,  setLoading]  = useState(false)
    const [success,  setSuccess]  = useState(false)
    const [error,    setError]    = useState(null)

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        if (password !== confirm) {
            setError('Las contraseñas no coinciden')
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`${BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
            setSuccess(true)
        } catch (err) {
            setError(err.message || 'Error al restablecer la contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-stone-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gastos Tarjeta</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Nueva contraseña</p>
                </div>

                <div className="bg-white dark:bg-gray-800 dark:border-gray-700 rounded-2xl border border-gray-200 shadow-sm p-6">
                    {success ? (
                        <div className="space-y-4">
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
                                ¡Contraseña actualizada! Ya podés iniciar sesión.
                            </div>
                            <button
                                onClick={onShowLogin}
                                className="w-full bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                            >
                                Ir al inicio de sesión
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                                    Nueva contraseña
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                    autoComplete="new-password"
                                    placeholder="Mínimo 8 caracteres"
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:focus:ring-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                                    Confirmar contraseña
                                </label>
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:focus:ring-gray-400"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !password || !confirm}
                                className="w-full bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                            >
                                {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
