const BASE_URL = 'http://localhost:8080/api/v1'

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (res.status === 204) return null
    return res.json()
}

export const api = {
    // Cards
    getCards: () => request('/cards'),
    createCard: (data) => request('/cards', { method: 'POST', body: JSON.stringify(data) }),

    // Categories
    getCategories: () => request('/categories'),

    // Expenses
    getExpenses: (cardId) => request(`/expenses${cardId ? `?card_id=${cardId}` : ''}`),
    createExpense: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),

    // Summary
    getMonthlySummary: (month, year, cardId) => {
        const params = new URLSearchParams({ month, year })
        if (cardId) params.append('card_id', cardId)
        return request(`/summary/monthly?${params}`)
    },
    getSummaryByCard: (month, year) =>
        request(`/summary/by-card?month=${month}&year=${year}`),
    getProjection: (months = 6) => request(`/summary/projection?months=${months}`),
}