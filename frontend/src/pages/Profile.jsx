import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function Profile() {
    const [user,        setUser]        = useState(null)
    const [loading,     setLoading]     = useState(true)

    // Display name form
    const [displayName, setDisplayName] = useState('')
    const [nameLoading, setNameLoading] = useState(false)
    const [nameSuccess, setNameSuccess] = useState(false)
    const [nameError,   setNameError]   = useState(null)

    // Password form
    const [currentPwd,  setCurrentPwd]  = useState('')
    const [newPwd,      setNewPwd]      = useState('')
    const [confirmPwd,  setConfirmPwd]  = useState('')
    const [pwdLoading,  setPwdLoading]  = useState(false)
    const [pwdSuccess,  setPwdSuccess]  = useState(false)
    const [pwdError,    setPwdError]    = useState(null)

    useEffect(() => {
        api.getMe()
            .then(data => { setUser(data); setDisplayName(data.display_name) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    async function handleNameSubmit(e) {
        e.preventDefault()
        setNameError(null)
        setNameSuccess(false)
        setNameLoading(true)
        try {
            await api.updateMe({ display_name: displayName })
            setUser(u => ({ ...u, display_name: displayName }))
            setNameSuccess(true)
            setTimeout(() => setNameSuccess(false), 2500)
        } catch (err) {
            setNameError(err.message || 'Error al actualizar')
        } finally {
            setNameLoading(false)
        }
    }

    async function handlePasswordSubmit(e) {
        e.preventDefault()
        setPwdError(null)
        setPwdSuccess(false)
        if (newPwd !== confirmPwd) {
            setPwdError('Las contraseñas no coinciden')
            return
        }
        setPwdLoading(true)
        try {
            await api.updateMe({ current_password: currentPwd, new_password: newPwd })
            setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
            setPwdSuccess(true)
            setTimeout(() => setPwdSuccess(false), 2500)
        } catch (err) {
            setPwdError(err.message || 'Error al cambiar contraseña')
        } finally {
            setPwdLoading(false)
        }
    }

    if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Cargando…</p>
    if (!user)   return <p className="text-sm text-red-400 py-8 text-center">No se pudo cargar el perfil.</p>

    const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:focus:ring-gray-400"
    const labelCls = "block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5"
    const cardCls  = "bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6 space-y-4"

    return (
        <div className="max-w-md space-y-6">
            {/* Account info */}
            <div className={cardCls}>
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Cuenta</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Email: <span className="font-semibold text-gray-800 dark:text-gray-200">{user.email}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Miembro desde: <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {new Date(user.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                </p>
            </div>

            {/* Display name */}
            <form onSubmit={handleNameSubmit} className={cardCls}>
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Nombre</h2>
                <div>
                    <label className={labelCls}>Nombre visible</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        required
                        className={inputCls}
                    />
                </div>
                {nameError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                        {nameError}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={nameLoading || !displayName}
                    className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors disabled:opacity-40"
                >
                    {nameLoading ? 'Guardando…' : nameSuccess ? '✓ Guardado' : 'Guardar nombre'}
                </button>
            </form>

            {/* Change password */}
            <form onSubmit={handlePasswordSubmit} className={cardCls}>
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Cambiar contraseña</h2>
                <div>
                    <label className={labelCls}>Contraseña actual</label>
                    <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
                        required autoComplete="current-password" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Nueva contraseña</label>
                    <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                        required autoComplete="new-password" placeholder="Mínimo 8 caracteres" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Confirmar nueva contraseña</label>
                    <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                        required autoComplete="new-password" className={inputCls} />
                </div>
                {pwdError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                        {pwdError}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                    className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors disabled:opacity-40"
                >
                    {pwdLoading ? 'Guardando…' : pwdSuccess ? '✓ Contraseña actualizada' : 'Cambiar contraseña'}
                </button>
            </form>
        </div>
    )
}
