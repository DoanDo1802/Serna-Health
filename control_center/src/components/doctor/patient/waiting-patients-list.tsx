"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/base/providers/auth-provider"
import { useData } from "@/components/base/providers/data-provider"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import { Badge } from "@/components/base/ui/badge"
import { Input } from "@/components/base/ui/input"
import { Textarea } from "@/components/base/ui/textarea"
import { PatientRecordModal } from "./patient-record-modal"
import {
  Search,
  Clock,
  FileText,
  Calendar as CalendarIcon,
  Building2,
  MapPin,
  Stethoscope,
  CheckCircle2,
  Activity,
} from "lucide-react"
import { receptionApi, practitionersApi, type PractitionerView } from "@/lib/api"
import type { Patient, Appointment } from "@/types/medical"
import { cn } from "@/lib/utils"

interface WaitingItem {
  patient: Patient
  appointment: Appointment
  sortKey: string
}

const cancellationReasonOptions = [
  "Bác sĩ có lịch việc đột xuất",
  "Bệnh viện cần điều chỉnh lịch khám",
  "Bệnh nhân cần đổi lịch khám",
]

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const [y, m, d] = dateStr.split("-")
    if (y && m && d) return `${d}/${m}/${y}`
    return new Date(dateStr).toLocaleDateString("vi-VN")
  } catch {
    return dateStr
  }
}

export function WaitingPatientsList() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const {
    patients,
    appointments,
    loadWaitingAppointments,
    ensurePatientsLoaded,
    updateAppointment,
    updatePatient,
  } = useData()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null)
  const [selectedCancelReason, setSelectedCancelReason] = useState("")
  const [customCancelReason, setCustomCancelReason] = useState("")
  const [cancelError, setCancelError] = useState("")

  // Doctor practitioner profile
  const [practitioner, setPractitioner] = useState<PractitionerView | null>(null)

  const today = useMemo(() => new Date().toISOString().split("T")[0], [])
  const [selectedDate, setSelectedDate] = useState(today)

  const activeDate = selectedDate || today

  // Load doctor profile
  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      try {
        const page = await practitionersApi.list()
        const doctorAccountId = String(user?.doctorId || user?.email || "")
        const myPrac = page.items.find(
          (p) =>
            p.userAccountId === doctorAccountId ||
            (user?.name && p.fullName.toLowerCase().includes(user.name.toLowerCase()))
        )
        if (active && myPrac) {
          setPractitioner(myPrac)
        }
      } catch (err) {
        console.warn("Không thể nạp thông tin practitioner của bác sĩ:", err)
      }
    }
    loadProfile()
    return () => {
      active = false
    }
  }, [user])

  // Initial data loading
  const reloadData = useCallback(async () => {
    try {
      await Promise.all([
        loadWaitingAppointments(activeDate),
        ensurePatientsLoaded(),
      ])
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu lịch hẹn:", err)
    }
  }, [activeDate, loadWaitingAppointments, ensurePatientsLoaded])

  useEffect(() => {
    reloadData()
  }, [reloadData])

  // Lọc lịch hẹn THUỘC VỀ BÁC SĨ NÀY
  const doctorAppointments = useMemo(() => {
    const isStaffOrAdmin = user?.role === "ADMIN"

    return appointments.filter((a) => {
      // Bỏ qua lịch đã hủy
      if (a.status?.toUpperCase() === "CANCELLED") return false

      if (isStaffOrAdmin) return true

      // So khớp bác sĩ theo practitioner profile
      if (practitioner?.fullName) {
        const pracNameLower = practitioner.fullName.trim().toLowerCase()
        if (a.doctorName && a.doctorName.trim().toLowerCase() === pracNameLower) return true
        if (a.doctorId && (a.doctorId === practitioner.id || a.doctorId === String(user?.doctorId))) return true
      }

      // So khớp dự phòng theo user.name hoặc user.doctorId
      const userNameLower = (user?.name || "").trim().toLowerCase()
      if (userNameLower && a.doctorName && a.doctorName.trim().toLowerCase().includes(userNameLower)) {
        return true
      }
      if (user?.doctorId && a.doctorId === String(user.doctorId)) {
        return true
      }

      return false
    })
  }, [appointments, practitioner, user])

  // Lọc lịch hẹn theo ngày đang chọn
  const dayAppointments = useMemo(() => {
    return doctorAppointments.filter((a) => a.appointmentDate === activeDate)
  }, [doctorAppointments, activeDate])

  // Ghép nối từng cuộc hẹn với thông tin bệnh nhân tương ứng
  const waitingItems = useMemo((): WaitingItem[] => {
    const patientMap = new Map<string, Patient>(patients.map((p) => [p.id, p]))

    return dayAppointments.map((appt) => {
      const patient = patientMap.get(appt.patientId) || {
        id: appt.patientId,
        name: appt.patientName || "Bệnh nhân",
        dateOfBirth: "1980-01-01",
        gender: "M" as const,
        phone: "Chưa cập nhật",
        email: "",
        address: "Chưa cập nhật",
        status: "waiting" as const,
        createdAt: new Date().toISOString(),
        patientCode: appt.patientCode,
      }

      const sortKey = appt.timeSlot?.split(" - ")[0] || appt.startAt || "99:99"
      return { patient, appointment: appt, sortKey }
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [dayAppointments, patients])

  // Lọc theo từ khóa tìm kiếm
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return waitingItems
    const term = searchTerm.toLowerCase().trim()
    return waitingItems.filter(({ patient, appointment }) =>
      patient.name.toLowerCase().includes(term) ||
      patient.phone.includes(term) ||
      patient.id.includes(term) ||
      (patient.patientCode && patient.patientCode.toLowerCase().includes(term)) ||
      (appointment.serviceName && appointment.serviceName.toLowerCase().includes(term)) ||
      (appointment.departmentName && appointment.departmentName.toLowerCase().includes(term))
    )
  }, [waitingItems, searchTerm])

  const selectedPatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : null

  const handleOpenCancelModal = (appointment: Appointment | null) => {
    if (!appointment) return
    setCancelAppointment(appointment)
    setSelectedCancelReason("")
    setCustomCancelReason("")
    setCancelError("")
    setShowCancelModal(true)
  }

  const handleConfirmCancelAppointment = async () => {
    if (!cancelAppointment) return

    const reason = selectedCancelReason === "custom"
      ? customCancelReason.trim()
      : selectedCancelReason.trim()

    if (!reason) {
      setCancelError("Vui lòng chọn một lý do hoặc nhập lý do hủy.")
      return
    }

    try {
      await updateAppointment(cancelAppointment.id, {
        ...cancelAppointment,
        status: "CANCELLED",
        cancellationReason: reason,
      })
      setShowCancelModal(false)
      setCancelAppointment(null)
      setSelectedCancelReason("")
      setCustomCancelReason("")
      setCancelError("")
      toast({
        title: "Đã hủy lịch hẹn",
        description: "Lịch hẹn đã được hủy thành công.",
      })
    } catch (error) {
      console.error("Không thể hủy lịch hẹn", error)
      setCancelError("Không thể hủy lịch hẹn. Vui lòng thử lại.")
    }
  }

  const handleStartExamination = async (patient: Patient, appointment: Appointment | null) => {
    try {
      let encounterId: string | undefined = undefined

      if (appointment) {
        try {
          const checkInRes = await receptionApi.checkIn(appointment.id, "Bắt đầu lượt khám")
          const encounter = checkInRes?.encounter
          if (encounter) {
            encounterId = encounter.id
            if (encounter.status === "PLANNED") {
              await receptionApi.startEncounter(encounter.id, String(encounter.version))
            }
          }
        } catch (apiErr) {
          console.warn("Kích hoạt lượt khám qua receptionApi cảnh báo:", apiErr)
        }

        await updateAppointment(appointment.id, {
          ...appointment,
          status: "IN_PROGRESS",
        })
      }

      await updatePatient(patient.id, {
        ...patient,
        status: "in-examination",
      })

      const params = new URLSearchParams()
      if (appointment) params.set("appointmentId", appointment.id)
      if (encounterId) params.set("encounterId", encounterId)
      const queryStr = params.toString() ? `?${params.toString()}` : ""
      router.push(`/doctor/examination/${patient.id}${queryStr}`)
    } catch (error) {
      console.error("Không thể bắt đầu khám bệnh", error)
      toast({
        title: "Lỗi bắt đầu khám",
        description: "Không thể bắt đầu khám bệnh. Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const getAppointmentStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "CONFIRMED":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50 gap-1 px-2.5 py-0.5 font-medium text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã xác nhận
          </Badge>
        )
      case "CHECKED_IN":
      case "WAITING":
      case "PENDING":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 gap-1 px-2.5 py-0.5 font-medium text-xs">
            <Clock className="w-3.5 h-3.5" /> Chờ khám
          </Badge>
        )
      case "IN_PROGRESS":
      case "IN_CONSULTATION":
        return (
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50 gap-1 px-2.5 py-0.5 font-medium text-xs">
            <Activity className="w-3.5 h-3.5 animate-pulse" /> Đang khám
          </Badge>
        )
      case "DONE":
      case "COMPLETED":
      case "FULFILLED":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 gap-1 px-2.5 py-0.5 font-medium text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn thành
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="px-2.5 py-0.5 font-medium text-xs">
            {status}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Thanh tìm kiếm & chọn ngày */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm bệnh nhân (tên, mã BN, số điện thoại, khoa, dịch vụ)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center flex-1 sm:flex-initial">
            <CalendarIcon className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 text-sm border border-input rounded-md pl-9 pr-3 py-2 bg-background outline-none focus:ring-1 focus:ring-ring w-full sm:w-[170px] cursor-pointer"
            />
          </div>
          {selectedDate !== today && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(today)}
              className="h-10 px-3 text-xs"
            >
              Hôm nay
            </Button>
          )}
        </div>
      </div>

      {/* Danh sách bệnh nhân chờ khám */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Không có bệnh nhân nào đang chờ khám</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-medium text-muted-foreground">
              Ngày khám: <span className="font-semibold text-foreground">{formatDisplayDate(activeDate)}</span>
              {" • "}{filtered.length} bệnh nhân
            </p>
          </div>

          {filtered.map(({ patient, appointment }) => {
            const cardKey = appointment ? `${patient.id}-${appointment.id}` : patient.id
            const isFinished = appointment.status === "COMPLETED" || appointment.status === "DONE" || appointment.status === "FULFILLED"

            return (
              <Card key={cardKey} className="p-5 hover:shadow-md transition-shadow border bg-card">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-2.5">
                    {/* Hàng 1: Tên bệnh nhân, Mã BN, Giới tính, Trạng thái */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-bold text-foreground tracking-tight">{patient.name}</h3>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {patient.gender === "M" ? "Nam" : "Nữ"}
                      </Badge>
                      {patient.patientCode && (
                        <Badge variant="outline" className="text-xs font-mono bg-muted/50">
                          {patient.patientCode}
                        </Badge>
                      )}
                      {getAppointmentStatusBadge(appointment.status)}
                    </div>

                    {/* Chi tiết lịch hẹn (Ca khám, Khoa, Phòng, Dịch vụ) */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      {appointment.timeSlot && (
                        <div className="flex items-center gap-1 font-semibold text-primary">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{appointment.timeSlot}</span>
                        </div>
                      )}
                      {appointment.departmentName && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 opacity-70" />
                          <span>Khoa: {appointment.departmentName}</span>
                        </div>
                      )}
                      {appointment.roomName && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 opacity-70" />
                          <span>Phòng: {appointment.roomName}</span>
                        </div>
                      )}
                      {appointment.serviceName && (
                        <div className="flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5 opacity-70" />
                          <span>{appointment.serviceName}</span>
                        </div>
                      )}
                      {appointment.symptomsInitial && (
                        <div className="flex items-center gap-1 w-full text-foreground/80 mt-0.5">
                          <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          <span className="line-clamp-1 italic">
                            Lý do khám: {appointment.symptomsInitial}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hành động */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPatientId(patient.id)
                        setShowProfileModal(true)
                      }}
                      className="text-xs h-9"
                    >
                      Hồ sơ
                    </Button>
                    {!isFinished && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive text-xs h-9"
                        disabled={!appointment}
                        onClick={() => handleOpenCancelModal(appointment)}
                      >
                        Hủy lịch hẹn
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleStartExamination(patient, appointment)}
                      className={cn(
                        "text-xs h-9 font-medium",
                        appointment?.status === "IN_PROGRESS" && "bg-sky-600 hover:bg-sky-700"
                      )}
                    >
                      {appointment?.status === "IN_PROGRESS" ? "Tiếp tục khám" : isFinished ? "Xem bệnh án" : "Khám bệnh"}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal xác nhận hủy lịch hẹn */}
      {showCancelModal && cancelAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Xác nhận hủy lịch</p>
              <h3 className="text-xl font-semibold text-foreground">Bạn có chắc chắn muốn hủy lịch hẹn này?</h3>
              <p className="text-sm text-muted-foreground">
                Lịch hẹn của bệnh nhân sẽ được cập nhật và lưu lý do hủy bạn chọn bên dưới.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Chọn lý do hủy</p>
                <div className="space-y-2">
                  {cancellationReasonOptions.map((reason) => (
                    <label key={reason} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-muted/40">
                      <input
                        type="radio"
                        name="cancel-reason"
                        checked={selectedCancelReason === reason}
                        onChange={() => {
                          setSelectedCancelReason(reason)
                          setCancelError("")
                        }}
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-muted/40">
                    <input
                      type="radio"
                      name="cancel-reason"
                      checked={selectedCancelReason === "custom"}
                      onChange={() => {
                        setSelectedCancelReason("custom")
                        setCancelError("")
                      }}
                    />
                    <span>Lý do khác</span>
                  </label>
                </div>
              </div>

              {selectedCancelReason === "custom" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Nhập lý do hủy</p>
                  <Textarea
                    value={customCancelReason}
                    onChange={(e) => {
                      setCustomCancelReason(e.target.value)
                      setCancelError("")
                    }}
                    placeholder="Nhập lý do hủy lịch hẹn..."
                    className="min-h-[96px]"
                  />
                </div>
              )}

              {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelAppointment(null)
                  setSelectedCancelReason("")
                  setCustomCancelReason("")
                  setCancelError("")
                }}
              >
                Đóng
              </Button>
              <Button className="text-destructive hover:text-destructive" onClick={handleConfirmCancelAppointment}>
                Xác nhận hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedPatient && (
        <PatientRecordModal
          patient={selectedPatient}
          open={showProfileModal}
          onOpenChange={setShowProfileModal}
        />
      )}
    </div>
  )
}
