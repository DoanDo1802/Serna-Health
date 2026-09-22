"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { authApi, clearCsrfToken, type SessionView } from "@/lib/api"
import { currentTabContext, ensureTabContext, rotateTabContext } from "@/lib/tab-session-context"

export type PortalRole = "ADMIN" | "DOCTOR" | "STAFF"

interface User {
  email: string
  name: string
  role: PortalRole
  roleCodes: string[]
  permissions: string[]
  doctorId?: number | string
  doctorCode?: string
}

interface AuthContextType {
  user: User | null
  session: SessionView | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (patch: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STAFF_ROLE_CODES = new Set([
  "RECEPTIONIST",
  "QUEUE_COORDINATOR",
  "CASHIER",
  "FINANCE_APPROVER",
  "SECURITY_AUDITOR",
  "CLINICAL_RECORDS_MANAGER",
  "COMPLIANCE_REVIEWER",
  "INFRASTRUCTURE_OPERATOR",
])

function portalRoleFor(session: SessionView): PortalRole | null {
  const roles = new Set(session.roleCodes)
  if (roles.has("IDENTITY_ADMINISTRATOR") && session.permissions.includes("account.manage_role")) return "ADMIN"
  if (roles.has("DOCTOR")) return "DOCTOR"
  if (session.roleCodes.some((role) => STAFF_ROLE_CODES.has(role))) return "STAFF"
  return null
}

function userFromSession(session: SessionView): User | null {
  const role = portalRoleFor(session)
  if (!role) return null
  const savedName = typeof window !== "undefined" ? window.localStorage.getItem(`user_name_${session.accountId}`) : null
  return {
    email: session.displayEmail,
    name: savedName || session.displayEmail,
    role,
    roleCodes: session.roleCodes,
    permissions: session.permissions,
    doctorId: session.accountId,
  }
}

function remainsCurrentContext(context: string): boolean {
  return currentTabContext() === context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionView | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const clearAuth = useCallback(() => {
    clearCsrfToken()
    setSession(null)
    setUser(null)
  }, [])

  const applySession = useCallback((nextSession: SessionView) => {
    const nextUser = userFromSession(nextSession)
    if (!nextUser) {
      clearAuth()
      throw new Error("Tài khoản này chưa được cấp quyền vào Control Center")
    }
    setSession(nextSession)
    setUser(nextUser)
    return nextUser
  }, [clearAuth])

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      let context: string | null = null
      try {
        context = await ensureTabContext()
        const currentSession = await authApi.currentSession()
        if (!active || !remainsCurrentContext(context)) return
        applySession(currentSession)
      } catch {
        if (!active || !context || !remainsCurrentContext(context)) return
        clearAuth()
      } finally {
        if (active && (!context || remainsCurrentContext(context))) setLoading(false)
      }
    }

    void hydrate()
    return () => {
      active = false
    }
  }, [applySession, clearAuth])

  useEffect(() => {
    if (loading) return

    const isAuthRoute = pathname === "/login"
    const isPendingRoute = pathname === "/access-pending"
    const isAdminRoute = pathname === "/" || pathname.startsWith("/admin")
    const isDoctorRoute = pathname.startsWith("/doctor")

    if (!user) {
      if (!isAuthRoute) router.replace("/login?error=required")
      return
    }

    if (isAuthRoute) {
      if (user.role === "ADMIN") {
        router.replace("/")
      } else if (user.role === "DOCTOR") {
        router.replace("/doctor/waiting-patients")
      } else {
        router.replace("/access-pending")
      }
      return
    }

    if (user.role === "DOCTOR") {
      if (isAdminRoute || isPendingRoute || pathname === "/doctor") {
        router.replace("/doctor/waiting-patients")
      }
      return
    }

    if (user.role === "ADMIN") {
      if (isPendingRoute) {
        router.replace("/")
      }
      return
    }

    if (!isPendingRoute) {
      router.replace("/access-pending")
    }
  }, [loading, pathname, router, user])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      if (session) await authApi.logout()
    } catch {
      // Continue with a fresh context when the old session already expired or was revoked.
    }
    clearAuth()
    const context = rotateTabContext()
    try {
      const nextSession = await authApi.login({ email, password })
      if (!remainsCurrentContext(context)) return
      const nextUser = applySession(nextSession)
      if (nextUser.role === "ADMIN") {
        router.replace("/")
      } else if (nextUser.role === "DOCTOR") {
        router.replace("/doctor/waiting-patients")
      } else {
        router.replace("/access-pending")
      }
    } finally {
      if (remainsCurrentContext(context)) setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      clearAuth()
      router.replace("/login")
    }
  }

  const updateUser = (patch: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser
      const updated = { ...currentUser, ...patch }
      if (typeof window !== "undefined" && patch.name && session?.accountId) {
        window.localStorage.setItem(`user_name_${session.accountId}`, patch.name)
      }
      return updated
    })
  }

  const value = useMemo(() => ({ user, session, loading, login, logout, updateUser }), [user, session, loading])
  const isAuthRoute = pathname === "/login"
  const showContent = !loading && (isAuthRoute || user !== null)

  return (
    <AuthContext.Provider value={value}>
      {showContent ? children : (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="animate-pulse text-sm text-muted-foreground">Đang tải NOVAMED...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth phải được sử dụng bên trong AuthProvider")
  return context
}
