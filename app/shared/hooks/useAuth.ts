'use client'
import { useState, useEffect, useCallback } from 'react'
import { AuthService, AuthUser } from '@/app/services/auth.service'

export type { AuthUser }

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = AuthService.getUser()
    if (stored) {
      AuthService.obtenerInfoSesion()
        .then(u => setUser(u))
        .catch(() => {
          AuthService.logout()
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const resp = await AuthService.login(email, password)
    const u: AuthUser = { email: resp.email, nombre: resp.nombre, rol: resp.rol, aeropuerto: resp.aeropuerto }
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    AuthService.logout()
    setUser(null)
  }, [])

  const cambiarAeropuerto = useCallback((aeropuerto: string) => {
    AuthService.updateUser({ aeropuerto })
    setUser(prev => prev ? { ...prev, aeropuerto } : null)
  }, [])

  return {
    user,
    loading,
    login,
    logout,
    cambiarAeropuerto,
    isRegistrador: user?.rol === 'REGISTRADOR',
    isLogistica: user?.rol === 'LOGISTICA',
    isAdmin: user?.rol === 'ADMINISTRADOR',
    isAuthenticated: !!user,
  }
}
