import { useState, useEffect } from 'react'
import { api } from '../api/client'

export function useCategories() {
    const [categories, setCategories] = useState([])

    useEffect(() => {
        api.getCategories().then(setCategories)
    }, [])

    return { categories }
}