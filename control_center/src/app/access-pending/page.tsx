"use client"

import { LogOut, ShieldCheck } from "lucide-react"
import { useAuth } from "@/components/base/providers/auth-provider"
import { Button } from "@/components/base/ui/button"

export default function AccessPendingPage() {
  const { user, logout } = useAuth()
  const isDoctor = user?.role === "DOCTOR"

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl shadow-primary/5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-primary">MediCore Control Center</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">Đăng nhập thành công</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isDoctor
            ? "Tài khoản bác sĩ đã được xác thực. Workspace nghiệp vụ đang được hoàn thiện và chưa được kích hoạt."
            : "Tài khoản nhân viên đã được xác thực. Các chức năng phù hợp sẽ hiển thị khi workflow được kích hoạt."}
        </p>
        <p className="mt-5 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">{user?.email}</p>
        <Button
          variant="outline"
          onClick={() => void logout()}
          className="mt-6 h-10 w-full gap-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </section>
    </main>
  )
}
