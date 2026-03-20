import { useState } from 'react'
import { useDarkMode } from './hooks/useDarkMode'
import { LoadExpense } from './pages/ExpenseForm'
import { Dashboard } from './pages/Dashboard'
import { Flujo } from './pages/Flujo'
import { CardsPage, RecurringPage, CotizacionPage, CategoriesPage } from './pages/Config'
import { Divisiones } from './pages/Divisiones'
import { Dashboards } from './pages/Dashboards'
import { Backup } from './pages/Backup'
import { Login } from './pages/Login'
import { AuthProvider, useAuth } from './context/AuthContext'
import { setOnUnauthorized } from './api/client'

const NAV_ITEMS = [
    { id: 'load',       icon: '+',   label: 'Cargar gasto' },
    { id: 'flujo',      icon: '💰',  label: 'Flujo' },
    { id: 'dashboards', icon: '📈',  label: 'Dashboards' },
    { id: 'dashboard',  icon: '📊',  label: 'Resumen tarjetas' },
    { id: 'recurring',  icon: '🔁',  label: 'Recurrentes' },
    { id: 'divisiones', icon: '✂️',  label: 'Divisiones' },
    { id: 'cotizacion', icon: '💵',  label: 'Cotización USD' },
    { id: 'cards',      icon: '💳',  label: 'Tarjetas' },
    { id: 'categories', icon: '🗂️', label: 'Categorías' },
    { id: 'backup',     icon: '💾',  label: 'Backup' },
]

const NARROW_PAGES = new Set(['load', 'cards', 'recurring', 'categories', 'cotizacion', 'backup'])

const SIDEBAR_W = 240
const RAIL_W    = 60

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    )
}

function AppContent() {
    const { token, logout } = useAuth()
    const [dark, setDark] = useDarkMode()
    const [activeTab,        setActiveTab]        = useState('load')
    const [drawerOpen,       setDrawerOpen]       = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [savedCount,       setSavedCount]       = useState(0)

    setOnUnauthorized(logout)

    if (!token) return <Login />

    function navigate(tab) {
        setActiveTab(tab)
        setDrawerOpen(false)
    }

    const activeItem  = NAV_ITEMS.find(i => i.id === activeTab)
    const activeLabel = activeItem ? `${activeItem.icon} ${activeItem.label}` : ''

    // On desktop: width animates between full and rail.
    // On mobile: sidebar is fixed-position overlay, width is always full.
    const desktopW = sidebarCollapsed ? RAIL_W : SIDEBAR_W

    return (
        <div className="min-h-screen bg-stone-100 dark:bg-gray-900 flex">

            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-300 ${
                    drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setDrawerOpen(false)}
            />

            {/* Sidebar */}
            <aside
                className={[
                    // Position: overlay on mobile, sticky on desktop
                    'fixed md:sticky md:top-0',
                    'top-0 left-0 h-full md:h-screen',
                    'bg-white border-r border-gray-200 dark:bg-gray-950 dark:border-gray-800',
                    'z-50 md:z-auto shadow-2xl md:shadow-none',
                    'flex flex-col flex-shrink-0 overflow-hidden',
                    // Mobile: slide in/out via transform
                    // Desktop: no translate, width drives collapse
                    drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
                ].join(' ')}
                style={{
                    width:    desktopW,
                    minWidth: desktopW,
                    transition: 'width 300ms ease-in-out, transform 300ms ease-in-out',
                }}
            >
                {/* Nav items */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden pt-8 pb-2">
                    {/* "Gastos" heading — hidden when collapsed */}
                    <p
                        className="px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-5 whitespace-nowrap overflow-hidden transition-opacity duration-200"
                        style={{ opacity: sidebarCollapsed ? 0 : 1, height: sidebarCollapsed ? 0 : undefined, marginBottom: sidebarCollapsed ? 0 : undefined }}
                    >
                        Renzonaitor Gastos App
                    </p>

                    <nav className="flex flex-col gap-0.5 px-2">
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.id)}
                                title={sidebarCollapsed ? item.label : undefined}
                                className={[
                                    'flex items-center rounded-xl text-sm font-semibold transition-colors whitespace-nowrap',
                                    sidebarCollapsed ? 'justify-center px-2 py-2.5 gap-0' : 'px-3 py-2.5 gap-3',
                                    activeTab === item.id
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
                                ].join(' ')}
                            >
                                <span className="text-base leading-none flex-shrink-0 select-none">{item.icon}</span>
                                <span
                                    className="overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out"
                                    style={{
                                        maxWidth:  sidebarCollapsed ? 0 : 180,
                                        opacity:   sidebarCollapsed ? 0 : 1,
                                        marginLeft: sidebarCollapsed ? 0 : undefined,
                                    }}
                                >
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Footer: logout + desktop toggle */}
                <div className="border-t border-gray-100 dark:border-gray-800 px-2 pt-3 pb-4 flex flex-col gap-0.5">
                    {/* Logout */}
                    <button
                        onClick={logout}
                        title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
                        className={[
                            'flex items-center rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors whitespace-nowrap',
                            sidebarCollapsed ? 'justify-center px-2 py-2.5 gap-0' : 'px-3 py-2.5 gap-3',
                        ].join(' ')}
                    >
                        <span className="text-base leading-none flex-shrink-0 select-none">🚪</span>
                        <span
                            className="overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out"
                            style={{ maxWidth: sidebarCollapsed ? 0 : 180, opacity: sidebarCollapsed ? 0 : 1 }}
                        >
                            Cerrar sesión
                        </span>
                    </button>

                    {/* Dark mode toggle */}
                    <button
                        onClick={() => setDark(d => !d)}
                        title={dark ? 'Modo claro' : 'Modo oscuro'}
                        className={[
                            'flex items-center rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors whitespace-nowrap',
                            sidebarCollapsed ? 'justify-center px-2 py-2.5 gap-0' : 'px-3 py-2.5 gap-3',
                        ].join(' ')}
                    >
                        <span className="text-base leading-none flex-shrink-0 select-none">{dark ? '☀️' : '🌙'}</span>
                        <span
                            className="overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out"
                            style={{ maxWidth: sidebarCollapsed ? 0 : 180, opacity: sidebarCollapsed ? 0 : 1 }}
                        >
                            {dark ? 'Modo claro' : 'Modo oscuro'}
                        </span>
                    </button>

                    {/* Desktop-only collapse toggle */}
                    <button
                        onClick={() => setSidebarCollapsed(c => !c)}
                        title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                        className={[
                            'hidden md:flex items-center rounded-xl text-xs font-bold text-gray-300 hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-400 transition-colors whitespace-nowrap',
                            sidebarCollapsed ? 'justify-center px-2 py-2 gap-0' : 'px-3 py-2 gap-2',
                        ].join(' ')}
                        aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                    >
                        <span className="text-sm leading-none select-none">
                            {sidebarCollapsed ? '›' : '‹'}
                        </span>
                        <span
                            className="overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out"
                            style={{ maxWidth: sidebarCollapsed ? 0 : 120, opacity: sidebarCollapsed ? 0 : 1 }}
                        >
                            Colapsar
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main area — flex-1 so it fills space next to the sticky sidebar */}
            <div className="flex-1 min-w-0 overflow-x-hidden dark:text-gray-100">
                <div className={`px-4 md:px-8 xl:px-10 2xl:px-14 pt-5 md:pt-8 pb-24 ${
                    NARROW_PAGES.has(activeTab) ? 'max-w-md mx-auto md:max-w-none md:mx-0' : ''
                }`}>

                    {/* Top bar — hamburger + label, mobile only */}
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
                    <h1 className="hidden md:block text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
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
                    {activeTab === 'dashboard'  && <Dashboard key={savedCount} />}
                    {activeTab === 'dashboards' && <Dashboards />}
                    {activeTab === 'flujo'      && <Flujo />}
                    {activeTab === 'cards'      && <div className="md:max-w-lg"><CardsPage /></div>}
                    {activeTab === 'recurring'  && <div className="md:max-w-lg"><RecurringPage /></div>}
                    {activeTab === 'divisiones' && <Divisiones />}
                    {activeTab === 'categories' && <div className="md:max-w-lg"><CategoriesPage /></div>}
                    {activeTab === 'cotizacion' && <div className="md:max-w-lg"><CotizacionPage /></div>}
                    {activeTab === 'backup'     && <div className="md:max-w-lg"><Backup /></div>}
                </div>
            </div>
        </div>
    )
}
