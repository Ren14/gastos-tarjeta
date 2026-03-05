import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function useProjection(months = 6) {
    const [projection, setProjection] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.getProjection(months)
            .then(setProjection)
            .finally(() => setLoading(false))
    }, [months])

    return { projection, loading }
}