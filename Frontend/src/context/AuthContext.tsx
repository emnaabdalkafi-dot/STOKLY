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
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const updateUser = (updatedUser: User) => {
    setUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/me')
      .then(res => {
        if (res.data.success && res.data.data) {
          setUser(res.data.data)
        } else {
          // If the backend explicitly says success=false but doesn't throw 401,
          // it might mean the token is invalid or user not found.
          localStorage.removeItem('token')
        }
      })
      .catch((err) => {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          localStorage.removeItem('token')
        }
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