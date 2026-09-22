"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/base/providers/auth-provider"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Alert, AlertDescription } from "@/components/base/ui/alert"
import { useToast } from "@/hooks/use-toast"
import {
  Key,
  Mail,
  ShieldAlert,
  ChevronRight
} from "lucide-react"
import { NovaLogo } from "@/components/base/nova-logo"

export default function LoginPage() {
  const { login } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const errorParam = params.get("error")
      if (errorParam) {
        let msg = "Yêu cầu xác thực không hợp lệ."
        let toastTitle = "Lỗi xác thực"
        if (errorParam === "required") {
          msg = "Vui lòng đăng nhập để truy cập trang quản trị / bác sĩ."
          toastTitle = "Yêu cầu đăng nhập"
        } else if (errorParam === "forbidden") {
          msg = "Tài khoản của bạn không có quyền truy cập hệ thống Quản trị / Bác sĩ."
          toastTitle = "Truy cập bị từ chối"
        } else if (errorParam === "session_expired") {
          msg = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          toastTitle = "Phiên đăng nhập hết hạn"
        }

        setError(msg)
        toast({
          title: toastTitle,
          description: msg,
          variant: "destructive",
        })

        // Dọn dẹp tham số URL
        const newUrl = window.location.pathname
        window.history.replaceState({}, document.title, newUrl)
      }
    }
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email, password)
    } catch (err: any) {
      const isPermissionError = err.message?.includes("quyền truy cập")
      const isConnectionError = err.message?.includes("Không thể kết nối")
      const msg = isPermissionError || isConnectionError
        ? err.message
        : "Email hoặc mật khẩu không hợp lệ"
      setError(msg)
      toast({
        title: "Đăng nhập thất bại",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="flex min-h-screen w-full bg-background overflow-hidden font-sans">

      {/* LEFT SIDE: Form Đăng nhập */}
      <div className="flex w-full flex-col justify-between p-8 lg:w-[45%] xl:w-[40%] bg-card border-r border-border/40 z-10">

        {/* Header Logo */}
        <div className="flex items-center gap-3">
          <NovaLogo size={40} />
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold tracking-tight text-foreground">NOVAMED</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Control Center</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="my-auto py-12 max-w-sm w-full mx-auto space-y-7 animate-slide-in-up">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Chào mừng trở lại</h2>
            <p className="text-sm text-muted-foreground">
              Vui lòng đăng nhập để truy cập hồ sơ bệnh án và lịch làm việc.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email đăng nhập</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/80" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@novamed.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-input focus-visible:ring-primary focus-visible:border-primary bg-background"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mật khẩu</Label>
              </div>
              <div className="relative">
                <Key className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/80" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-input focus-visible:ring-primary focus-visible:border-primary bg-background"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Xác thực tài khoản...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập hệ thống</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>


        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-muted-foreground/80">
          NOVAMED Control Center © {new Date().getFullYear()} • Hệ thống bảo mật thông tin chuẩn HIPAA
        </div>
      </div>

      {/* RIGHT SIDE: Hospital Visual */}
      <div className="relative hidden flex-1 overflow-hidden bg-emerald-950 lg:block">
        <img
          src="/images/hero-hospital.png"
          alt="Không gian bệnh viện NOVAMED với đội ngũ y tế đang hỗ trợ người bệnh"
          className="h-full min-h-screen w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-emerald-900/20 to-slate-950/55" />
        <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-white/10 to-transparent" />
      </div>

    </div>
  )
}
