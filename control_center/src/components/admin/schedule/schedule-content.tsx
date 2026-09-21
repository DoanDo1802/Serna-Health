"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import { Input } from "@/components/base/ui/input"
import {
  ApiError,
  AppointmentSlotSession,
  Personnel,
  WorkSchedule,
  WorkScheduleCatalog,
  personnelApi,
  workSchedulesApi,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const DAYS_OF_WEEK = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
const HO_CHI_MINH_TIME_ZONE = "Asia/Ho_Chi_Minh"

const SESSION_LABEL: Record<AppointmentSlotSession, string> = {
  MORNING: "Ca sáng · 08:00–12:00",
  AFTERNOON: "Ca chiều · 13:30–17:30",
}

const SESSION_SHORT_LABEL: Record<AppointmentSlotSession, string> = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
}

const SESSION_START_MINUTE: Record<AppointmentSlotSession, number> = {
  MORNING: 8 * 60,
  AFTERNOON: 13 * 60 + 30,
}

type ScheduleChoice = AppointmentSlotSession | "FULL_DAY"

type VietnamClock = {
  localDate: string
  minuteOfDay: number
}

function localDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateFromLocal(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function monthBounds(value: Date) {
  const start = new Date(value.getFullYear(), value.getMonth(), 1)
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0)
  return { fromDate: localDate(start), toDate: localDate(end) }
}

function vietnamClock(now = new Date()): VietnamClock {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: HO_CHI_MINH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value
    return result
  }, {})
  return {
    localDate: `${values.year}-${values.month}-${values.day}`,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const raw = error.message || ""
    if (raw.includes("ex_appointment_slot_room_overlap")) {
      return "Phòng khám đã có bác sĩ trực trong cùng khung giờ này. Vui lòng chọn phòng khám khác hoặc đổi ca trực."
    }
    if (raw.includes("ex_appointment_slot_role_overlap")) {
      return "Bác sĩ đã có lịch trực khác trong cùng khung giờ này."
    }
    if (error.status === 409) return `${error.message}. Dữ liệu lịch đã được tải lại.`
    if (error.status === 412) return "Lịch đã được thay đổi bởi thao tác khác. Đã tải lại dữ liệu."
    return error.message
  }
  return error instanceof Error ? error.message : "Không thể cập nhật lịch trực"
}

function describeDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateFromLocal(value))
}

function describeDateShort(value: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(dateFromLocal(value))
}

function shortRoomName(name: string) {
  if (!name) return "—"
  return name.replace(/^Phòng Khám\s+/i, "PK ").replace(/^Phòng\s+/i, "P.")
}

export function ScheduleContent() {
  const initialClock = useMemo(() => vietnamClock(), [])
  const [doctors, setDoctors] = useState<Personnel[]>([])
  const [catalog, setCatalog] = useState<WorkScheduleCatalog | null>(null)
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [etags, setEtags] = useState<Record<string, string>>({})
  const [viewMonth, setViewMonth] = useState(() => {
    const today = dateFromLocal(initialClock.localDate)
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(initialClock.localDate)
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [form, setForm] = useState({
    doctorAccountId: "",
    roomId: "",
    serviceId: "",
    session: "MORNING" as ScheduleChoice,
    capacity: "6",
  })

  const loadMonth = useCallback(async (month: Date, showSpinner = true) => {
    if (showSpinner) setIsLoading(true)
    try {
      const page = await workSchedulesApi.list(monthBounds(month))
      setSchedules(page.items.filter((item) => item.status === "ACTIVE"))
      setError("")
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      if (showSpinner) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadInitialData = async () => {
      try {
        const [doctorPage, workCatalog] = await Promise.all([
          personnelApi.list({ type: "DOCTOR", active: true }),
          workSchedulesApi.catalog(),
        ])
        if (!active) return
        setDoctors(doctorPage.items.filter((doctor) => doctor.practitionerRoleId))
        setCatalog(workCatalog)
      } catch (loadError) {
        if (active) setError(errorMessage(loadError))
      }
    }
    void loadInitialData()
    return () => { active = false }
  }, [])

  useEffect(() => {
    void loadMonth(viewMonth)
  }, [loadMonth, viewMonth])

  const clock = vietnamClock()
  const selectedDoctor = doctors.find((doctor) => doctor.accountId === form.doctorAccountId)
  const selectedDepartmentId = selectedDoctor?.departmentId ?? ""

  // All rooms and services belonging to the doctor's department
  const departmentRooms = useMemo(() => {
    if (!selectedDepartmentId) return []
    return (catalog?.rooms ?? []).filter((room) => room.departmentIds.includes(selectedDepartmentId))
  }, [catalog?.rooms, selectedDepartmentId])

  const departmentServices = useMemo(() => {
    if (!selectedDepartmentId) return []
    return (catalog?.services ?? []).filter((service) => service.departmentId === selectedDepartmentId)
  }, [catalog?.services, selectedDepartmentId])

  // Two-way dynamic filtering:
  // If service is chosen, filter rooms that support this service. Otherwise show all department rooms.
  const availableRooms = useMemo(() => {
    if (!form.serviceId) return departmentRooms
    return departmentRooms.filter((room) => room.serviceIds.includes(form.serviceId))
  }, [departmentRooms, form.serviceId])

  // If room is chosen, filter services that can be provided in this room. Otherwise show all department services.
  const availableServices = useMemo(() => {
    if (!form.roomId) return departmentServices
    const currentRoom = departmentRooms.find((room) => room.id === form.roomId)
    if (!currentRoom) return []
    return departmentServices.filter((service) => currentRoom.serviceIds.includes(service.id))
  }, [departmentServices, departmentRooms, form.roomId])
  const activeSchedules = useMemo(() => schedules.filter((schedule) => schedule.status === "ACTIVE"), [schedules])
  const allSchedulesByDate = useMemo(() => activeSchedules.reduce<Record<string, WorkSchedule[]>>((result, schedule) => {
    ;(result[schedule.localDate] ??= []).push(schedule)
    return result
  }, {}), [activeSchedules])

  const visibleSchedules = useMemo(() => {
    if (!selectedDoctor?.practitionerRoleId) return activeSchedules
    return activeSchedules.filter((schedule) => schedule.practitionerRoleId === selectedDoctor.practitionerRoleId)
  }, [activeSchedules, selectedDoctor?.practitionerRoleId])
  const schedulesByDate = useMemo(() => visibleSchedules.reduce<Record<string, WorkSchedule[]>>((result, schedule) => {
    ;(result[schedule.localDate] ??= []).push(schedule)
    return result
  }, {}), [visibleSchedules])
  const selectedSchedules = schedulesByDate[selectedDate] ?? []
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()

  const departmentName = (id?: string | null) => catalog?.departments.find((department) => department.id === id)?.name ?? "—"
  const roomName = (id: string) => catalog?.rooms.find((room) => room.id === id)?.name ?? "—"
  const serviceName = (id: string) => catalog?.services.find((service) => service.id === id)?.name ?? "—"
  const doctorName = (roleId: string) => doctors.find((doctor) => doctor.practitionerRoleId === roleId)?.fullName ?? "Bác sĩ"

  const isDateInPast = (date: string) => date < clock.localDate
  const isSessionAvailable = (date: string, session: AppointmentSlotSession) =>
    date > clock.localDate || (date === clock.localDate && clock.minuteOfDay < SESSION_START_MINUTE[session])
  const isChoiceAvailable = (date: string, choice: ScheduleChoice) =>
    choice === "FULL_DAY"
      ? isSessionAvailable(date, "MORNING") && isSessionAvailable(date, "AFTERNOON")
      : isSessionAvailable(date, choice)
  const choiceBlockedReason = (date: string, choice: ScheduleChoice) => {
    if (date < clock.localDate) return "Không thể gán lịch cho ngày đã qua."
    if (choice === "FULL_DAY" && date === clock.localDate && !isSessionAvailable(date, "MORNING")) {
      return "Hôm nay đã qua giờ bắt đầu ca sáng. Chọn ca chiều hoặc ngày tương lai."
    }
    if (!isChoiceAvailable(date, choice)) return "Ca đã qua giờ bắt đầu. Chọn ca còn lại hoặc ngày tương lai."
    return null
  }

  const selectDate = (value: string) => {
    setSelectedDate(value)
    setError("")
    setSuccess("")
    if (isDateInPast(value)) return
    setSelectedDates((current) => current.includes(value)
      ? current.filter((date) => date !== value)
      : [...current, value].sort())
  }

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(year, month + offset, 1)
    setViewMonth(nextMonth)
    setSelectedDate(localDate(nextMonth))
    setSuccess("")
  }

  const reloadCurrentMonth = async () => {
    await loadMonth(viewMonth)
  }

  const createSchedules = async (sessions: AppointmentSlotSession[]) => {
    if (!selectedDoctor?.practitionerRoleId) {
      setError("Chọn bác sĩ đang hoạt động trước khi tạo lịch.")
      return
    }
    const practitionerRoleId = selectedDoctor.practitionerRoleId
    if (!selectedDepartmentId) {
      setError("Bác sĩ này chưa được gán khoa. Cập nhật hồ sơ bác sĩ trước khi tạo lịch.")
      return
    }
    if (!form.roomId || !form.serviceId) {
      setError("Chọn phòng khám và dịch vụ.")
      return
    }
    if (!availableRooms.some((room) => room.id === form.roomId)) {
      setError("Phòng khám phải thuộc khoa của bác sĩ đã chọn.")
      return
    }
    if (!availableServices.some((service) => service.id === form.serviceId)) {
      setError("Dịch vụ phải thuộc khoa của bác sĩ và được phòng khám hỗ trợ.")
      return
    }
    const capacity = Number(form.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
      setError("Sức chứa phải từ 1 đến 100.")
      return
    }
    if (selectedDates.length === 0) {
      setError("Chọn ít nhất một ngày tương lai trên lịch để gán ca trực.")
      return
    }

    const targetDates = selectedDates.filter((date) => sessions.every((session) => isSessionAvailable(date, session)))
    if (targetDates.length === 0) {
      setError(choiceBlockedReason(selectedDates[0], form.session) ?? "Không còn ngày hoặc ca hợp lệ để tạo lịch.")
      return
    }

    setIsSaving(true)
    setError("")
    setSuccess("")
    try {
      const results = await Promise.all(
        targetDates.map(async (date) => {
          const dateCreated: WorkSchedule[] = []
          const dateEtags: Record<string, string> = {}
          const dateFailed: string[] = []
          for (const session of sessions) {
            try {
              const result = await workSchedulesApi.create({
                practitionerRoleId,
                departmentId: selectedDepartmentId,
                roomId: form.roomId,
                serviceId: form.serviceId,
                localDate: date,
                session,
                capacity,
              })
              dateCreated.push(result.data)
              dateEtags[result.data.id] = result.etag ?? `"${result.data.version}"`
            } catch (requestError) {
              dateFailed.push(`${date} · ${SESSION_SHORT_LABEL[session]}: ${errorMessage(requestError)}`)
            }
          }
          return { dateCreated, dateEtags, dateFailed }
        }),
      )

      const created = results.flatMap((r) => r.dateCreated)
      const failed = results.flatMap((r) => r.dateFailed)
      const mergedEtags: Record<string, string> = {}
      for (const r of results) {
        Object.assign(mergedEtags, r.dateEtags)
      }

      if (Object.keys(mergedEtags).length > 0) {
        setEtags((current) => ({ ...current, ...mergedEtags }))
      }

      if (created.length > 0) {
        const createdIds = new Set(created.map((item) => item.id))
        const successDates = new Set(created.map((item) => item.localDate))
        setSchedules((current) => [
          ...current.filter((schedule) => !createdIds.has(schedule.id)),
          ...created,
        ])
        setSuccess(`Đã tạo ${created.length} ca trực cho ${successDates.size} ngày.`)
        setSelectedDates((current) => current.filter((d) => !successDates.has(d)))
      }

      if (targetDates.length < selectedDates.length) {
        failed.unshift("Một số ngày/ca đã qua giờ bắt đầu nên không được tạo.")
      }
      if (failed.length > 0) setError(failed.slice(0, 3).join(" — "))
      void loadMonth(viewMonth, false)
    } finally {
      setIsSaving(false)
    }
  }

  const createSchedule = async (event: FormEvent) => {
    event.preventDefault()
    await createSchedules(form.session === "FULL_DAY" ? ["MORNING", "AFTERNOON"] : [form.session])
  }

  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null)
  const [editForm, setEditForm] = useState<{
    doctorAccountId: string
    roomId: string
    serviceId: string
    localDate: string
    session: AppointmentSlotSession
    capacity: string
  }>({
    doctorAccountId: "",
    roomId: "",
    serviceId: "",
    localDate: "",
    session: "MORNING",
    capacity: "6",
  })
  const [editError, setEditError] = useState("")
  const [isEditingSaving, setIsEditingSaving] = useState(false)

  const openEditModal = (schedule: WorkSchedule) => {
    const doctor = doctors.find((d) => d.practitionerRoleId === schedule.practitionerRoleId)
    setEditingSchedule(schedule)
    setEditForm({
      doctorAccountId: doctor?.accountId ?? "",
      roomId: schedule.roomId,
      serviceId: schedule.serviceId,
      localDate: schedule.localDate,
      session: schedule.session as AppointmentSlotSession,
      capacity: String(schedule.capacity),
    })
    setEditError("")
  }

  const editDoctor = doctors.find((d) => d.accountId === editForm.doctorAccountId)
  const editDepartmentId = editDoctor?.departmentId ?? ""

  const editDepartmentRooms = useMemo(() => {
    if (!editDepartmentId) return []
    return (catalog?.rooms ?? []).filter((room) => room.departmentIds.includes(editDepartmentId))
  }, [catalog?.rooms, editDepartmentId])

  const editDepartmentServices = useMemo(() => {
    if (!editDepartmentId) return []
    return (catalog?.services ?? []).filter((service) => service.departmentId === editDepartmentId)
  }, [catalog?.services, editDepartmentId])

  const editAvailableRooms = useMemo(() => {
    if (!editForm.serviceId) return editDepartmentRooms
    return editDepartmentRooms.filter((room) => room.serviceIds.includes(editForm.serviceId))
  }, [editDepartmentRooms, editForm.serviceId])

  const editAvailableServices = useMemo(() => {
    if (!editForm.roomId) return editDepartmentServices
    const currentRoom = editDepartmentRooms.find((room) => room.id === editForm.roomId)
    if (!currentRoom) return []
    return editDepartmentServices.filter((service) => currentRoom.serviceIds.includes(service.id))
  }, [editDepartmentServices, editDepartmentRooms, editForm.roomId])

  const saveScheduleEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingSchedule) return

    if (!editDoctor?.practitionerRoleId) {
      setEditError("Vui lòng chọn bác sĩ phụ trách ca trực.")
      return
    }
    if (!editDepartmentId) {
      setEditError("Bác sĩ chưa được gán chuyên khoa.")
      return
    }
    if (!editForm.roomId || !editForm.serviceId) {
      setEditError("Vui lòng chọn đầy đủ phòng khám và dịch vụ.")
      return
    }
    if (!editForm.localDate) {
      setEditError("Vui lòng chọn ngày trực.")
      return
    }
    const capacity = Number(editForm.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
      setEditError("Sức chứa phải từ 1 đến 100.")
      return
    }
    if (capacity < editingSchedule.reservedCapacity) {
      setEditError(`Sức chứa không được nhỏ hơn số chỗ bệnh nhân đã đặt (${editingSchedule.reservedCapacity}).`)
      return
    }

    setIsEditingSaving(true)
    setEditError("")
    try {
      const result = await workSchedulesApi.update(
        editingSchedule.id,
        {
          practitionerRoleId: editDoctor.practitionerRoleId,
          departmentId: editDepartmentId,
          roomId: editForm.roomId,
          serviceId: editForm.serviceId,
          localDate: editForm.localDate,
          session: editForm.session,
          capacity,
        },
        etags[editingSchedule.id] ?? `"${editingSchedule.version}"`,
      )

      setEtags((current) => ({ ...current, [editingSchedule.id]: result.etag ?? `"${result.data.version}"` }))
      setSchedules((current) => current.map((item) => (item.id === editingSchedule.id ? result.data : item)))
      setSuccess("Đã cập nhật ca trực thành công.")
      setEditingSchedule(null)
      void loadMonth(viewMonth, false)
    } catch (saveError) {
      setEditError(errorMessage(saveError))
      void loadMonth(viewMonth, false)
    } finally {
      setIsEditingSaving(false)
    }
  }

  const cancelSchedule = async (schedule: WorkSchedule) => {
    if (!window.confirm(`Hủy lịch ${doctorName(schedule.practitionerRoleId)}? Lịch có giữ chỗ hoặc lịch hẹn sẽ không thể hủy.`)) return
    setIsSaving(true)
    setError("")
    try {
      await workSchedulesApi.cancel(schedule.id, etags[schedule.id] ?? `"${schedule.version}"`)
      setEtags((current) => {
        const next = { ...current }
        delete next[schedule.id]
        return next
      })
      setSchedules((current) => current.filter((item) => item.id !== schedule.id))
      setSuccess("Đã hủy lịch trực thành công.")
      void loadMonth(viewMonth, false)
    } catch (saveError) {
      setError(errorMessage(saveError))
      void loadMonth(viewMonth, false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3.5 animate-slide-in-up">
      {/* Toast-style Alert Notifications */}
      {(success || error) && (
        <div aria-live="polite" className="space-y-1.5">
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 shadow-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="flex-1">{success}</span>
              <button type="button" onClick={() => setSuccess("")} className="hover:opacity-70">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs font-medium text-destructive shadow-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError("")} className="hover:opacity-70">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Two Column Grid */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.52fr)_minmax(350px,0.98fr)] items-stretch">
        {/* LEFT: Calendar Card */}
        <Card className="p-4 shadow-sm flex flex-col justify-between h-full">
          <div>
            {/* Consolidated Month Header */}
            <div className="mb-3 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  Tháng {month + 1} năm {year}
                </h2>

                {/* Doctor Filter Selector */}
                <select
                  value={form.doctorAccountId}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      doctorAccountId: event.target.value,
                      roomId: "",
                      serviceId: "",
                    }))
                    setError("")
                  }}
                  className={cn(
                    "h-7 rounded-md border text-xs font-medium px-2.5 transition focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer",
                    selectedDoctor
                      ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                      : "border-input bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  <option value="">Tất cả bác sĩ</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.accountId} value={doctor.accountId}>
                      {doctor.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                {selectedDates.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {selectedDates.length} ngày đã chọn
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedDates([])}
                      className="text-xs rounded-md border px-2 py-0.5 hover:bg-muted text-muted-foreground transition"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                )}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="rounded-md border p-1.5 hover:bg-muted transition text-muted-foreground hover:text-foreground"
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="rounded-md border p-1.5 hover:bg-muted transition text-muted-foreground hover:text-foreground"
                    aria-label="Tháng sau"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Weekday Names Header */}
            <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayIndex }).map((_, index) => (
                <div key={`blank-${index}`} className="min-h-[96px] xl:h-[106px] rounded-lg border border-transparent" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dayValue = localDate(new Date(year, month, day))
                const allDaySchedules = allSchedulesByDate[dayValue] ?? []
                const activeDaySchedules = allDaySchedules.filter((s) => s.status === "ACTIVE")

                // If a doctor is selected, get their schedules
                const doctorDaySchedules = selectedDoctor
                  ? allDaySchedules.filter((s) => s.practitionerRoleId === selectedDoctor.practitionerRoleId)
                  : []

                // If no doctor selected, compute unique active doctors on duty & shift counts
                const onDutyDoctorIds = new Set(activeDaySchedules.map((s) => s.practitionerRoleId))
                const doctorCount = onDutyDoctorIds.size
                const morningCount = activeDaySchedules.filter((s) => s.session === "MORNING").length
                const afternoonCount = activeDaySchedules.filter((s) => s.session === "AFTERNOON").length

                const hasContent = selectedDoctor ? doctorDaySchedules.length > 0 : doctorCount > 0
                const isActive = dayValue === selectedDate
                const isBatchSelected = selectedDates.includes(dayValue)
                const isPast = isDateInPast(dayValue)
                return (
                  <button
                    type="button"
                    key={dayValue}
                    onClick={() => selectDate(dayValue)}
                    disabled={isPast}
                    className={cn(
                      "min-h-[96px] xl:h-[106px] rounded-lg border p-1.5 text-left flex flex-col justify-between transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-35",
                      isActive && "ring-2 ring-primary border-primary bg-primary/[0.04]",
                      isBatchSelected && "border-emerald-500 bg-emerald-500/10",
                      !hasContent && !isActive && !isBatchSelected && "bg-muted/10",
                    )}
                    aria-label={
                      selectedDoctor
                        ? `${describeDate(dayValue)}${doctorDaySchedules.length ? `, ${doctorDaySchedules.length} ca trực` : ", không có ca trực"}`
                        : `${describeDate(dayValue)}${doctorCount ? `, ${doctorCount} bác sĩ trực` : ", chưa có ca trực"}`
                    }
                  >
                    <div className="flex items-center justify-between text-xs font-semibold leading-none mb-1">
                      <span className={cn(isActive ? "text-primary font-bold" : "text-foreground")}>{day}</span>
                      {isBatchSelected && (
                        <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">
                          Đã chọn
                        </span>
                      )}
                    </div>

                    {selectedDoctor ? (
                      /* Mode: Selected Doctor -> Show morning and afternoon shifts */
                      <div className="space-y-1 overflow-hidden w-full flex-1 flex flex-col justify-start">
                        {doctorDaySchedules.slice(0, 2).map((schedule) => {
                          const details = `${SESSION_SHORT_LABEL[schedule.session]} · ${roomName(schedule.roomId)} · ${serviceName(schedule.serviceId)} · ${schedule.reservedCapacity}/${schedule.capacity}`
                          const isMorning = schedule.session === "MORNING"
                          return (
                            <div
                              key={schedule.id}
                              title={details}
                              className={cn(
                                "rounded px-1.5 py-1 text-[10px] leading-tight border transition-colors",
                                isMorning
                                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50"
                                  : "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
                              )}
                            >
                              <div className="flex items-center justify-between gap-1 font-semibold">
                                <span>{SESSION_SHORT_LABEL[schedule.session]}</span>
                                <span className="font-mono text-[9px] opacity-75">{schedule.reservedCapacity}/{schedule.capacity}</span>
                              </div>
                              <div className="text-[9.5px] font-medium opacity-90 truncate mt-0.5">
                                {shortRoomName(roomName(schedule.roomId))}
                              </div>
                            </div>
                          )
                        })}
                        {doctorDaySchedules.length > 2 && (
                          <span className="block text-[9px] text-muted-foreground font-semibold pl-0.5 leading-none">
                            +{doctorDaySchedules.length - 2} ca nữa
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Mode: All Doctors -> Show count of doctors on duty */
                      <div className="w-full flex-1 flex flex-col justify-center">
                        {doctorCount > 0 ? (
                          <div className="space-y-1 w-full">
                            <div className="flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-primary text-xs font-semibold shadow-2xs">
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{doctorCount} bác sĩ trực</span>
                            </div>
                            <div className="flex items-center gap-2 px-1 text-[10px] font-medium text-muted-foreground">
                              {morningCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span>{morningCount} sáng</span>
                                </span>
                              )}
                              {afternoonCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span>{afternoonCount} chiều</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Calendar Footer with Legend */}
          <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Ca sáng (08:00–12:00)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ca chiều (13:30–17:30)
              </span>
            </div>
            <button
              type="button"
              onClick={() => void reloadCurrentMonth()}
              className="inline-flex items-center gap-1 hover:text-foreground transition text-xs font-medium"
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} /> Tải lại tháng
            </button>
          </div>
        </Card>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4 h-full min-h-0">
          {/* Card 1: Gán lịch ca trực */}
          <Card className="p-4 shadow-sm shrink-0">
            <div className="mb-3 flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Gán lịch ca trực</h2>
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Ngày xem: {describeDateShort(selectedDate)}
              </span>
            </div>

            <form onSubmit={createSchedule} className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">Bác sĩ</span>
                  {selectedDoctor && (
                    <span className="text-[11px] text-muted-foreground font-normal truncate max-w-[190px]">
                      {departmentName(selectedDepartmentId)}
                    </span>
                  )}
                </div>
                <select
                  className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={form.doctorAccountId}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      doctorAccountId: event.target.value,
                      roomId: "",
                      serviceId: "",
                    }))
                    setError("")
                  }}
                >
                  <option value="">Chọn bác sĩ</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.accountId} value={doctor.accountId}>
                      {doctor.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Phòng khám</label>
                  <select
                    disabled={!selectedDepartmentId || availableRooms.length === 0}
                    className="w-full h-8.5 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60 truncate focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.roomId}
                    onChange={(event) => {
                      const nextRoomId = event.target.value
                      setForm((current) => {
                        const newRoom = departmentRooms.find((r) => r.id === nextRoomId)
                        const serviceStillValid = nextRoomId && newRoom ? newRoom.serviceIds.includes(current.serviceId) : true
                        return {
                          ...current,
                          roomId: nextRoomId,
                          serviceId: serviceStillValid ? current.serviceId : "",
                        }
                      })
                    }}
                  >
                    <option value="">
                      {!selectedDepartmentId
                        ? "Chọn BS trước"
                        : availableRooms.length === 0
                        ? "Không có phòng"
                        : "Chọn phòng"}
                    </option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Dịch vụ</label>
                  <select
                    disabled={!selectedDepartmentId || availableServices.length === 0}
                    className="w-full h-8.5 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60 truncate focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.serviceId}
                    onChange={(event) => {
                      const nextServiceId = event.target.value
                      setForm((current) => {
                        const currentRoom = departmentRooms.find((r) => r.id === current.roomId)
                        const roomStillValid = nextServiceId && currentRoom ? currentRoom.serviceIds.includes(nextServiceId) : true
                        return {
                          ...current,
                          serviceId: nextServiceId,
                          roomId: roomStillValid ? current.roomId : "",
                        }
                      })
                    }}
                  >
                    <option value="">
                      {!selectedDepartmentId
                        ? "Chọn BS trước"
                        : availableServices.length === 0
                        ? "Không có dịch vụ"
                        : "Chọn dịch vụ"}
                    </option>
                    {availableServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Ca trực</label>
                  <select
                    className="w-full h-8.5 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.session}
                    onChange={(event) => setForm((current) => ({ ...current, session: event.target.value as ScheduleChoice }))}
                  >
                    {Object.entries(SESSION_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                    <option value="FULL_DAY">Cả ngày · 08:00–17:30</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Sức chứa</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    className="h-8.5 text-xs"
                    value={form.capacity}
                    onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
                  />
                </div>
              </div>

              {selectedDates.length > 0 && !selectedDates.every((date) => isChoiceAvailable(date, form.session)) && (
                <p className="text-[11px] text-destructive">Một số ngày đã chọn không hợp lệ cho ca này.</p>
              )}

              <Button
                type="submit"
                disabled={isSaving || selectedDates.length === 0}
                className="w-full h-9 text-xs font-semibold gap-1.5 mt-1"
              >
                {isSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {isSaving
                  ? "Đang lưu..."
                  : selectedDates.length === 0
                  ? "Chọn ngày trên lịch để gán ca"
                  : form.session === "FULL_DAY"
                  ? `Tạo lịch cả ngày (${selectedDates.length} ngày)`
                  : `Tạo ca trực (${selectedDates.length} ngày)`}
              </Button>
            </form>
          </Card>

          {/* Card 2: Ca trực ngày đang xem */}
          <Card className="p-4 shadow-sm flex-1 flex flex-col min-h-0 max-h-[340px] xl:max-h-[360px] overflow-hidden">
            <div className="mb-2.5 flex items-center justify-between pb-2 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-muted text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  Ca trực {describeDate(selectedDate)}
                  {selectedDoctor && (
                    <span className="ml-1.5 font-normal text-muted-foreground text-xs">
                      ({selectedDoctor.fullName})
                    </span>
                  )}
                </h3>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {selectedSchedules.length} ca
              </span>
            </div>

            {selectedSchedules.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2.5 min-h-0 max-h-[250px] xl:max-h-[270px] pr-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {selectedSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="rounded-lg border p-2.5 text-xs transition-colors bg-card border-border hover:border-primary/40 shadow-2xs"
                  >
                    {/* Top line: Shift badge + Room + Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-semibold shrink-0",
                            schedule.session === "MORNING"
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                              : "bg-amber-500/20 text-amber-900 dark:text-amber-300",
                          )}
                        >
                          {schedule.session === "MORNING" ? "Ca sáng · 08:00–12:00" : "Ca chiều · 13:30–17:30"}
                        </span>
                        <span className="font-semibold text-foreground truncate">
                          {selectedDoctor
                            ? roomName(schedule.roomId)
                            : `${doctorName(schedule.practitionerRoleId)} · ${roomName(schedule.roomId)}`}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 text-emerald-700 bg-emerald-500/10 border border-emerald-500/20">
                        Đang mở
                      </span>
                    </div>

                    {/* Bottom line: Service + Capacity + Actions */}
                    <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px]">
                      <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
                        <span className="truncate font-medium text-foreground/80" title={serviceName(schedule.serviceId)}>
                          {serviceName(schedule.serviceId)}
                        </span>
                        <span>•</span>
                        <span className="shrink-0 font-mono font-medium text-foreground">
                          {schedule.reservedCapacity}/{schedule.capacity} chỗ
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSaving || isEditingSaving || schedule.status !== "ACTIVE"}
                          onClick={() => openEditModal(schedule)}
                          className="h-6.5 text-[11px] px-2 gap-1"
                          title="Chỉnh sửa ca trực"
                        >
                          <Pencil className="h-3 w-3" /> Sửa
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSaving || isEditingSaving || schedule.status !== "ACTIVE"}
                          onClick={() => void cancelSchedule(schedule)}
                          className="h-6.5 text-[11px] px-2 text-destructive hover:bg-destructive/10 gap-1"
                          title="Hủy ca trực"
                        >
                          <Trash2 className="h-3 w-3" /> Hủy
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground min-h-[140px]">
                <CalendarClock className="h-8 w-8 text-muted-foreground/35 mb-2" />
                <p className="font-medium text-foreground/75">
                  {selectedDoctor
                    ? `${selectedDoctor.fullName} chưa có ca trực ngày này.`
                    : "Chưa có bác sĩ nào có ca trực ngày này."}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  {selectedDoctor
                    ? "Chọn ngày trên lịch và điền biểu mẫu phía trên để gán ca trực."
                    : "Chọn bác sĩ và điền biểu mẫu phía trên để gán ca trực."}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={(open) => !open && setEditingSchedule(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Pencil className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-bold">Chỉnh sửa ca trực</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingSchedule && `Điều chỉnh thông tin ca trực ngày ${describeDate(editingSchedule.localDate)}`}
            </DialogDescription>
          </DialogHeader>

          {editingSchedule && (
            <form onSubmit={saveScheduleEdit} className="space-y-3.5 pt-1">
              {editError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive shadow-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{editError}</span>
                </div>
              )}

              {editingSchedule.reservedCapacity > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    Ca trực đang có <strong>{editingSchedule.reservedCapacity}</strong> bệnh nhân đặt khám.
                    Chỉ có thể đổi Phòng khám và Sức chứa (tối thiểu {editingSchedule.reservedCapacity}).
                  </span>
                </div>
              )}

              {/* Doctor */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">Bác sĩ</span>
                  {editDoctor && (
                    <span className="text-[11px] text-muted-foreground font-normal truncate max-w-[200px]">
                      {departmentName(editDepartmentId)}
                    </span>
                  )}
                </div>
                <select
                  disabled={editingSchedule.reservedCapacity > 0}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editForm.doctorAccountId}
                  onChange={(e) => {
                    setEditForm((prev) => ({
                      ...prev,
                      doctorAccountId: e.target.value,
                      roomId: "",
                      serviceId: "",
                    }))
                    setEditError("")
                  }}
                >
                  <option value="">Chọn bác sĩ</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.accountId} value={doctor.accountId}>
                      {doctor.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Room & Service */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Phòng khám</label>
                  <select
                    disabled={!editDepartmentId || editAvailableRooms.length === 0}
                    className="w-full h-8.5 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60 truncate focus:outline-none focus:ring-1 focus:ring-primary"
                    value={editForm.roomId}
                    onChange={(e) => {
                      const nextRoomId = e.target.value
                      setEditForm((prev) => {
                        const newRoom = editDepartmentRooms.find((r) => r.id === nextRoomId)
                        const serviceStillValid = nextRoomId && newRoom ? newRoom.serviceIds.includes(prev.serviceId) : true
                        return {
                          ...prev,
                          roomId: nextRoomId,
                          serviceId: serviceStillValid ? prev.serviceId : "",
                        }
                      })
                    }}
                  >
                    <option value="">
                      {!editDepartmentId
                        ? "Chọn BS trước"
                        : editAvailableRooms.length === 0
                        ? "Không có phòng"
                        : "Chọn phòng"}
                    </option>
                    {editAvailableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Dịch vụ</label>
                  <select
                    disabled={editingSchedule.reservedCapacity > 0 || !editDepartmentId || editAvailableServices.length === 0}
                    className="w-full h-8.5 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60 truncate focus:outline-none focus:ring-1 focus:ring-primary"
                    value={editForm.serviceId}
                    onChange={(e) => {
                      const nextServiceId = e.target.value
                      setEditForm((prev) => {
                        const currentRoom = editDepartmentRooms.find((r) => r.id === prev.roomId)
                        const roomStillValid = nextServiceId && currentRoom ? currentRoom.serviceIds.includes(nextServiceId) : true
                        return {
                          ...prev,
                          serviceId: nextServiceId,
                          roomId: roomStillValid ? prev.roomId : "",
                        }
                      })
                    }}
                  >
                    <option value="">
                      {!editDepartmentId
                        ? "Chọn BS trước"
                        : editAvailableServices.length === 0
                        ? "Không có dịch vụ"
                        : "Chọn dịch vụ"}
                    </option>
                    {editAvailableServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Session */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Ngày trực</label>
                  <Input
                    type="date"
                    disabled={editingSchedule.reservedCapacity > 0}
                    className="h-8.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    value={editForm.localDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, localDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Ca trực</label>
                  <select
                    disabled={editingSchedule.reservedCapacity > 0}
                    className="w-full h-8.5 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={editForm.session}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, session: e.target.value as AppointmentSlotSession }))}
                  >
                    {Object.entries(SESSION_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Capacity */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <label className="text-foreground">Sức chứa (số bệnh nhân tiếp nhận)</label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Đã đặt: {editingSchedule.reservedCapacity} chỗ
                  </span>
                </div>
                <Input
                  type="number"
                  min={Math.max(1, editingSchedule.reservedCapacity)}
                  max="100"
                  className="h-8.5 text-xs"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, capacity: e.target.value }))}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSchedule(null)}
                  disabled={isEditingSaving}
                  className="text-xs"
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isEditingSaving}
                  className="text-xs font-semibold gap-1.5"
                >
                  {isEditingSaving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {isEditingSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
