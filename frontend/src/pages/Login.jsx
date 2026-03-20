import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Login() {
    const { login } = useAuth()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [remember, setRemember] = useState(true)
    const [error,    setError]    = useState(null)
    const [loading,  setLoading]  = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            await login(username, password, remember)
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-stone-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gastos Tarjeta</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ingresá tus credenciales para continuar</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 dark:border-gray-700 rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Usuario
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            autoFocus
                            autoComplete="username"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:focus:ring-gray-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:focus:ring-gray-400"
                        />
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={e => setRemember(e.target.checked)}
                            className="w-4 h-4 rounded accent-gray-900"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Mantener sesión por 7 días</span>
                    </label>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !username || !password}
                        className="w-full bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40"
                    >
                        {loading ? 'Ingresando…' : 'Iniciar sesión'}
                    </button>
                </form>
            </div>
        </div>
    )
}
