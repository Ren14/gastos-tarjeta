import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function useCards() {
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.getCards()
            .then(setCards)
            .finally(() => setLoading(false))
    }, [])

    return { cards, loading }
}