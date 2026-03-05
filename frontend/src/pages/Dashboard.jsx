import { useState } from 'react'
import { useCards } from '../hooks/useCards'
import { useMonthlySummary } from '../hooks/useMonthlySummary'
import { MonthNav } from '../components/MonthNav'
import { CardDropdown } from '../components/CardDropdown'
import { ExpenseList } from '../components/ExpenseList'

export function Dashboard({ initialMonth, initialYear }) {
    const now = new Date()
    const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1)
    const [year, setYear] = useState(initialYear ?? now.getFullYear())
    const [selectedCardId, setSelectedCardId] = useState(null)

    const { cards } = useCards()
    const { summary, byCard, loading } = useMonthlySummary(month, year, selectedCardId)

    const grandTotal = byCard.reduce((sum, c) => sum + c.total, 0)

    return (
        <div>
            <MonthNav month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
            <CardDropdown cards={cards} selectedId={selectedCardId} onChange={setSelectedCardId} />

            {loading ? (
                <p className="text-center text-gray-400 py-8">Loading...</p>
            ) : (
                <>
                    {/* KPI */}
                    <div className="bg-gray-900 text-white rounded-xl px-4 py-3 mb-4">
                        <p className="text-xs opacity-60 uppercase tracking-wide">
                            {selectedCardId ? cards.find(c => c.id === selectedCardId)?.name : 'Monthly total'}
                        </p>
                        <p className="text-2xl font-bold">
                            ${(selectedCardId ? (summary?.total ?? 0) : grandTotal)
                            .toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </p>
                    </div>

                    {/* All cards view — subtotals */}
                    {!selectedCardId && (
                        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">By card</p>
                            {byCard.map(c => (
                                <div key={c.card_id}
                                     className="flex justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4"
                                     onClick={() => setSelectedCardId(c.card_id)}>
                  <span className={`text-sm ${c.total === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                    {c.card_name}
                  </span>
                                    <span className={`text-sm font-bold ${c.total === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                    ${c.total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Single card view — expense list */}
                    {selectedCardId && summary && (
                        <ExpenseList
                            expenses={summary.expenses}
                            onDeleted={() => setMonth(m => m)}
                        />
                    )}
                </>
            )}
        </div>
    )
}