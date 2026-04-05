import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Register({ onShowLogin }) {
    const { register } = useAuth()
    const [email,       setEmail]       = useState('')
    const [displayName, setDisplayName] = useState('')
    const [password,    setPassword]    = useState('')
    const [confirm,     setConfirm]     = useState('')
    const [error,       setError]       = useState(null)
    const [success,     setSuccess]     = useState(false)
    const [loading,     setLoading]     = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        if (password !== confirm) {
            setError('Las contraseñas no coinciden')
            return
        }
        setLoading(true)
        try {
            await register(email, displayName, password)
            setSuccess(true)
        } catch (err) {
            setError(err.message || 'Error al registrarse')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-stone-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gastos Tarjeta</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Creá tu cuenta para comenzar</p>
                </div>

                <div className="bg-white dark:bg-gray-800 dark:border-gray-700 rounded-2xl border border-gray-200 shadow-sm p-6">
                    {success ? (
                        <div className="space-y-4">
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
                                ¡Cuenta creada exitosamente! Ya podés iniciar sesión.
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
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    autoComplete="email"
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:focus:ring-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                                    Nombre <span className="font-normal normal-case">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    autoComplete="name"
                                    placeholder="Tu nombre"
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
                                disabled={loading || !email || !password || !confirm}
                                className="w-full bg-gray-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                            >
                                {loading ? 'Registrando…' : 'Crear cuenta'}
                            </button>

                            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                                ¿Ya tenés cuenta?{' '}
                                <button
                                    type="button"
                                    onClick={onShowLogin}
                                    className="font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                                >
                                    Iniciar sesión
                                </button>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
