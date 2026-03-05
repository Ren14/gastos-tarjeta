import { useState } from 'react'
import { LoadExpense } from './pages/ExpenseForm'
import { Dashboard } from './pages/Dashboard'
import { Projection } from './pages/Projection'

const TABS = [
    { id: 'load',       label: '+ Load' },
    { id: 'dashboard',  label: '📊 Dashboard' },
    { id: 'projection', label: '🔮 Futuro' },
]

export default function App() {
    const [activeTab, setActiveTab] = useState('load')
    const [savedCount, setSavedCount] = useState(0)
    const [dashMonth, setDashMonth] = useState(null)
    const [dashYear, setDashYear] = useState(null)

    function navigateToDashboard(month, year) {
        setDashMonth(month)
        setDashYear(year)
        setActiveTab('dashboard')
    }

    return (
        <div className="min-h-screen bg-stone-100">
            <div className="max-w-md mx-auto px-4 pt-8 pb-24">

                <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-3 text-sm font-bold transition-colors
                ${activeTab === tab.id
                                    ? 'bg-gray-900 text-white'
                                    : 'text-gray-400 hover:text-gray-700'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'load' && (
                    <LoadExpense onSaved={() => {
                        setSavedCount(n => n + 1)
                        setActiveTab('dashboard')
                    }} />
                )}
                {activeTab === 'dashboard' && (
                    <Dashboard
                        key={savedCount}
                        initialMonth={dashMonth}
                        initialYear={dashYear}
                    />
                )}
                {activeTab === 'projection' && (
                    <Projection onNavigateToDashboard={navigateToDashboard} />
                )}

            </div>
        </div>
    )
}