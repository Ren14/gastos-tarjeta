const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    })
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
}