const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

let currentToken = null
let onUnauthorized = null

export function setToken(token) { currentToken = token }
export function setOnUnauthorized(cb) { onUnauthorized = cb }

function authHeaders(extra = {}) {
    return currentToken
        ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}`, ...extra }
        : { 'Content-Type': 'application/json', ...extra }
}

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...options.headers },
    })
    if (res.status === 401) {
        if (onUnauthorized) onUnauthorized()
        const error = new Error('Unauthorized')
        error.status = 401
        throw error
    }
    if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`)
        error.status = res.status
        throw error
    }
    const text = await res.text()
    return text ? JSON.parse(text) : null
}

export const api = {
    // Cards
    getCards: () => request('/cards'),
    createCard: (data) => request('/cards', {method: 'POST', body: JSON.stringify(data)}),
    updateCard: (id, data) => request(`/cards/${id}`, {method: 'PUT', body: JSON.stringify(data)}),

    // Categories
    getCategories: () => request('/categories'),
    createCategory: (data) => request('/categories', {method: 'POST', body: JSON.stringify(data)}),
    updateCategory: (id, data) => request(`/categories/${id}`, {method: 'PUT', body: JSON.stringify(data)}),
    deleteCategory: (id) => request(`/categories/${id}`, {method: 'DELETE'}),

    // Expenses
    getExpenses: (cardId) => request(`/expenses${cardId ? `?card_id=${cardId}` : ''}`),
    createExpense: (data) => request('/expenses', {method: 'POST', body: JSON.stringify(data)}),
    deleteExpense: (id) => request(`/expenses/${id}`, {method: 'DELETE'}),

    // Summary
    getMonthlySummary: (month, year, cardId) => {
        const params = new URLSearchParams({month, year})
        if (cardId) params.append('card_id', cardId)
        return request(`/summary/monthly?${params}`)
    },
    getSummaryByCard: (month, year) =>
        request(`/summary/by-card?month=${month}&year=${year}`),
    getProjection: (months = 6, startMonth = null, startYear = null) => {
        const params = new URLSearchParams({ months })
        if (startMonth) params.append('start_month', startMonth)
        if (startYear) params.append('start_year', startYear)
        return request(`/summary/projection?${params}`)
    },

    // Exchange rates
    getExchangeRates: () => request('/exchange-rates'),
    getClosestExchangeRate: (month, year) => request(`/exchange-rates/closest?month=${month}&year=${year}`),
    createExchangeRate: (data) => request('/exchange-rates', {method: 'POST', body: JSON.stringify(data)}),
    updateExchangeRate: (id, data) => request(`/exchange-rates/${id}`, {method: 'PUT', body: JSON.stringify(data)}),

    // Recurring
    getRecurring: () => request('/recurring'),
    createRecurring: (data) => request('/recurring', {method: 'POST', body: JSON.stringify(data)}),
    updateRecurring: (id, data) => request(`/recurring/${id}`, {method: 'PUT', body: JSON.stringify(data)}),
    generateRecurring: (month, year) => request('/recurring/generate', {
        method: 'POST',
        body: JSON.stringify({month, year})
    }),

    updateExpense: (id, data) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Admin / Backup
    exportDB: async () => {
        const res = await fetch(`${BASE_URL}/admin/export-db`, {
            method: 'POST',
            headers: authHeaders(),
        })
        if (res.status === 401) { if (onUnauthorized) onUnauthorized(); throw new Error('Unauthorized') }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
    },
    importDB: async (file) => {
        const form = new FormData()
        form.append('file', file)
        const headers = { 'X-Confirm-Restore': 'true' }
        if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`
        const res = await fetch(`${BASE_URL}/admin/import-db`, {
            method: 'POST',
            headers,
            body: form,
        })
        if (res.status === 401) { if (onUnauthorized) onUnauthorized(); throw new Error('Unauthorized') }
        const text = await res.text()
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
        return JSON.parse(text)
    },

    // Cashflow
    getCashflowCategories: () => request('/cashflow/categories'),
    createCashflowCategory: (data) => request('/cashflow/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCashflowCategory: (id, data) => request(`/cashflow/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getCashflowEntries: (year) => request(`/cashflow/entries?year=${year}`),
    saveCashflowEntry: (data) => request('/cashflow/entries', { method: 'POST', body: JSON.stringify(data) }),
    deleteCashflowEntry: (id) => request(`/cashflow/entries/${id}`, { method: 'DELETE' }),
    getCardTotals: (year) => request(`/cashflow/card-totals?year=${year}`),

    truncateDB: async () => {
        const res = await fetch(`${BASE_URL}/admin/truncate-db`, {
            method: 'POST',
            headers: authHeaders({ 'X-Confirm-Truncate': 'true' }),
        })
        const text = await res.text()
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
        return JSON.parse(text)
    },
}