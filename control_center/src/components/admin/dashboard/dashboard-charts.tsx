"use client"

import { Card } from "@/components/base/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/base/ui/chart"
import { useData } from "@/components/base/providers/data-provider"
import { formatDateShortVN } from "@/lib/date-utils"
// Bổ sung import icon Coffee cho Empty State
import { Coffee } from "lucide-react" 
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
]

interface DashboardChartsProps {
  dateRange?: { start: string; end: string }
  selectedSpecialty?: string | null
  selectedDoctor?: string | null
}

export function DashboardCharts({
  dateRange,
  selectedSpecialty,
  selectedDoctor,
}: DashboardChartsProps) {
  const { appointments, doctors, specialties } = useData()

  // --- LỌC DỮ LIỆU DÙNG CHUNG TỪ BỘ LỌC HEADER ---
  const filteredAppointments = appointments.filter((apt) => {
    if (selectedSpecialty && apt.specialtyId !== selectedSpecialty) return false
    if (selectedDoctor && apt.doctorId !== selectedDoctor) return false
    if (dateRange?.start || dateRange?.end) {
      const aptDate = apt.appointmentDate.split("T")[0]
      const startDate = dateRange?.start || "1900-01-01"
      const endDate = dateRange?.end || "2099-12-31"
      if (aptDate < startDate || aptDate > endDate) return false
    }
    return true
  })

  // ======================================================
  // XỬ LÝ TRẠNG THÁI RỖNG (EMPTY STATE)
  // ======================================================
  if (filteredAppointments.length === 0) {
    const isFiltering = !!(selectedSpecialty || selectedDoctor || dateRange?.start || dateRange?.end)
    
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in duration-500 bg-card border border-dashed border-border rounded-2xl w-full h-[60vh] mt-4">
        <div className="relative mb-6">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <Coffee className="w-12 h-12 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {isFiltering ? "Không có dữ liệu báo cáo" : "Tuyệt vời! Không có lịch hẹn tồn đọng."}
        </h2>
        <p className="text-sm text-muted-foreground max-w-[400px] leading-relaxed">
          {isFiltering 
            ? "Hệ thống không tìm thấy lịch hẹn nào phù hợp với bộ lọc hiện tại. Vui lòng thay đổi khoảng thời gian, chuyên khoa hoặc bác sĩ để xem thống kê." 
            : "Hiện tại không có dữ liệu lịch hẹn nào trong hệ thống. Bạn có thể nghỉ ngơi một chút, thưởng thức một tách trà!"}
        </p>
      </div>
    )
  }

  // ======================================================
  // 1. NHÓM CHỈ SỐ LỊCH HẸN
  // ======================================================
  
  const statusDistribution = [
    { name: "Hoàn thành", value: filteredAppointments.filter((a) => a.status === "COMPLETED").length },
    { name: "Đã xác nhận", value: filteredAppointments.filter((a) => a.status === "CONFIRMED").length },
    { name: "Chờ xác nhận", value: filteredAppointments.filter((a) => a.status === "PENDING").length },
    { name: "Khách hủy", value: filteredAppointments.filter((a) => a.status === "CANCELLED").length },
    { name: "Không đến (No-show)", value: filteredAppointments.filter((a) => a.status === "NO_SHOW").length },
  ].filter((s) => s.value > 0)

  const trendData = (() => {
    const dateMap: Record<string, number> = {}
    filteredAppointments.forEach((apt) => {
      const date = apt.appointmentDate.split("T")[0]
      dateMap[date] = (dateMap[date] || 0) + 1
    })
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10) 
      .map(([date, count]) => ({
        date: formatDateShortVN(date),
        "Lượt khám": count,
      }))
  })()

  // ======================================================
  // 2. NHÓM BÁO CÁO NHÂN SỰ & TÀI CHÍNH
  // ======================================================
  
  const topDoctors = doctors
    .map((dr) => {
      const drApts = filteredAppointments.filter((a) => a.doctorId === dr.id)
      return {
        name: dr.name,
        "Hoàn thành": drApts.filter((a) => a.status === "COMPLETED").length,
        "Đã hủy": drApts.filter((a) => a.status === "CANCELLED" || a.status === "NO_SHOW").length,
      }
    })
    .sort((a, b) => b["Hoàn thành"] - a["Hoàn thành"])
    .slice(0, 5)

  // 2B. Hiển thị toàn bộ chuyên khoa
  const revenueBySpecialty = specialties
    .map((sp) => {
      const spApts = filteredAppointments.filter((a) => a.specialtyId === sp.id && a.status === "COMPLETED")
      const revenue = spApts.reduce((sum, a) => sum + ((a as any).price || 300000), 0)
      return {
        name: sp.name,
        "Doanh thu": revenue / 1000000, 
      }
    })
    .sort((a, b) => b["Doanh thu"] - a["Doanh thu"])

  // ======================================================
  // 3. NHÓM CHỈ SỐ BỆNH NHÂN & VẬN HÀNH
  // ======================================================
  
  const patientRetention = (() => {
    const patientCounts: Record<string, number> = {}
    filteredAppointments.forEach(apt => {
      patientCounts[apt.patientId] = (patientCounts[apt.patientId] || 0) + 1
    })
    let newPatients = 0
    let returningPatients = 0
    Object.values(patientCounts).forEach(count => {
      if (count === 1) newPatients++
      else returningPatients++
    })
    return [
      { name: "Khách hàng mới (1 lần)", value: newPatients },
      { name: "Khách hàng cũ (>=2 lần)", value: returningPatients },
    ].filter(s => s.value > 0)
  })()

  const trafficByDayData = (() => {
    const dayOfWeekMap: Record<string, number> = {
      "Thứ 2": 0, "Thứ 3": 0, "Thứ 4": 0, "Thứ 5": 0, "Thứ 6": 0, "Thứ 7": 0, "CN": 0
    }
    const dayNames = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]
    filteredAppointments.forEach((apt) => {
      const aptDate = new Date(apt.appointmentDate)
      const dayName = dayNames[aptDate.getDay()]
      dayOfWeekMap[dayName] += 1
    })
    const order = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"]
    return order.map(day => ({
      day: day,
      "Số ca đặt": dayOfWeekMap[day]
    }))
  })()

  return (
    <div className="space-y-4">
      {/* ROW 1: TỔNG QUAN LỊCH HẸN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        <Card className="p-4 md:p-5 animate-slide-in-up">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Trạng thái lịch hẹn</h3>
            <p className="text-xs text-muted-foreground">Tỷ lệ hủy lịch và No-show</p>
          </div>
          <ChartContainer config={{ value: { label: "Số lịch" } }} className="h-[240px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={statusDistribution}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
            {statusDistribution.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <span className="text-[11px] text-muted-foreground">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 md:p-5 animate-slide-in-up" style={{ animationDelay: "100ms" }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Xu hướng đặt lịch</h3>
            <p className="text-xs text-muted-foreground">Lưu lượng khám 10 ngày gần nhất</p>
          </div>
          <ChartContainer
            config={{ "Lượt khám": { label: "Lượt khám", color: "var(--color-chart-1)" } }}
            className="h-[250px] w-full"
          >
            <LineChart data={trendData} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="Lượt khám"
                type="monotone"
                stroke="var(--color-chart-1)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--color-chart-1)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </Card>
      </div>

      {/* ROW 2: TÀI CHÍNH & HIỆU SUẤT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        <Card className="p-4 md:p-5 animate-slide-in-up" style={{ animationDelay: "150ms" }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Doanh thu chuyên khoa</h3>
            <p className="text-xs text-muted-foreground">Tất cả chuyên khoa (Đơn vị: Triệu VNĐ)</p>
          </div>
          <ChartContainer
            config={{ "Doanh thu": { label: "Triệu VNĐ", color: "var(--color-chart-2)" } }}
            className="h-[250px] w-full"
          >
            <BarChart data={revenueBySpecialty} margin={{ left: -16, right: 8, top: 8, bottom: 20 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey="name" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8} 
                fontSize={10} 
                angle={-45} 
                textAnchor="end"
                height={60}
              />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--color-secondary)' }} />
              <Bar dataKey="Doanh thu" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="p-4 md:p-5 animate-slide-in-up" style={{ animationDelay: "200ms" }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Hiệu suất Bác sĩ (Top 5)</h3>
            <p className="text-xs text-muted-foreground">Đánh giá tỷ lệ Hoàn thành vs Hủy lịch</p>
          </div>
          <ChartContainer
            config={{
              "Hoàn thành": { label: "Hoàn thành", color: "var(--color-chart-1)" },
              "Đã hủy": { label: "Bị hủy/Không đến", color: "var(--color-destructive)" },
            }}
            className="h-[250px] w-full"
          >
            <BarChart data={topDoctors} margin={{ left: -16, right: 8, top: 8, bottom: 20 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} angle={-15} textAnchor="end" height={40}/>
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--color-secondary)' }} />
              <Legend verticalAlign="top" height={36}/>
              <Bar dataKey="Hoàn thành" stackId="a" fill="var(--color-chart-1)" radius={[0, 0, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Đã hủy" stackId="a" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      {/* ROW 3: VẬN HÀNH & BỆNH NHÂN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        <Card className="p-4 md:p-5 animate-slide-in-up" style={{ animationDelay: "250ms" }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Lưu lượng theo Thứ</h3>
            <p className="text-xs text-muted-foreground">Thống kê ngày đông khách nhất trong tuần</p>
          </div>
          <ChartContainer
            config={{ "Số ca đặt": { label: "Số ca đặt", color: "var(--color-chart-3)" } }}
            className="h-[220px] w-full"
          >
            <BarChart data={trafficByDayData} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--color-secondary)' }} />
              <Bar dataKey="Số ca đặt" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card className="p-4 md:p-5 animate-slide-in-up" style={{ animationDelay: "300ms" }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Phân tích Bệnh nhân</h3>
            <p className="text-xs text-muted-foreground">Tỷ lệ khách hàng quay lại (Retention Rate)</p>
          </div>
          <ChartContainer config={{ value: { label: "Bệnh nhân" } }} className="h-[220px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={patientRetention}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={3}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {patientRetention.map((entry, index) => (
                  <Cell key={entry.name} fill={index === 0 ? "var(--color-chart-4)" : "var(--color-chart-1)"} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ChartContainer>
        </Card>

      </div>
    </div>
  )
}