"use client"

import { useState } from "react"
import { AppShell } from "@/components/base/layout/app-shell"
import { StatsCards } from "@/components/admin/dashboard/stats-cards"
import { FilterPanel } from "@/components/admin/dashboard/filter-panel"
import { DashboardCharts } from "@/components/admin/dashboard/dashboard-charts"
import { AppointmentTable } from "@/components/admin/dashboard/appointment-table"
import { Button } from "@/components/base/ui/button"
import { Download } from "lucide-react"

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)

  return (
    <AppShell
      title="Báo cáo thống kê"
      description="Tổng quan hoạt động khám chữa bệnh và danh mục y tế."
      actions={
        <Button className="w-full sm:w-auto h-9 text-sm gap-2">
          <Download className="w-4 h-4" />
          Xuất báo cáo
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Filter Panel */}
        <FilterPanel
          dateRange={dateRange}
          selectedSpecialty={selectedSpecialty}
          selectedDoctor={selectedDoctor}
          onDateRangeChange={(start, end) => setDateRange({ start, end })}
          onSpecialtyChange={setSelectedSpecialty}
          onDoctorChange={setSelectedDoctor}
        />

        {/* KPI Stats */}
        <StatsCards
          dateRange={dateRange}
          selectedSpecialty={selectedSpecialty}
          selectedDoctor={selectedDoctor}
        />

        {/* Charts */}
        <DashboardCharts
          dateRange={dateRange}
          selectedSpecialty={selectedSpecialty}
          selectedDoctor={selectedDoctor}
        />

        {/* Appointment Table */}
        <AppointmentTable
          dateRange={dateRange}
          selectedSpecialty={selectedSpecialty}
          selectedDoctor={selectedDoctor}
        />
      </div>
    </AppShell>
  )
}
