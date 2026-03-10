import { useState, useEffect } from 'react'
import { api } from '../api/client'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CARD_TYPES = ['VISA', 'MASTERCARD', 'AMEX']
const EMPTY_CARD = { name: '', bank: '', card_type: 'VISA', color_hex: '#6366f1' }

function CardForm({ form, setForm }) {
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    return (
        <>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nombre</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                       placeholder="Visa Gold"
                       className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Banco</label>
                <input value={form.bank} onChange={e => set('bank', e.target.value)}
                       placeholder="Galicia"
                       className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo</label>
                    <select value={form.card_type} onChange={e => set('card_type', e.target.value)}
                            className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                        {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Color</label>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-9 h-9 rounded-lg border-2 border-gray-200 flex-shrink-0"
                              style={{ backgroundColor: form.color_hex }} />
                        <input value={form.color_hex} onChange={e => set('color_hex', e.target.value)}
                               placeholder="#6366f1"
                               className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                    </div>
                </div>
            </div>
        </>
    )
}

function CardsSection() {
    const [cards, setCards] = useState([])
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState(null)
    const [adding, setAdding] = useState(false)
    const [newCard, setNewCard] = useState(EMPTY_CARD)
    const [confirmDeactivate, setConfirmDeactivate] = useState(null)
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState(null)

    useEffect(() => {
        api.getCards().then(data => setCards(data.filter(c => c.active)))
    }, [])

    function startEdit(card) {
        setEditingId(card.id)
        setEditForm({ name: card.name, bank: card.bank, card_type: card.card_type, color_hex: card.color_hex })
        setAdding(false)
        setConfirmDeactivate(null)
    }

    async function handleSaveEdit() {
        setLoading(true)
        setMsg(null)
        try {
            await api.updateCard(editingId, { ...editForm, active: true })
            const updated = await api.getCards()
            setCards(updated.filter(c => c.active))
            setEditingId(null)
            setMsg({ type: 'success', text: 'Tarjeta actualizada' })
        } catch {
            setMsg({ type: 'error', text: 'Error al guardar' })
        } finally {
            setLoading(false)
        }
    }

    async function handleDeactivate(card) {
        if (confirmDeactivate !== card.id) {
            setConfirmDeactivate(card.id)
            return
        }
        setLoading(true)
        try {
            await api.updateCard(card.id, { name: card.name, bank: card.bank, card_type: card.card_type, color_hex: card.color_hex, active: false })
            setCards(prev => prev.filter(c => c.id !== card.id))
            setEditingId(null)
            setConfirmDeactivate(null)
            setMsg({ type: 'success', text: 'Tarjeta desactivada' })
        } catch {
            setMsg({ type: 'error', text: 'Error al desactivar' })
        } finally {
            setLoading(false)
        }
    }

    async function handleAddCard() {
        setLoading(true)
        setMsg(null)
        try {
            await api.createCard({ ...newCard, active: true })
            const updated = await api.getCards()
            setCards(updated.filter(c => c.active))
            setNewCard(EMPTY_CARD)
            setAdding(false)
            setMsg({ type: 'success', text: 'Tarjeta creada' })
        } catch {
            setMsg({ type: 'error', text: 'Error al crear tarjeta' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Tarjetas</h2>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                {cards.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No hay tarjetas activas</p>
                )}
                {cards.map((card, i) => (
                    <div key={card.id} className={i < cards.length - 1 || editingId === card.id ? 'border-b border-gray-100' : ''}>
                        <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: card.color_hex }} />
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{card.name}</p>
                                    <p className="text-xs text-gray-400">{card.bank} · {card.card_type}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => editingId === card.id ? setEditingId(null) : startEdit(card)}
                                className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2 py-1"
                            >
                                {editingId === card.id ? 'Cancelar' : 'Editar'}
                            </button>
                        </div>

                        {editingId === card.id && (
                            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-100 pt-3">
                                <CardForm form={editForm} setForm={setEditForm} />
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleDeactivate(card)}
                                        disabled={loading}
                                        className={`py-2 rounded-xl text-xs font-bold border-2 transition-colors disabled:opacity-50 ${
                                            confirmDeactivate === card.id
                                                ? 'bg-red-600 text-white border-red-600'
                                                : 'text-red-500 border-red-200 hover:border-red-400 bg-white'
                                        }`}
                                    >
                                        {confirmDeactivate === card.id ? 'Confirmar' : 'Desactivar'}
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={loading || !editForm?.name}
                                        className="py-2 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                                    >
                                        {loading ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {adding ? (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 mb-3 flex flex-col gap-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nueva tarjeta</p>
                    <CardForm form={newCard} setForm={setNewCard} />
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setAdding(false)}
                            className="py-2 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:border-gray-400"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAddCard}
                            disabled={loading || !newCard.name}
                            className="py-2 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Crear'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => { setAdding(true); setEditingId(null) }}
                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors mb-3"
                >
                    + Agregar tarjeta
                </button>
            )}

            {msg && (
                <p className={`text-xs px-3 py-2 rounded-lg border ${
                    msg.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-500'
                }`}>
                    {msg.text}
                </p>
            )}
        </div>
    )
}

const EMPTY_RECURRING = { merchant: '', card_id: '', category_id: '', amount_usd: '' }

function RecurringForm({ form, setForm, cards, categories }) {
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    return (
        <>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comercio</label>
                <input value={form.merchant} onChange={e => set('merchant', e.target.value)}
                       placeholder="Netflix"
                       className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tarjeta</label>
                    <select value={form.card_id} onChange={e => set('card_id', e.target.value)}
                            className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                        <option value="">— Seleccionar —</option>
                        {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monto USD</label>
                    <input type="number" value={form.amount_usd} onChange={e => set('amount_usd', e.target.value)}
                           placeholder="9.99"
                           className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categoría (opcional)</label>
                <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
                        className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
            </div>
        </>
    )
}

function RecurringSection({ recurring, cards, categories, onRefresh }) {
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState(null)
    const [adding, setAdding] = useState(false)
    const [newItem, setNewItem] = useState(EMPTY_RECURRING)
    const [confirmDeactivate, setConfirmDeactivate] = useState(null)
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState(null)

    function startEdit(item) {
        setEditingId(item.id)
        setEditForm({
            merchant: item.merchant,
            card_id: item.card_id,
            category_id: item.category_id ?? '',
            amount_usd: item.amount_usd,
        })
        setAdding(false)
        setConfirmDeactivate(null)
    }

    async function handleSaveEdit() {
        setLoading(true)
        setMsg(null)
        try {
            await api.updateRecurring(editingId, {
                merchant: editForm.merchant,
                card_id: Number(editForm.card_id),
                category_id: editForm.category_id ? Number(editForm.category_id) : null,
                amount_usd: parseFloat(editForm.amount_usd),
                active: true,
            })
            setEditingId(null)
            setMsg({ type: 'success', text: 'Recurrente actualizado' })
            onRefresh()
        } catch {
            setMsg({ type: 'error', text: 'Error al guardar' })
        } finally {
            setLoading(false)
        }
    }

    async function handleDeactivate(item) {
        if (confirmDeactivate !== item.id) {
            setConfirmDeactivate(item.id)
            return
        }
        setLoading(true)
        try {
            await api.updateRecurring(item.id, {
                merchant: item.merchant,
                card_id: item.card_id,
                category_id: item.category_id ?? null,
                amount_usd: item.amount_usd,
                active: false,
            })
            setEditingId(null)
            setConfirmDeactivate(null)
            setMsg({ type: 'success', text: 'Recurrente desactivado' })
            onRefresh()
        } catch {
            setMsg({ type: 'error', text: 'Error al desactivar' })
        } finally {
            setLoading(false)
        }
    }

    async function handleAdd() {
        setLoading(true)
        setMsg(null)
        try {
            await api.createRecurring({
                merchant: newItem.merchant,
                card_id: Number(newItem.card_id),
                category_id: newItem.category_id ? Number(newItem.category_id) : null,
                amount_usd: parseFloat(newItem.amount_usd),
            })
            setNewItem(EMPTY_RECURRING)
            setAdding(false)
            setMsg({ type: 'success', text: 'Recurrente creado' })
            onRefresh()
        } catch {
            setMsg({ type: 'error', text: 'Error al crear recurrente' })
        } finally {
            setLoading(false)
        }
    }

    const canAdd = newItem.merchant && newItem.card_id && newItem.amount_usd

    return (
        <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Recurrentes</h2>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                {recurring.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No hay gastos recurrentes activos</p>
                )}
                {recurring.map((item, i) => {
                    const card = cards.find(c => c.id === item.card_id)
                    const cat = categories.find(c => c.id === item.category_id)
                    return (
                        <div key={item.id} className={i < recurring.length - 1 || editingId === item.id ? 'border-b border-gray-100' : ''}>
                            <div className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-base leading-none">{cat?.icon ?? '🔁'}</span>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{item.merchant}</p>
                                        <p className="text-xs text-gray-400">{card?.name ?? '—'} · USD {item.amount_usd}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => editingId === item.id ? setEditingId(null) : startEdit(item)}
                                    className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2 py-1"
                                >
                                    {editingId === item.id ? 'Cancelar' : 'Editar'}
                                </button>
                            </div>

                            {editingId === item.id && (
                                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-100 pt-3">
                                    <RecurringForm form={editForm} setForm={setEditForm} cards={cards} categories={categories} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleDeactivate(item)}
                                            disabled={loading}
                                            className={`py-2 rounded-xl text-xs font-bold border-2 transition-colors disabled:opacity-50 ${
                                                confirmDeactivate === item.id
                                                    ? 'bg-red-600 text-white border-red-600'
                                                    : 'text-red-500 border-red-200 hover:border-red-400 bg-white'
                                            }`}
                                        >
                                            {confirmDeactivate === item.id ? 'Confirmar' : 'Desactivar'}
                                        </button>
                                        <button
                                            onClick={handleSaveEdit}
                                            disabled={loading || !editForm?.merchant || !editForm?.card_id}
                                            className="py-2 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                                        >
                                            {loading ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {adding ? (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 mb-3 flex flex-col gap-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nuevo recurrente</p>
                    <RecurringForm form={newItem} setForm={setNewItem} cards={cards} categories={categories} />
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => { setAdding(false); setNewItem(EMPTY_RECURRING) }}
                            className="py-2 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:border-gray-400"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={loading || !canAdd}
                            className="py-2 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Crear'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => { setAdding(true); setEditingId(null) }}
                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors mb-3"
                >
                    + Agregar recurrente
                </button>
            )}

            {msg && (
                <p className={`text-xs px-3 py-2 rounded-lg border ${
                    msg.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-500'
                }`}>
                    {msg.text}
                </p>
            )}
        </div>
    )
}

export function Config() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [usdToArs, setUsdToArs] = useState('')
    const [notes, setNotes] = useState('')
    const [rates, setRates] = useState([])
    const [recurring, setRecurring] = useState([])
    const [cards, setCards] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(false)
    const [apiLoading, setApiLoading] = useState(false)
    const [apiError, setApiError] = useState(null)
    const [message, setMessage] = useState(null)
    const [genLoading, setGenLoading] = useState(false)

    useEffect(() => {
        api.getExchangeRates().then(setRates)
        api.getRecurring().then(setRecurring)
        api.getCards().then(data => setCards(data.filter(c => c.active)))
        api.getCategories().then(setCategories)
    }, [])

    function refreshRecurring() {
        api.getRecurring().then(setRecurring)
    }

    // Cuando cambia mes/año, pre-cargar cotización guardada si existe
    useEffect(() => {
        const existing = rates.find(r => r.month === month && r.year === year)
        if (existing) {
            setUsdToArs(existing.usd_to_ars.toString())
        } else {
            setUsdToArs('')
        }
        setNotes('')
        setMessage(null)
    }, [month, year, rates])

    const currentRate = rates.find(r => r.month === month && r.year === year)

    async function fetchFromAPI() {
        setApiLoading(true)
        setApiError(null)
        try {
            const res = await fetch('https://criptoya.com/api/dolar')
            const data = await res.json()
            const price = data?.oficial?.price
            if (!price) throw new Error('No se encontró el precio oficial')
            setUsdToArs(price.toString())
        } catch (e) {
            setApiError(`Error al obtener cotización: ${e.message}`)
        } finally {
            setApiLoading(false)
        }
    }

    async function handleSaveRate() {
        if (!usdToArs) return
        setLoading(true)
        setMessage(null)
        try {
            await api.createExchangeRate({
                month,
                year,
                usd_to_ars: parseFloat(usdToArs),
                notes: notes || null,
            })
            const updated = await api.getExchangeRates()
            setRates(updated)
            setMessage({ type: 'success', text: 'Cotización guardada correctamente' })
        } catch (e) {
            setMessage({ type: 'error', text: 'Error al guardar la cotización' })
        } finally {
            setLoading(false)
        }
    }

    async function handleGenerate() {
        setGenLoading(true)
        setMessage(null)
        try {
            const res = await api.generateRecurring(month, year)
            setMessage({ type: 'success', text: `${res.generated} recurrentes generados para ${MONTHS[month-1]} ${year}` })
        } catch (e) {
            const text = e.status === 402
                ? 'Primero guardá la cotización del mes'
                : e.status === 409
                    ? `Los recurrentes de ${MONTHS[month-1]} ${year} ya fueron generados`
                    : 'Error al generar recurrentes'
            setMessage({ type: 'error', text })
        } finally {
            setGenLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">

            {/* Tarjetas */}
            <CardsSection />

            {/* Recurrentes */}
            <RecurringSection
                recurring={recurring}
                cards={cards}
                categories={categories}
                onRefresh={refreshRecurring}
            />

            {/* Cotización */}
            <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    Cotización USD oficial
                </h2>

                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mes</label>
                            <select value={month} onChange={e => setMonth(Number(e.target.value))}
                                    className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none">
                                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Año</label>
                            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                                   className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                        </div>
                    </div>

                    {/* Badge cotización existente */}
                    {currentRate && (
                        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex justify-between items-center">
              <span className="text-xs text-green-700 font-semibold">
                Cotización guardada para {MONTHS[month-1]} {year}
              </span>
                            <span className="text-sm font-bold text-green-700">
                ${parseFloat(currentRate.usd_to_ars).toLocaleString('es-AR')}
              </span>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            {currentRate ? 'Actualizar cotización' : '1 USD = ARS'}
                        </label>
                        <input type="number" value={usdToArs} onChange={e => setUsdToArs(e.target.value)}
                               placeholder="Ej: 1150"
                               className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Referencia (opcional)</label>
                        <input value={notes} onChange={e => setNotes(e.target.value)}
                               placeholder="Dólar blue / oficial..."
                               className="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-gray-900 outline-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={fetchFromAPI} disabled={apiLoading}
                                className="py-2 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-gray-900 transition-colors disabled:opacity-50">
                            {apiLoading ? 'Obteniendo...' : '🌐 Obtener API'}
                        </button>
                        <button onClick={handleSaveRate} disabled={loading || !usdToArs}
                                className="py-2 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                            {loading ? 'Guardando...' : currentRate ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>

                    {apiError && (
                        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {apiError}
                        </p>
                    )}
                </div>
            </div>

            {/* Generar recurrentes */}
            <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    Generar recurrentes
                </h2>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3">
                    <p className="text-xs text-gray-500 mb-3">
                        Genera los gastos recurrentes de <strong>{MONTHS[month-1]} {year}</strong> usando la cotización cargada.
                        {currentRate && (
                            <span className="text-green-600 ml-1">
                (1 USD = ${parseFloat(currentRate.usd_to_ars).toLocaleString('es-AR')})
              </span>
                        )}
                    </p>
                    <div className="flex flex-col gap-1 mb-3">
                        {recurring.map(r => {
                            const arsAmount = currentRate ? (r.amount_usd * currentRate.usd_to_ars) : null
                            return (
                                <div key={r.id} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                                    <span className="text-gray-700">{r.merchant}</span>
                                    <div className="flex gap-2">
                                        {arsAmount && (
                                            <span className="text-green-600 font-semibold">
                        ${arsAmount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                      </span>
                                        )}
                                        <span className="text-gray-400">USD {r.amount_usd}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <button onClick={handleGenerate} disabled={genLoading}
                            className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                        {genLoading ? 'Generando...' : `Generar para ${MONTHS[month-1]} ${year}`}
                    </button>
                </div>
            </div>

            {/* Mensaje feedback */}
            {message && (
                <p className={`text-xs px-3 py-2 rounded-lg border ${
                    message.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-500'
                }`}>
                    {message.text}
                </p>
            )}

            {/* Historial */}
            <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Exchange rate history
                </h2>
                {rates.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Sin cotizaciones cargadas</p>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        {rates.map((r, i) => (
                            <div key={r.id}
                                 className={`flex justify-between items-center px-4 py-3 text-sm ${i < rates.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                <span className="text-gray-600">{MONTHS[r.month-1]} {r.year}</span>
                                <span className="font-bold text-green-600">
                  ${parseFloat(r.usd_to_ars).toLocaleString('es-AR')}
                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    )
}