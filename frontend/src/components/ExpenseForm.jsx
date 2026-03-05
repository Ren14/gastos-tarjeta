import { useState } from 'react'
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

export function ExpenseForm({ cards, categories, onSaved }) {
    const today = new Date().toISOString().split('T')[0]
    const [form, setForm] = useState({
        card_id: cards[0]?.id ?? '',
        merchant: '',
        total_amount: '',
        installments: 1,
        purchase_date: today,
        category_id: '',
        notes: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const impactMonths = getImpactMonths(form.purchase_date, form.installments)
    const installmentAmount = form.total_amount && form.installments
        ? (parseFloat(form.total_amount) / form.installments).toFixed(2)
        : null

    async function handleSubmit() {
        if (!form.merchant || !form.total_amount || !form.card_id) {
            setError('Completá tarjeta, comercio y monto')
            return
        }
        setLoading(true)
        setError(null)
        try {
            await api.createExpense({
                ...form,
                card_id: Number(form.card_id),
                category_id: form.category_id ? Number(form.category_id) : null,
                total_amount: parseFloat(form.total_amount),
                installments: Number(form.installments),
            })
            setForm(f => ({ ...f, merchant: '', total_amount: '', installments: 1, notes: '' }))
            onSaved?.()
        } catch (e) {
            setError('Error al guardar el gasto')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tarjeta</label>
                <select value={form.card_id} onChange={e => set('card_id', e.target.value)}
                        className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-gray-900 outline-none">
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comercio</label>
                <input value={form.merchant} onChange={e => set('merchant', e.target.value)}
                       placeholder="Ej: Shell"
                       className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monto total</label>
                <input type="number" value={form.total_amount} onChange={e => set('total_amount', e.target.value)}
                       placeholder="$ 0,00"
                       className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cuotas</label>
                    <select value={form.installments} onChange={e => set('installments', Number(e.target.value))}
                            className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                        <option value={1}>1 — Contado</option>
                        {[2,3,6,9,12,18,24,36,48].map(n => <option key={n} value={n}>{n} cuotas</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha</label>
                    <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)}
                           className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categoría</label>
                <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
                        className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                    <option value="">🗂️ Varios</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
            </div>

            {form.installments > 1 && installmentAmount && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
                    <strong>{form.installments} cuotas de ${installmentAmount}</strong>
                    {' · impacta: '}{impactMonths.join(', ')}
                </div>
            )}

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <button onClick={handleSubmit} disabled={loading}
                    className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl text-sm tracking-wide disabled:opacity-50">
                {loading ? 'GUARDANDO...' : 'GUARDAR GASTO'}
            </button>
        </div>
    )
}