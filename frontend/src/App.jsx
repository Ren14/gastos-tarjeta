import { useState } from 'react'
import { LoadExpense } from './pages/ExpenseForm'
import { Dashboard } from './pages/Dashboard'
import { Flujo } from './pages/Flujo'
import { CardsPage, RecurringPage, CotizacionPage, CategoriesPage } from './pages/Config'
import { Backup } from './pages/Backup'
import { Login } from './pages/Login'
import { AuthProvider, useAuth } from './context/AuthContext'
import { setOnUnauthorized } from './api/client'

const NAV_ITEMS = [
    { id: 'load',       label: '+ Cargar gasto' },
    { id: 'dashboard',  label: '📊 Resumen' },
    { id: 'flujo',      label: '💰 Flujo' },
    { id: 'cards',      label: '💳 Tarjetas' },
    { id: 'recurring',  label: '🔁 Recurrentes' },
    { id: 'categories', label: '🗂️ Categorías' },
    { id: 'cotizacion', label: '💵 Cotización USD' },
    { id: 'backup',     label: '💾 Backup' },
]

// Pages that should stay narrow (forms / config)
const NARROW_PAGES = new Set(['load', 'cards', 'recurring', 'categories', 'cotizacion', 'backup'])

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    )
}

function AppContent() {
    const { token, logout } = useAuth()
    const [activeTab, setActiveTab] = useState('dashboard')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [savedCount, setSavedCount] = useState(0)

    // Wire up 401 → logout
    setOnUnauthorized(logout)

    if (!token) return <Login />

    function navigate(tab) {
        setActiveTab(tab)
        setDrawerOpen(false)
    }

    const activeLabel = NAV_ITEMS.find(i => i.id === activeTab)?.label ?? ''

    return (
        <div className="min-h-screen bg-stone-100 md:flex">

            {/* Mobile overlay — hidden on md+ */}
            <div
                className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-300 ${
                    drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setDrawerOpen(false)}
            />

            {/* Sidebar — drawer on mobile, permanent on md+ */}
            <aside className={[
                'fixed md:sticky md:top-0',
                'top-0 left-0 h-full md:h-screen',
                'w-60 xl:w-64 flex-shrink-0',
                'bg-white border-r border-gray-200',
                'z-50 md:z-auto shadow-2xl md:shadow-none',
                'flex flex-col',
                'transition-transform duration-300 ease-in-out',
                drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
            ].join(' ')}>
                <div className="px-4 xl:px-5 pt-8 pb-6 flex-1 overflow-y-auto">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">
                        Gastos
                    </p>
                    <nav className="flex flex-col gap-1">
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.id)}
                                className={`text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                    activeTab === item.id
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="px-4 xl:px-5 pb-6 border-t border-gray-100 pt-4">
                    <button
                        onClick={logout}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                        🚪 Cerrar sesión
                    </button>
                </div>
            </aside>

            {/* Main area */}
            <div className="flex-1 min-w-0 overflow-x-hidden">
                <div className={`px-4 md:px-8 xl:px-10 2xl:px-14 pt-5 md:pt-8 pb-24 ${
                    NARROW_PAGES.has(activeTab) ? 'max-w-md mx-auto md:max-w-none md:mx-0' : ''
                }`}>

                    {/* Top bar — hamburger + label on mobile only */}
                    <div className="flex items-center gap-3 mb-6 md:hidden">
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="text-2xl text-gray-700 hover:text-gray-900 leading-none w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
                            aria-label="Abrir menú"
                        >
                            ☰
                        </button>
                        <span className="text-sm font-bold text-gray-700 tracking-wide">{activeLabel}</span>
                    </div>

                    {/* Page title — desktop only */}
                    <h1 className="hidden md:block text-xl font-bold text-gray-900 mb-6">
                        {activeLabel}
                    </h1>

                    {/* Page content */}
                    {activeTab === 'load' && (
                        <div className="md:max-w-lg">
                            <LoadExpense onSaved={() => {
                                setSavedCount(n => n + 1)
                                setActiveTab('dashboard')
                            }} />
                        </div>
                    )}
                    {activeTab === 'dashboard' && (
                        <Dashboard key={savedCount} />
                    )}
                    {activeTab === 'flujo' && <Flujo />}
                    {activeTab === 'cards'      && <div className="md:max-w-lg"><CardsPage /></div>}
                    {activeTab === 'recurring'  && <div className="md:max-w-lg"><RecurringPage /></div>}
                    {activeTab === 'categories' && <div className="md:max-w-lg"><CategoriesPage /></div>}
                    {activeTab === 'cotizacion' && <div className="md:max-w-lg"><CotizacionPage /></div>}
                    {activeTab === 'backup'     && <div className="md:max-w-lg"><Backup /></div>}
                </div>
            </div>
        </div>
    )
}
