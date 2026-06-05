import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../services/api'

export interface User {
  id?: number
  nom: string
  prenom: string
  email?: string
  tel?: string
  avatar?: string
  role?: string
}

interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = (user: User) => {
    setUser(user)
    try {
      localStorage.setItem('user', JSON.stringify(user))
    } catch (e) {
      // ignore storage errors
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const updateUser = (updatedUser: User) => {
    setUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser)
    try {
      const merged = (user && { ...(user as User), ...updatedUser }) || updatedUser
      localStorage.setItem('user', JSON.stringify(merged))
    } catch (e) {
      // ignore storage errors
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    // initialize from localStorage so the app doesn't appear logged-out during transient network issues
    try {
      const saved = localStorage.getItem('user')
      if (saved) {
        setUser(JSON.parse(saved))
      }
    } catch (e) {
      // ignore parse errors
    }

    if (token) {
      // Try to refresh user in background. Don't clear token/user on network errors.
      api.get('/me')
      .then(res => {
        if (res.data.success && res.data.data) {
          setUser(res.data.data)
          try {
            localStorage.setItem('user', JSON.stringify(res.data.data))
          } catch (e) {}
        } else {
          // token invalid according to backend
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
      })
      .catch((err) => {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
        }
        // for other errors (network/timeouts) keep the saved user and token
      })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}