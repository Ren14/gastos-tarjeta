import { useState } from 'react'
import { LoadExpense } from './pages/ExpenseForm'
import { Dashboard } from './pages/Dashboard'

const TABS = [
    { id: 'load',      label: '+ Load' },
    { id: 'dashboard', label: '📊 Dashboard' },
]

export default function App() {
    const [activeTab, setActiveTab] = useState('load')
    const [savedCount, setSavedCount] = useState(0)

    return (
        <div className="min-h-screen bg-stone-100">
            <div className="max-w-md mx-auto px-4 pt-8 pb-24">

                {/* Tab nav */}
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
                {activeTab === 'dashboard' && <Dashboard key={savedCount} />}

            </div>
        </div>
    )
}