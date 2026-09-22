"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import { Input } from "@/components/base/ui/input"
import { useData } from "@/components/base/providers/data-provider"
import { formatDateVN } from "@/lib/date-utils"
import { Download, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/ui/select"

interface AppointmentTableProps {
  dateRange?: { start: string; end: string }
  selectedSpecialty?: string | null
  selectedDoctor?: string | null
}

type StatusKey = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED"

const STATUS_COLORS: Record<StatusKey, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
}

const STATUS_LABELS: Record<StatusKey, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Xác nhận",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Hủy",
}

export function AppointmentTable({
  dateRange,
  selectedSpecialty,
  selectedDoctor,
}: AppointmentTableProps) {
  const { appointments, doctors, specialties } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  // Filter and search
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((apt) => {
        if (selectedSpecialty && apt.specialtyId !== selectedSpecialty) return false
        if (selectedDoctor && apt.doctorId !== selectedDoctor) return false
        if (dateRange?.start || dateRange?.end) {
          const aptDate = apt.appointmentDate.split("T")[0]
          const startDate = dateRange?.start || "1900-01-01"
          const endDate = dateRange?.end || "2099-12-31"
          if (aptDate < startDate || aptDate > endDate) return false
        }
        if (searchTerm) {
          const lower = searchTerm.toLowerCase()
          return (
            apt.patientName.toLowerCase().includes(lower) ||
            apt.id.toLowerCase().includes(lower) ||
            apt.mainDiagnosis?.toLowerCase().includes(lower)
          )
        }
        return true
      })
      .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
  }, [appointments, selectedSpecialty, selectedDoctor, dateRange, searchTerm])

  // Paginate
  const totalPages = Math.ceil(filteredAppointments.length / pageSize)
  const paginatedAppointments = filteredAppointments.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  // Export to CSV
  const handleExport = (format: "csv" | "excel") => {
    const headers = [
      "Ngày khám",
      "Mã lịch",
      "Bệnh nhân",
      "Chuyên khoa",
      "Bác sĩ",
      "Trạng thái",
      "Chẩn đoán",
    ]
    const rows = filteredAppointments.map((apt) => {
      const doctor = doctors.find((d) => d.id === apt.doctorId)
      const specialty = specialties.find((s) => s.id === apt.specialtyId)
      return [
        new Date(apt.appointmentDate).toLocaleDateString("vi-VN"),
        apt.id,
        apt.patientName,
        specialty?.name || "-",
        doctor?.name || "-",
        STATUS_LABELS[apt.status as StatusKey],
        apt.mainDiagnosis || "-",
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `bao_cao_kham_benh_${new Date().toISOString().split("T")[0]}.csv`)
    link.click()
  }

  return (
    <Card className="p-4 md:p-5 animate-slide-in-up">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Danh sách lịch sử khám</h3>
            <p className="text-xs text-muted-foreground">
              Tổng {filteredAppointments.length} lịch hẹn
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 gap-2 text-xs w-full sm:w-auto"
            onClick={() => handleExport("csv")}
          >
            <Download className="w-3.5 h-3.5" />
            Tải xuống CSV
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm theo tên bệnh nhân, mã lịch hoặc chẩn đoán..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-xs font-medium text-muted-foreground">
              <th className="px-3 py-2 text-left">Ngày khám</th>
              <th className="px-3 py-2 text-left">Mã lịch</th>
              <th className="px-3 py-2 text-left">Bệnh nhân</th>
              <th className="px-3 py-2 text-left">Chuyên khoa</th>
              <th className="px-3 py-2 text-left">Bác sĩ</th>
              <th className="px-3 py-2 text-left">Trạng thái</th>
              <th className="px-3 py-2 text-left">Chẩn đoán</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAppointments.length > 0 ? (
              paginatedAppointments.map((apt) => {
                const doctor = doctors.find((d) => d.id === apt.doctorId)
                const specialty = specialties.find((s) => s.id === apt.specialtyId)
                return (
                  <tr key={apt.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-2 text-xs">
                      {formatDateVN(apt.appointmentDate)}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{apt.id}</td>
                    <td className="px-3 py-2 text-xs font-medium">{apt.patientName}</td>
                    <td className="px-3 py-2 text-xs">{specialty?.name || "-"}</td>
                    <td className="px-3 py-2 text-xs">{doctor?.name || "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          STATUS_COLORS[apt.status as StatusKey]
                        }`}
                      >
                        {STATUS_LABELS[apt.status as StatusKey]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {apt.mainDiagnosis || "-"}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Không có dữ liệu lịch khám
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredAppointments.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Dòng mỗi trang:</span>
            <Select value={pageSize.toString()} onValueChange={(v) => {
              setPageSize(Number(v))
              setPage(1)
            }}>
              <SelectTrigger className="w-16 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Trang {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-8 px-2 text-xs"
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="h-8 px-2 text-xs"
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
