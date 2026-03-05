import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function useMonthlySummary(month, year, cardId) {
    const [summary, setSummary] = useState(null)
    const [byCard, setByCard] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        const promises = [api.getSummaryByCard(month, year)]
        if (cardId) promises.push(api.getMonthlySummary(month, year, cardId))

        Promise.all(promises)
            .then(([byCardData, summaryData]) => {
                setByCard(byCardData)
                if (summaryData) setSummary(summaryData)
                else setSummary(null)
            })
            .finally(() => setLoading(false))
    }, [month, year, cardId])

    return { summary, byCard, loading }
}