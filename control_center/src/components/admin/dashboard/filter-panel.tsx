"use client"

import { useState } from "react"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/ui/select"
import { useData } from "@/components/base/providers/data-provider"
import { Calendar, Filter, X } from "lucide-react"

interface FilterPanelProps {
  dateRange: { start: string; end: string }
  selectedSpecialty: string | null
  selectedDoctor: string | null
  onDateRangeChange: (start: string, end: string) => void
  onSpecialtyChange: (id: string | null) => void
  onDoctorChange: (id: string | null) => void
}

export function FilterPanel({
  dateRange,
  selectedSpecialty,
  selectedDoctor,
  onDateRangeChange,
  onSpecialtyChange,
  onDoctorChange,
}: FilterPanelProps) {
  const { specialties, doctors } = useData()
  const [isOpen, setIsOpen] = useState(true)

  const filteredDoctors = selectedSpecialty
    ? doctors.filter((d) => d.specialtyId === selectedSpecialty)
    : doctors

  const handleClear = () => {
    onDateRangeChange("", "")
    onSpecialtyChange(null)
    onDoctorChange(null)
  }

  return (
    <Card className="p-4 mb-4 bg-card border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Bộ lọc dữ liệu</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClear} className="h-8 text-xs">
            Xóa lọc
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-8 w-8 p-0"
          >
            {isOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Date Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Từ ngày</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange(e.target.value, dateRange.end)}
              className="w-full h-9 text-xs border border-border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Đến ngày</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange(dateRange.start, e.target.value)}
              className="w-full h-9 text-xs border border-border rounded-md px-2 py-1.5 bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Specialty */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Chuyên khoa</label>
            <Select value={selectedSpecialty || "all"} onValueChange={(v) => onSpecialtyChange(v === "all" ? null : v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tất cả chuyên khoa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chuyên khoa</SelectItem>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Doctor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Bác sĩ</label>
            <Select value={selectedDoctor || "all"} onValueChange={(v) => onDoctorChange(v === "all" ? null : v)}>
              <SelectTrigger className="h-9 text-xs" disabled={filteredDoctors.length === 0}>
                <SelectValue placeholder="Tất cả bác sĩ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả bác sĩ</SelectItem>
                {filteredDoctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </Card>
  )
}
