import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function useProjection(months = 6, startMonth = null, startYear = null) {
    const [projection, setProjection] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        api.getProjection(months, startMonth, startYear)
            .then(setProjection)
            .finally(() => setLoading(false))
    }, [months, startMonth, startYear])

    return { projection, loading }
}
