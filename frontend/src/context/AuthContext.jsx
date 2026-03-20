import { createContext, useContext, useState } from 'react'
import { setToken } from '../api/client'

const AuthContext = createContext(null)

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'
const STORAGE_KEY = 'auth_token'

export function AuthProvider({ children }) {
    const [token, setTokenState] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) setToken(saved)
        return saved
    })

    async function login(username, password, remember = false) {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        if (remember) {
            localStorage.setItem(STORAGE_KEY, data.token)
        }
        setTokenState(data.token)
        setToken(data.token)
        return data
    }

    function logout() {
        localStorage.removeItem(STORAGE_KEY)
        setTokenState(null)
        setToken(null)
    }

    return (
        <AuthContext.Provider value={{ token, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
