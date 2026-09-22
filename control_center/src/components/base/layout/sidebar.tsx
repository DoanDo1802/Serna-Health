"use client"

import { LayoutDashboard, Stethoscope, FolderHeart, Building2, Pill, FileText, CalendarClock, Users, ClipboardList, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/base/providers/auth-provider"
import { Button } from "@/components/base/ui/button"
import { NovaLogo } from "@/components/base/nova-logo"

export function Sidebar() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const adminMenu = [
    { icon: LayoutDashboard, label: "Báo cáo thống kê", href: "/" },
    { icon: Stethoscope, label: "Quản lý nhân sự", href: "/admin/doctors" },
    { icon: CalendarClock, label: "Lịch trực", href: "/admin/schedule" },
    { icon: FolderHeart, label: "Quản lý Chuyên khoa", href: "/admin/specialties" },
    { icon: Building2, label: "Quản lý Phòng khám", href: "/admin/clinics" },
    { icon: Pill, label: "Quản lý Thuốc", href: "/admin/medicines" },
    { icon: FileText, label: "Quản lý ICD-10", href: "/admin/icd" },
    { icon: ClipboardList, label: "Combo thuốc ICD-10", href: "/admin/treatment-templates" },
  ]

  const menuItems = user?.role === "ADMIN" ? adminMenu : []
  const isAdmin = user?.role === "ADMIN"

  return (
    <aside className="fixed top-0 left-0 w-64 bg-card border-r border-border p-4 h-screen flex flex-col justify-between lg:flex z-40">
      <div>
        <div className="flex items-center gap-2 mb-6 group cursor-pointer">
          <Link href={isAdmin ? "/" : "/access-pending"} className="flex items-center gap-2.5">
            <NovaLogo size={32} />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold tracking-tight text-foreground">NOVAMED</span>
              <span className="text-[10px] text-muted-foreground font-medium">Control Center</span>
            </div>
          </Link>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Danh mục</p>
            <nav className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onMouseEnter={() => setHoveredItem(item.label)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      hoveredItem === item.label && !isActive && "translate-x-1",
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-border">
        {user && (
          <div className="p-3 bg-secondary/50 rounded-lg border border-border/50 flex flex-col gap-0.5">
            <span className="font-semibold text-xs text-foreground truncate">{user.name}</span>
            <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
            <span className="inline-flex mt-1 items-center w-max px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary uppercase">
              {user.role === "ADMIN" ? "Quản trị viên" : user.role === "DOCTOR" ? "Bác sĩ" : "Nhân viên"}
            </span>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 h-9 text-xs border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/30 dark:hover:bg-destructive/20"
        >
          <LogOut className="w-3.5 h-3.5" />
          Đăng xuất
        </Button>
      </div>
    </aside>
  )
}
