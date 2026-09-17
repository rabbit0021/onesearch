import { createContext, useContext, useState, useCallback } from 'react'

const EMAIL_KEY = 'onesearch_like_email'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [email, setEmailState] = useState(() => localStorage.getItem(EMAIL_KEY) || '')

  const setEmail = useCallback((e) => {
    if (e) localStorage.setItem(EMAIL_KEY, e)
    else localStorage.removeItem(EMAIL_KEY)
    setEmailState(e || '')
  }, [])

  const logout = useCallback(() => setEmail(''), [setEmail])

  return (
    <AuthContext.Provider value={{ email, setEmail, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
