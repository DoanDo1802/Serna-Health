import { useAuthStore } from '../store/useAuthStore'
import { IdentityService } from '../services/identity.service'
import { useState } from 'react'

export const useAuth = () => {
  const { user, isAuthenticated, dependents, setUser, logout: clearStore } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = async (email: string, pass: string) => {
    setLoading(true)
    setError(null)
    try {
      await IdentityService.login(email, pass)
      const session = await IdentityService.getSession()
      setUser(session)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await IdentityService.logout()
    } catch (e) {
      console.warn('Logout API warning:', e)
    } finally {
      clearStore()
    }
  }

  return {
    user,
    isAuthenticated,
    dependents,
    loading,
    error,
    login,
    logout
  }
}
