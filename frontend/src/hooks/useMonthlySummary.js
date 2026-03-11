import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function useMonthlySummary(month, year, cardId, refreshKey = 0) {
    const [summary, setSummary] = useState(null)
    const [allExpenses, setAllExpenses] = useState([])
    const [byCard, setByCard] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        const promises = [
            api.getSummaryByCard(month, year),
            api.getMonthlySummary(month, year),
        ]
        if (cardId) promises.push(api.getMonthlySummary(month, year, cardId))

        Promise.all(promises)
            .then(([byCardData, allSummaryData, summaryData]) => {
                setByCard(byCardData)
                setAllExpenses(allSummaryData?.expenses ?? [])
                if (summaryData) setSummary(summaryData)
                else setSummary(null)
            })
            .finally(() => setLoading(false))
    }, [month, year, cardId, refreshKey])

    return { summary, allExpenses, byCard, loading }
}
