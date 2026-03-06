import { api } from '../api/client'

function InstallmentBadge({ current, total }) {
    if (total === 1) return <span className="text-gray-400 text-xs">Cash</span>
    return (
        <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded">
      {current}/{total}
    </span>
    )
}

export function ExpenseList({ expenses, onSelect, onDeleted }) {
    if (!expenses?.length) {
        return <p className="text-center text-gray-400 text-sm py-8">No expenses this month</p>
    }

    return (
        <div className="flex flex-col gap-2">
            {expenses.map(e => (
                <div key={e.expense_id}
                     onClick={() => onSelect?.(e)}
                     className="flex justify-between items-center bg-white border border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-400 transition-colors">
                    <div>
                        <p className="text-sm font-semibold text-gray-900">{e.merchant}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <InstallmentBadge current={e.installment_number} total={e.total_installments} />
                            {e.is_recurring && <span className="text-xs">🔁</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-red-600">
              -${e.installment_amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </span>
                        <span className="text-gray-300 text-lg">›</span>
                    </div>
                </div>
            ))}
        </div>
    )
}