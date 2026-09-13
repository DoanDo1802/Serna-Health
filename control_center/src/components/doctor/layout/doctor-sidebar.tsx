"use client"

import { Users, ClipboardList, FileText, Calendar, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/base/providers/auth-provider"
import { Button } from "@/components/base/ui/button"
// Import Component Modal vừa tạo (Đảm bảo file doctor-profile-modal.tsx nằm cùng thư mục)
import { DoctorProfileModal } from "../profile/doctor-profile-modal"

const doctorMenuItems = [
  { icon: Users, label: "Bệnh nhân chờ", href: "/doctor/waiting-patients" },
  { icon: ClipboardList, label: "Kê đơn thuốc", href: "/doctor/prescriptions" },
  { icon: FileText, label: "Hồ sơ bệnh nhân", href: "/doctor/patient-records" },
  { icon: Calendar, label: "Lịch làm việc", href: "/doctor/schedule" },
]

export function DoctorSidebar() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  
  // 1. Thêm state quản lý việc đóng/mở Modal
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  
  const pathname = usePathname()
  const { user, logout, updateUser } = useAuth()

  // 2. Hàm xử lý khi ấn "Lưu thay đổi" từ Modal
  const handleSaveProfile = (updatedData: any) => {
    updateUser({ name: updatedData.name ?? updatedData.doctorName ?? user?.name })
  }

  return (
    <aside className="fixed top-0 left-0 w-64 bg-card border-r border-border p-4 h-screen flex flex-col justify-between lg:flex z-40">
      <div>
        <div className="flex items-center gap-2 mb-6 group cursor-pointer">
          <Link href="/doctor/waiting-patients" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center transition-transform group-hover:scale-110 duration-300">
              <span className="relative flex items-center justify-center">
                <span className="absolute w-4 h-1 bg-primary-foreground rounded-full" />
                <span className="absolute w-1 h-4 bg-primary-foreground rounded-full" />
              </span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold text-foreground">MediCore</span>
              <span className="text-[10px] text-muted-foreground">Bác sĩ</span>
            </div>
          </Link>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Chức năng bác sĩ</p>
            <nav className="space-y-0.5">
              {doctorMenuItems.map((item) => {
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
          // 3. Biến khối này thành button để bấm mở Modal
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="w-full text-left p-3 bg-secondary/50 rounded-lg border border-border/50 flex flex-col gap-0.5 hover:bg-secondary/80 transition-colors group cursor-pointer"
          >
            <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
              {user.name}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
            <span className="inline-flex mt-1 items-center w-max px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary uppercase">
              Bác sĩ
            </span>
          </button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 h-9 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-950 dark:hover:bg-red-950/20"
        >
          <LogOut className="w-3.5 h-3.5" />
          Đăng xuất
        </Button>
      </div>

      {/* 4. Gắn Modal vào Component (Chỉ render nội dung khi isProfileOpen = true) */}
      <DoctorProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        currentDoctor={user}
        onSave={handleSaveProfile}
      />
    </aside>
  )
}