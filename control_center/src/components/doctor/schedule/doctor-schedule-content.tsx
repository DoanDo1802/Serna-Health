"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/components/base/providers/auth-provider"
import { Card } from "@/components/base/ui/card"
import { Badge } from "@/components/base/ui/badge"
import { Button } from "@/components/base/ui/button"
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  Calendar as CalendarIcon,
  CheckCircle,
  AlertCircle,
  XCircle,
  Activity,
  Building2,
  MapPin,
  Stethoscope,
  Sun,
  Sunset,
  RefreshCw,
  Phone,
  UserCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  workSchedulesApi,
  practitionersApi,
  appointmentsApi,
  patientsApi,
  type WorkSchedule,
  type WorkScheduleCatalog,
  type PatientAppointment,
  type PractitionerView,
  type PractitionerRoleView,
} from "@/lib/api"

const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

const shiftConfig = {
  MORNING: {
    label: "Ca sáng (08:00 - 12:00)",
    shortLabel: "Ca sáng",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    bg: "bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200",
    cellClass: "bg-emerald-500/10 text-emerald-850 border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300",
    time: "08:00 - 12:00",
    icon: Sun,
  },
  AFTERNOON: {
    label: "Ca chiều (13:30 - 17:30)",
    shortLabel: "Ca chiều",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    bg: "bg-amber-50/70 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200",
    cellClass: "bg-amber-500/10 text-amber-850 border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300",
    time: "13:30 - 17:30",
    icon: Sunset,
  },
}

function formatDateToIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getMonthBounds(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  return {
    fromDate: formatDateToIso(firstDay),
    toDate: formatDateToIso(lastDay),
  }
}

export function DoctorScheduleContent() {
  const { user } = useAuth()
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Doctor practitioner and role data
  const [practitioner, setPractitioner] = useState<PractitionerView | null>(null)
  const [practitionerRoles, setPractitionerRoles] = useState<PractitionerRoleView[]>([])
  
  // Work schedule data & catalog
  const [catalog, setCatalog] = useState<WorkScheduleCatalog>({ departments: [], rooms: [], services: [] })
  const [monthlySchedules, setMonthlySchedules] = useState<WorkSchedule[]>([])
  
  // Appointments
  const [appointments, setAppointments] = useState<PatientAppointment[]>([])
  const [patientMap, setPatientMap] = useState<Record<string, any>>({})

  const doctorAccountId = String(user?.doctorId || user?.email || "")

  // Fast lookup maps
  const departmentMap = useMemo(() => new Map(catalog.departments.map((d) => [d.id, d.name])), [catalog.departments])
  const roomMap = useMemo(() => new Map(catalog.rooms.map((r) => [r.id, r.name])), [catalog.rooms])
  const serviceMap = useMemo(() => new Map(catalog.services.map((s) => [s.id, s.name])), [catalog.services])

  // Doctor role IDs set
  const doctorRoleIds = useMemo(() => new Set(practitionerRoles.map((r) => r.id)), [practitionerRoles])

  // Load practitioner profile and roles
  const loadDoctorProfile = useCallback(async () => {
    try {
      const page = await practitionersApi.list()
      const myPrac = page.items.find((p) => 
        p.userAccountId === doctorAccountId || 
        (user?.name && p.fullName.toLowerCase().includes(user.name.toLowerCase()))
      )
      if (myPrac) {
        setPractitioner(myPrac)
        const rolesPage = await practitionersApi.listRoles(myPrac.id)
        setPractitionerRoles(rolesPage.items)
        return {
          myPrac,
          roleIds: new Set(rolesPage.items.map((r) => r.id)),
        }
      }
    } catch (e) {
      console.warn("Không thể nạp thông tin practitioner của bác sĩ:", e)
    }
    return { myPrac: null, roleIds: new Set<string>() }
  }, [doctorAccountId, user?.name])

  // Load schedules, catalog, and appointments
  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // 1. Ensure doctor profile & roles
      let currentPrac = practitioner
      let roleIds = doctorRoleIds
      if (!currentPrac || roleIds.size === 0) {
        const prof = await loadDoctorProfile()
        currentPrac = prof.myPrac
        roleIds = prof.roleIds
      }

      // 2. Fetch Catalog and Monthly Schedules in parallel
      const bounds = getMonthBounds(currentDate)
      const [catalogRes, schedulesRes, appointmentsRes] = await Promise.all([
        workSchedulesApi.catalog().catch(() => ({ departments: [], rooms: [], services: [] })),
        workSchedulesApi.list(bounds).catch(() => ({ items: [], hasMore: false })),
        appointmentsApi.listAppointments(100).catch(() => []),
      ])

      setCatalog(catalogRes)

      // Filter schedules belonging to this doctor (must match roleIds)
      const mySchedules = schedulesRes.items.filter((ws) => 
        roleIds.size > 0 && roleIds.has(ws.practitionerRoleId)
      )
      setMonthlySchedules(mySchedules)

      // Collect all slot IDs belonging to this doctor's schedules
      const mySlotIds = new Set(mySchedules.map((ws) => ws.slotId).filter(Boolean))

      // Filter appointments belonging STRICTLY to this doctor
      const myAppointments = appointmentsRes.filter((a) => {
        // 1. Match by slotId
        if (a.slotId && mySlotIds.has(a.slotId)) return true
        // 2. Match by practitioner name
        if (currentPrac?.fullName && a.practitionerName) {
          return a.practitionerName.trim().toLowerCase() === currentPrac.fullName.trim().toLowerCase()
        }
        return false
      })
      setAppointments(myAppointments)

      // Lazy load patient names for appointments missing them
      const missingPatientIds = Array.from(new Set(myAppointments.map((a) => a.patientId))).filter(
        (id) => !patientMap[id]
      )
      if (missingPatientIds.length > 0) {
        Promise.allSettled(missingPatientIds.map((id) => patientsApi.get(id)))
          .then((results) => {
            const newMap: Record<string, any> = {}
            results.forEach((r, idx) => {
              if (r.status === "fulfilled" && r.value) {
                newMap[missingPatientIds[idx]] = r.value
              }
            })
            if (Object.keys(newMap).length > 0) {
              setPatientMap((prev) => ({ ...prev, ...newMap }))
            }
          })
          .catch(() => {})
      }
    } catch (err) {
      console.error("Lỗi khi nạp dữ liệu lịch bác sĩ:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentDate, doctorRoleIds, loadDoctorProfile, practitioner, patientMap])

  useEffect(() => {
    loadData()
  }, [currentDate])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month])
  const firstDayIndex = useMemo(() => new Date(year, month, 1).getDay(), [year, month])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const selectedDateStr = formatDateToIso(selectedDate)

  // Schedules grouped by localDate
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, WorkSchedule[]>()
    for (const ws of monthlySchedules) {
      if (ws.status === "CANCELLED") continue
      const list = map.get(ws.localDate) || []
      list.push(ws)
      map.set(ws.localDate, list)
    }
    return map
  }, [monthlySchedules])

  // Selected day's schedules
  const selectedDaySchedules = useMemo(() => {
    return schedulesByDate.get(selectedDateStr) || []
  }, [schedulesByDate, selectedDateStr])

  // Selected day's appointments (must belong to this day's shift slots or appointment date)
  const selectedDayAppointments = useMemo(() => {
    const daySlotIds = new Set(selectedDaySchedules.map((s) => s.slotId).filter(Boolean))
    return appointments.filter((a) => {
      if (a.status?.toUpperCase() === "CANCELLED") return false
      if (daySlotIds.size > 0 && a.slotId && daySlotIds.has(a.slotId)) return true
      if (a.startAt) {
        try {
          const d = new Date(a.startAt)
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, "0")
          const day = String(d.getDate()).padStart(2, "0")
          if (`${y}-${m}-${day}` === selectedDateStr) return true
        } catch {
          if (a.startAt.split("T")[0] === selectedDateStr) return true
        }
      }
      return false
    })
  }, [appointments, selectedDaySchedules, selectedDateStr])

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "WAITING":
      case "PENDING":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 gap-1 px-2 py-0.5 font-semibold text-xs">
            <Clock className="w-3.5 h-3.5" /> Chờ khám
          </Badge>
        )
      case "CONFIRMED":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50 gap-1 px-2 py-0.5 font-semibold text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> Đã xác nhận
          </Badge>
        )
      case "IN_PROGRESS":
        return (
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50 gap-1 px-2 py-0.5 font-semibold text-xs">
            <Activity className="w-3.5 h-3.5 animate-pulse" /> Đang khám
          </Badge>
        )
      case "DONE":
      case "COMPLETED":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 gap-1 px-2 py-0.5 font-semibold text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> Hoàn thành
          </Badge>
        )
      case "CANCELLED":
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50 gap-1 px-2 py-0.5 font-semibold text-xs">
            <XCircle className="w-3.5 h-3.5" /> Đã hủy
          </Badge>
        )
      default:
        return <Badge variant="outline" className="px-2 py-0.5 font-semibold text-xs">{status}</Badge>
    }
  }

  const todayStr = formatDateToIso(new Date())

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Lịch làm việc của tôi</h1>
          <p className="text-muted-foreground text-sm">
            Theo dõi ca trực được phân công và danh sách bệnh nhân đăng ký khám
            {practitioner?.fullName && (
              <span className="font-semibold text-primary ml-1.5">• Bác sĩ: {practitioner.fullName}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            Làm mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột Trái: Lịch Tháng */}
        <Card className="lg:col-span-2 p-6 border-border/60 shadow-sm h-full bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Tháng {month + 1} năm {year}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {monthlySchedules.length > 0 ? (
                    `Có ${monthlySchedules.length} ca trực được xếp trong tháng này`
                  ) : (
                    "Chưa có ca trực nào trong tháng này"
                  )}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button 
                  variant="outline"
                  size="icon"
                  onClick={handlePrevMonth} 
                  className="h-8 w-8 hover:bg-secondary transition-colors"
                  aria-label="Tháng trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline"
                  size="icon"
                  onClick={handleNextMonth} 
                  className="h-8 w-8 hover:bg-secondary transition-colors"
                  aria-label="Tháng sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Thứ trong tuần */}
            <div className="grid grid-cols-7 gap-2 text-center text-sm mb-3">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Lưới các ngày */}
            <div className="grid grid-cols-7 gap-2">
              {/* Ô trống đầu tháng */}
              {Array.from({ length: firstDayIndex }).map((_, index) => (
                <div key={`empty-${index}`} className="h-24 opacity-0 pointer-events-none" />
              ))}

              {/* Ngày trong tháng */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dateObj = new Date(year, month, day)
                const dateStr = formatDateToIso(dateObj)
                const isSelected = selectedDateStr === dateStr
                const isToday = todayStr === dateStr

                const daySchedules = schedulesByDate.get(dateStr) || []
                const hasMorning = daySchedules.some((s) => s.session === "MORNING")
                const hasAfternoon = daySchedules.some((s) => s.session === "AFTERNOON")
                const hasShift = daySchedules.length > 0

                // Count appointments for this day's assigned shifts or date
                const daySlotIds = new Set(daySchedules.map((s) => s.slotId).filter(Boolean))
                const dayAppointments = appointments.filter((a) => {
                  if (a.status?.toUpperCase() === "CANCELLED") return false
                  if (daySlotIds.size > 0 && a.slotId && daySlotIds.has(a.slotId)) return true
                  if (a.startAt) {
                    try {
                      const d = new Date(a.startAt)
                      const y = d.getFullYear()
                      const m = String(d.getMonth() + 1).padStart(2, "0")
                      const dStr = String(d.getDate()).padStart(2, "0")
                      return `${y}-${m}-${dStr}` === dateStr
                    } catch {
                      return a.startAt.split("T")[0] === dateStr
                    }
                  }
                  return false
                })

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateObj)}
                    className={cn(
                      "h-24 w-full rounded-xl p-2 flex flex-col justify-between transition-all border relative text-left group",
                      isSelected 
                        ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm font-semibold" 
                        : "hover:border-primary/50 hover:bg-secondary/30 bg-card/60",
                      hasShift && !isSelected ? "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/20" : "",
                      isToday && !isSelected ? "border-primary/40" : ""
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={cn(
                        "text-sm font-bold inline-flex items-center justify-center w-6 h-6 rounded-full",
                        isToday ? "bg-primary text-primary-foreground text-xs" : "text-foreground"
                      )}>
                        {day}
                      </span>
                      {hasShift && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Có ca trực" />
                      )}
                    </div>

                    {/* Shift badges inside cell */}
                    <div className="space-y-1 w-full overflow-hidden">
                      {hasMorning && (
                        <div className="text-[10px] px-1.5 py-0.5 rounded font-semibold truncate bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                          Sáng (8h-12h)
                        </div>
                      )}
                      {hasAfternoon && (
                        <div className="text-[10px] px-1.5 py-0.5 rounded font-semibold truncate bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                          Chiều (13h30)
                        </div>
                      )}
                      {!hasShift && (
                        <span className="text-[9px] text-muted-foreground/50 italic block truncate">
                          Nghỉ
                        </span>
                      )}
                    </div>

                    {/* Appointment count indicator */}
                    {dayAppointments.length > 0 && (
                      <div className="text-[9px] font-bold text-primary flex items-center gap-0.5 mt-0.5">
                        <Users className="w-2.5 h-2.5" />
                        <span>{dayAppointments.length} lịch hẹn</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ghi chú màu ca trực */}
          <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-border/50 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700" />
              <span>Ca sáng (08:00 - 12:00)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 dark:bg-amber-900/50 dark:border-amber-700" />
              <span>Ca chiều (13:30 - 17:30)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span>Hôm nay</span>
            </div>
          </div>
        </Card>

        {/* Cột Phải: Chi Tiết Ngày & Ca Khám */}
        <div className="space-y-4 lg:h-full lg:flex lg:flex-col">
          <Card className="p-6 bg-card flex flex-col border-border/60 shadow-sm lg:flex-1 lg:h-full">
            {/* Tiêu đề ngày chọn */}
            <div className="border-b pb-3 mb-4">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                Chi tiết ngày
              </span>
              <span className="text-lg font-bold text-foreground mt-1 block">
                Thứ {selectedDate.getDay() === 0 ? "Chủ Nhật" : selectedDate.getDay() + 1}, {selectedDate.getDate()} Tháng {selectedDate.getMonth() + 1} năm {selectedDate.getFullYear()}
              </span>
            </div>

            {/* Thông tin Ca trực được phân công */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Ca khám được phân công ({selectedDaySchedules.length})
                </span>
              </div>

              {selectedDaySchedules.length === 0 ? (
                <div className="border rounded-xl p-4 bg-muted/20 flex gap-3 items-center text-muted-foreground">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-muted-foreground/60" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Nghỉ</span>
                    <span className="text-xs text-muted-foreground">Không có ca trực được phân công trong ngày này</span>
                  </div>
                </div>
              ) : (
                selectedDaySchedules.map((schedule) => {
                  const cfg = shiftConfig[schedule.session] || shiftConfig.MORNING
                  const ShiftIcon = cfg.icon
                  const deptName = departmentMap.get(schedule.departmentId) || "Chuyên khoa"
                  const roomName = roomMap.get(schedule.roomId) || "Phòng khám"
                  const srvName = serviceMap.get(schedule.serviceId) || "Dịch vụ khám"
                  const remaining = schedule.capacity - (schedule.reservedCapacity || 0)

                  return (
                    <div 
                      key={schedule.id}
                      className={cn(
                        "border rounded-xl p-4 flex flex-col gap-3 transition-all",
                        cfg.bg
                      )}
                    >
                      {/* Tiêu đề ca & Trạng thái */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShiftIcon className="w-5 h-5 text-foreground" />
                          <span className="font-bold text-sm text-foreground">{cfg.label}</span>
                        </div>
                        <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", cfg.badgeClass)}>
                          {schedule.status === "ACTIVE" ? "Hoạt động" : "Đã hủy"}
                        </Badge>
                      </div>

                      {/* Chi tiết: Chuyên khoa, Phòng, Dịch vụ, Sức chứa */}
                      <div className="space-y-1.5 pt-2 border-t border-border/40 text-xs">
                        <div className="flex items-center gap-2 text-foreground">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Khoa:</span>
                          <span className="font-semibold truncate">{deptName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Phòng:</span>
                          <span className="font-semibold truncate">{roomName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground">
                          <Stethoscope className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Dịch vụ:</span>
                          <span className="font-semibold truncate">{srvName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground pt-1">
                          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Sức chứa:</span>
                          <span className="font-bold text-primary">
                            {schedule.reservedCapacity || 0} / {schedule.capacity} chỗ
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            (Còn {remaining > 0 ? remaining : 0} chỗ trống)
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Danh sách Lịch hẹn khám của bệnh nhân */}
            <div className="mt-6 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Lịch hẹn khám ({selectedDayAppointments.length})
                </span>
              </div>

              {selectedDayAppointments.length === 0 ? (
                <div className="flex-1 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center bg-secondary/5 min-h-[160px]">
                  {selectedDaySchedules.length > 0 ? (
                    <>
                      <UserCheck className="w-8 h-8 text-emerald-500/60 mb-2" />
                      <span className="text-xs font-semibold text-foreground">Chưa có bệnh nhân đăng ký</span>
                      <span className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                        Ca khám đang hoạt động và sẵn sàng tiếp nhận bệnh nhân đặt hẹn
                      </span>
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="w-8 h-8 text-muted-foreground/40 mb-2" />
                      <span className="text-xs font-semibold text-muted-foreground">Không có lịch hẹn</span>
                      <span className="text-[11px] text-muted-foreground/80 mt-1">
                        Ngày nghỉ của bác sĩ
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {selectedDayAppointments.map((app) => {
                    const patient = patientMap[app.patientId]
                    const patientName = patient?.fullName || "Bệnh nhân"
                    const patientPhone = patient?.phone || ""
                    const timeStr = app.startAt ? new Date(app.startAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : (app.session === "MORNING" ? "08:00 - 12:00" : "13:30 - 17:30")

                    return (
                      <div 
                        key={app.id}
                        className="border rounded-xl p-3 bg-secondary/20 flex flex-col gap-2 hover:bg-secondary/35 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            {timeStr}
                          </span>
                          {getStatusBadge(app.status)}
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-foreground">
                            {patientName}
                          </span>
                          {patientPhone && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground/70" />
                              {patientPhone}
                            </span>
                          )}
                          {app.serviceName && (
                            <span className="text-[11px] text-muted-foreground truncate">
                              Dịch vụ: <span className="font-medium text-foreground/80">{app.serviceName}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
