"use client"

import { Card } from "@/components/base/ui/card"
import { useData } from "@/components/base/providers/data-provider"
import { Calendar, TrendingUp, Users, Stethoscope } from "lucide-react"

interface StatsCardsProps {
  dateRange?: { start: string; end: string }
  selectedSpecialty?: string | null
  selectedDoctor?: string | null
}

export function StatsCards({ dateRange, selectedSpecialty, selectedDoctor }: StatsCardsProps) {
  const { appointments, doctors, specialties } = useData()

  // 1. Filter lịch khám dựa trên bộ lọc (thời gian, chuyên khoa, bác sĩ)
  const filteredAppointments = appointments.filter((apt) => {
    if (selectedSpecialty && apt.specialtyId !== selectedSpecialty) return false
    if (selectedDoctor && apt.doctorId !== selectedDoctor) return false
    if (dateRange?.start || dateRange?.end) {
      const aptDate = new Date(apt.appointmentDate).toISOString().split("T")[0]
      const startDate = dateRange?.start || "1900-01-01"
      const endDate = dateRange?.end || "2099-12-31"
      if (aptDate < startDate || aptDate > endDate) return false
    }
    return true
  })

  // 2. Logic lấy tháng và năm hiện tại
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1 // JS đếm tháng từ 0-11 nên cần +1
  const currentYear = currentDate.getFullYear()

  // 3. Tính Số ca khám TRONG THÁNG
  const appointmentsThisMonth = filteredAppointments.filter((apt) => {
    const aptDate = new Date(apt.appointmentDate)
    return aptDate.getMonth() + 1 === currentMonth && aptDate.getFullYear() === currentYear
  })

  // 4. Tính Số bệnh nhân TRONG THÁNG (Lọc các ID không trùng lặp từ ca khám trong tháng)
  const uniquePatientsThisMonth = new Set(appointmentsThisMonth.map((apt) => apt.patientId)).size

  // Các chỉ số khác giữ nguyên
  const completedAppointments = filteredAppointments.filter((apt) => apt.status === "COMPLETED")
  const completionRate =
    filteredAppointments.length > 0
      ? Math.round((completedAppointments.length / filteredAppointments.length) * 100)
      : 0

  const activeDoctorsInFilter = new Set(filteredAppointments.map((apt) => apt.doctorId)).size
  const activeDoctors = selectedDoctor
    ? 1
    : selectedSpecialty
      ? doctors.filter((d) => d.specialtyId === selectedSpecialty && d.status === "active").length
      : doctors.filter((d) => d.status === "active").length

  // 5. Cập nhật dữ liệu hiển thị lên Thẻ
  const stats = [
    {
      title: `Lượt khám tháng ${currentMonth}`,
      value: appointmentsThisMonth.length,
      sub: `Tổng trong bộ lọc: ${filteredAppointments.length} lượt`,
      icon: Calendar,
      primary: true,
    },
    {
      title: "Tỷ lệ hoàn thành",
      value: `${completionRate}%`,
      sub: `${completedAppointments.length}/${filteredAppointments.length} hoàn thành`,
      icon: TrendingUp,
      primary: false,
    },
    {
      title: `Bệnh nhân tháng ${currentMonth}`,
      value: uniquePatientsThisMonth,
      sub: `Số bệnh nhân khác nhau`,
      icon: Users,
      primary: false,
    },
    {
      title: "Bác sĩ đang hoạt động",
      value: activeDoctors,
      sub: `${activeDoctorsInFilter} có lịch khám`,
      icon: Stethoscope,
      primary: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <Card
          key={stat.title}
          style={{ animationDelay: `${index * 80}ms` }}
          className={`${stat.primary ? "bg-primary text-primary-foreground" : "bg-card text-foreground"} p-4 transition-all duration-500 ease-out animate-slide-in-up hover:scale-[1.02] hover:shadow-xl shadow-lg`}
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-xs font-medium opacity-90">{stat.title}</h3>
            <div
              className={`w-8 h-8 rounded-lg ${stat.primary ? "bg-primary-foreground/20" : "bg-primary/10"} flex items-center justify-center`}
            >
              <stat.icon className={`w-4 h-4 ${stat.primary ? "text-primary-foreground" : "text-primary"}`} />
            </div>
          </div>
          <p className="text-3xl font-bold mb-1">{stat.value}</p>
          <p className="text-xs opacity-80">{stat.sub}</p>
        </Card>
      ))}
    </div>
  )
}