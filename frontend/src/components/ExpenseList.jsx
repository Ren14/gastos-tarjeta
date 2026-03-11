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
            {expenses.map(e => {
                const isEstimated = !!e.is_estimated
                return (
                    <div key={e.expense_id}
                         onClick={() => !isEstimated && onSelect?.(e)}
                         className={`flex justify-between items-center bg-white rounded-xl px-4 py-3 transition-colors ${
                             isEstimated
                                 ? 'border-2 border-dashed border-orange-200 opacity-70'
                                 : 'border border-gray-200 cursor-pointer hover:border-gray-400'
                         }`}>
                        <div>
                            <p className={`text-sm font-semibold ${isEstimated ? 'text-gray-500' : 'text-gray-900'}`}>
                                {e.merchant}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <InstallmentBadge current={e.installment_number} total={e.total_installments} />
                                {e.is_recurring && !isEstimated && <span className="text-xs">🔁</span>}
                                {isEstimated && (
                                    <span className="text-xs font-semibold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                                        🔁 ~est
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isEstimated ? 'text-orange-400' : 'text-red-600'}`}>
                                -{isEstimated ? '~' : ''}${e.installment_amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                            </span>
                            {!isEstimated && <span className="text-gray-300 text-lg">›</span>}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
