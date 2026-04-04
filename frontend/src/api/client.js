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
    // Flujo clasificaciones
    getClasificaciones: () => request('/flujo/clasificaciones'),
    createClasificacion: (data) => request('/flujo/clasificaciones', { method: 'POST', body: JSON.stringify(data) }),
    updateClasificacion: (id, data) => request(`/flujo/clasificaciones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteClasificacion: (id) => request(`/flujo/clasificaciones/${id}`, { method: 'DELETE' }),
    updateCategoryClasificacion: (categoryId, clasificacionId) =>
        request(`/cashflow/categories/${categoryId}/clasificacion`, { method: 'PUT', body: JSON.stringify({ clasificacion_id: clasificacionId }) }),

    getCashflowCategories: () => request('/cashflow/categories'),
    createCashflowCategory: (data) => request('/cashflow/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCashflowCategory: (id, data) => request(`/cashflow/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    reorderCashflowCategories: (data) => request('/cashflow/categories/reorder', { method: 'PUT', body: JSON.stringify(data) }),
    getCashflowEntries: (year) => request(`/cashflow/entries?year=${year}`),
    saveCashflowEntry: (data) => request('/cashflow/entries', { method: 'POST', body: JSON.stringify(data) }),
    deleteCashflowEntry: (id) => request(`/cashflow/entries/${id}`, { method: 'DELETE' }),
    updateCashflowEntryNote: (id, note) => request(`/cashflow/entries/${id}/note`, { method: 'PUT', body: JSON.stringify({ note }) }),
    getCardTotals: (year) => request(`/cashflow/card-totals?year=${year}`),

    // Dashboards
    getCardSpendingDashboard: (year) => request(`/dashboards/card-spending?year=${year}`),
    getCashflowDashboard: (year) => request(`/dashboards/cashflow?year=${year}`),
    getSavingsDashboard: (year) => request(`/dashboards/savings?year=${year}`),

    // USD Savings
    getUsdSavings: () => request('/usd-savings'),
    createUsdSaving: (data) => request('/usd-savings', { method: 'POST', body: JSON.stringify(data) }),
    updateUsdSaving: (id, data) => request(`/usd-savings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUsdSaving: (id) => request(`/usd-savings/${id}`, { method: 'DELETE' }),
    getDolarRate: () => request('/usd-savings/rate'),

    // Cobranzas
    getCobranzas: (year) => request(`/cobranzas?year=${year}`),

    // TODO Tasks
    getTodos: (month, year) => request(`/todos?month=${month}&year=${year}`),
    completeTodo: (data) => request('/todos/complete', { method: 'POST', body: JSON.stringify(data) }),
    uncompleteTodo: (data) => request('/todos/uncomplete', { method: 'POST', body: JSON.stringify(data) }),
    updateTodoDueDate: (data) => request('/todos/due-date', { method: 'PUT', body: JSON.stringify(data) }),
    updateTodoMPReserved: (data) => request('/todos/mp-reserved', { method: 'PUT', body: JSON.stringify(data) }),

    // Audit log
    getAuditLog: (limit = 50, offset = 0, entityType = '') => {
        const params = new URLSearchParams({ limit, offset })
        if (entityType) params.append('entity_type', entityType)
        return request(`/audit?${params}`)
    },

    // Splits
    getSplits: () => request('/splits'),
    createSplit: (data) => request('/splits', { method: 'POST', body: JSON.stringify(data) }),
    getSplit: (id) => request(`/splits/${id}`),
    updateSplit: (id, data) => request(`/splits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSplit: (id) => request(`/splits/${id}`, { method: 'DELETE' }),
    getSplitParticipants: (id) => request(`/splits/${id}/participants`),
    addParticipant: (id, data) => request(`/splits/${id}/participants`, { method: 'POST', body: JSON.stringify(data) }),
    updateParticipant: (id, pid, data) => request(`/splits/${id}/participants/${pid}`, { method: 'PUT', body: JSON.stringify(data) }),
    removeParticipant: (id, pid) => request(`/splits/${id}/participants/${pid}`, { method: 'DELETE' }),
    getSplitMatrix: (id, year) => request(`/splits/${id}/matrix?year=${year}`),
    saveSplitEntry: (id, data) => request(`/splits/${id}/entries`, { method: 'POST', body: JSON.stringify(data) }),

    setupTelegramWebhook: () => request('/admin/setup-telegram-webhook', { method: 'POST' }),

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