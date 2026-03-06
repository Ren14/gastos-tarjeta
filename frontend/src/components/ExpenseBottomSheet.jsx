import { useState, useEffect } from 'react'
import { api } from '../api/client'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function getImpactMonths(dateStr, installments) {
    if (!dateStr || !installments) return []
    const date = new Date(dateStr)
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const daysFromEnd = lastDay - date.getDate()
    const offset = daysFromEnd < 2 ? 2 : 1
    const months = []
    for (let i = 0; i < installments; i++) {
        const d = new Date(date.getFullYear(), date.getMonth() + offset + i, 1)
        months.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`)
    }
    return months
}

export function ExpenseBottomSheet({ expense, cards, categories, onClose, onSaved, onDeleted }) {
    const [form, setForm] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(false)

    useEffect(() => {
        if (expense) {
            // Normalizar la fecha a formato ISO YYYY-MM-DD
            let purchaseDate = new Date().toISOString().split('T')[0]
            if (expense.purchase_date) {
                purchaseDate = expense.purchase_date.substring(0, 10)
            }

            setForm({
                card_id: expense.card_id ?? '',
                merchant: expense.merchant ?? '',
                total_amount: expense.total_amount ?? '',
                installments: expense.total_installments ?? 1,
                purchase_date: purchaseDate,
                category_id: expense.category_id ?? '',
                notes: expense.notes ?? '',
            })
            setConfirmDelete(false)
            setError(null)
        }
    }, [expense])

    if (!expense || !form) return null

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const impactMonths = getImpactMonths(form.purchase_date, form.installments)
    const installmentAmount = form.total_amount && form.installments
        ? (parseFloat(form.total_amount) / form.installments).toFixed(2)
        : null

    async function handleSave() {
        setError(null)
        setLoading(true)
        try {
            await api.updateExpense(expense.expense_id, {
                ...form,
                card_id: Number(form.card_id),
                category_id: form.category_id ? Number(form.category_id) : null,
                total_amount: parseFloat(form.total_amount),
                installments: Number(form.installments),
            })
            setError(null)
            onSaved?.()
            onClose()
        } catch (e) {
            setError('Error al guardar')
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete() {
        if (!confirmDelete) {
            setConfirmDelete(true)
            return
        }
        setLoading(true)
        try {
            await api.deleteExpense(expense.expense_id)
            onDeleted?.()
            onClose()
        } catch (e) {
            setError('Error al eliminar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-w-md mx-auto">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                <div className="px-4 pb-8 pt-2 flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-sm font-bold uppercase tracking-wide">Edit expense</h3>
                        <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
                    </div>

                    {/* Card */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Card</label>
                        <select value={form.card_id} onChange={e => set('card_id', e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Merchant */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Merchant</label>
                        <input value={form.merchant} onChange={e => set('merchant', e.target.value)}
                               className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total amount</label>
                        <input type="number" value={form.total_amount} onChange={e => set('total_amount', e.target.value)}
                               className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                    </div>

                    {/* Installments + Date */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Installments</label>
                            <select value={form.installments} onChange={e => set('installments', Number(e.target.value))}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                                <option value={1}>1 — Cash</option>
                                {[2,3,6,9,12,18,24,36,48].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</label>
                            <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)}
                                   className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Category</label>
                        <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
                                className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                            <option value="">🗂️ Other</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                    </div>

                    {/* Impact preview */}
                    {form.installments > 1 && installmentAmount && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
                            <strong>{form.installments} installments of ${installmentAmount}</strong>
                            {' · impacts: '}{impactMonths.join(', ')}
                        </div>
                    )}

                    {error && <p className="text-red-500 text-xs">{error}</p>}

                    {/* Actions */}
                    <button onClick={handleSave} disabled={loading}
                            className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl text-sm tracking-wide disabled:opacity-50">
                        {loading ? 'Saving...' : 'Save changes'}
                    </button>

                    <button onClick={handleDelete} disabled={loading}
                            className={`w-full font-bold py-3 rounded-xl text-sm tracking-wide transition-colors ${
                                confirmDelete
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white border-2 border-red-200 text-red-500 hover:border-red-400'
                            }`}>
                        {confirmDelete ? '⚠️ Confirm delete' : 'Delete expense'}
                    </button>

                    {confirmDelete && (
                        <button onClick={() => setConfirmDelete(false)}
                                className="text-xs text-gray-400 text-center">
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </>
    )
}