import { useState, useEffect } from 'react'
import { api } from '../api/client'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function Config() {
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [usdToArs, setUsdToArs] = useState('')
    const [notes, setNotes] = useState('')
    const [rates, setRates] = useState([])
    const [recurring, setRecurring] = useState([])
    const [loading, setLoading] = useState(false)
    const [apiLoading, setApiLoading] = useState(false)
    const [apiError, setApiError] = useState(null)
    const [message, setMessage] = useState(null)
    const [genLoading, setGenLoading] = useState(false)

    useEffect(() => {
        api.getExchangeRates().then(setRates)
        api.getRecurring().then(setRecurring)
    }, [])

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