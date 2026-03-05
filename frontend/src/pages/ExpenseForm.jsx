import { useCards } from '../hooks/useCards'
import { useCategories } from '../hooks/useCategories'
import { ExpenseForm } from '../components/ExpenseForm'

export function LoadExpense({ onSaved }) {
    const { cards, loading } = useCards()
    const { categories } = useCategories()

    if (loading) return <p className="text-center text-gray-400 py-8">Loading...</p>

    return (
        <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">New expense</h2>
            <ExpenseForm cards={cards} categories={categories} onSaved={onSaved} />
        </div>
    )
}