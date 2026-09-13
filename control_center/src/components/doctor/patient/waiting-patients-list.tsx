"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/components/base/providers/data-provider"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import { Badge } from "@/components/base/ui/badge"
import { Input } from "@/components/base/ui/input"
import { Textarea } from "@/components/base/ui/textarea"
import { PatientRecordModal } from "./patient-record-modal"
import { Search, Clock, FileText, Calendar as CalendarIcon } from "lucide-react"
import type { Patient, Appointment } from "@/types/medical"

interface WaitingItem {
  patient: Patient
  appointment: Appointment | null
  sortKey: string
}

const cancellationReasonOptions = [
  "Bác sĩ có lịch việc đột xuất",
  "Bệnh viện cần điều chỉnh lịch khám",
  "Bệnh nhân cần đổi lịch khám",
]

export function WaitingPatientsList() {
  const router = useRouter()
  const { toast } = useToast()
  const { patients, getWaitingPatients, appointments, loadWaitingAppointments, updateAppointment, updatePatient } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null)
  const [selectedCancelReason, setSelectedCancelReason] = useState("")
  const [customCancelReason, setCustomCancelReason] = useState("")
  const [cancelError, setCancelError] = useState("")

  const today = useMemo(() => new Date().toISOString().split("T")[0], [])
  const [selectedDate, setSelectedDate] = useState(today)

  const activeDate = selectedDate || today

  useEffect(() => {
    loadWaitingAppointments(activeDate)
  }, [loadWaitingAppointments, activeDate])

  const waitingPatients = getWaitingPatients(activeDate)

  // Tạo danh sách theo APPOINTMENT (mỗi lịch hẹn = 1 thẻ), sắp xếp theo giờ sớm nhất
  const waitingItems = useMemo((): WaitingItem[] => {
    const waitingStatuses = new Set(["WAITING", "PENDING", "IN_PROGRESS"])

    const items: WaitingItem[] = waitingPatients.flatMap((patient): WaitingItem[] => {
      const patientAppointments = appointments.filter(
        (a) =>
          (a.patientId === patient.id || (patient.patientCode && a.patientCode === patient.patientCode)) &&
          waitingStatuses.has(a.status) &&
          a.appointmentDate === activeDate
      )

      if (patientAppointments.length === 0) {
        return [{ patient, appointment: null as Appointment | null, sortKey: "99:99" }]
      }

      return patientAppointments.map((appt) => ({
        patient,
        appointment: appt as Appointment | null,
        sortKey: appt.timeSlot?.split(" - ")[0] ?? "99:99",
      }))
    })

    // Sắp xếp theo giờ khám sớm nhất lên trước
    return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [waitingPatients, appointments, activeDate])

  // Lọc theo từ khóa tìm kiếm
  const filtered = waitingItems.filter(({ patient }) =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm) ||
    patient.id.includes(searchTerm) ||
    (patient.patientCode && patient.patientCode.toLowerCase().includes(searchTerm.toLowerCase())),
  )

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
    } catch (error) {
      console.error("Không thể hủy lịch hẹn", error)
      setCancelError("Không thể hủy lịch hẹn. Vui lòng thử lại.")
    }
  }

  const handleStartExamination = async (patient: Patient, appointment: Appointment | null) => {
    try {
      if (appointment) {
        await updateAppointment(appointment.id, {
          ...appointment,
          status: "IN_PROGRESS",
        })
      }

      await updatePatient(patient.id, {
        ...patient,
        status: "in-examination",
      })

      const appointmentQuery = appointment ? `?appointmentId=${appointment.id}` : ""
      router.push(`/doctor/examination/${patient.id}${appointmentQuery}`)
    } catch (error) {
      console.error("Không thể bắt đầu khám bệnh", error)
      toast({
        title: "Lỗi bắt đầu khám",
        description: "Không thể bắt đầu khám bệnh. Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm bệnh nhân (tên, mã bệnh nhân, số điện thoại)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center flex-1 sm:flex-initial">
            <CalendarIcon className="absolute left-3 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 text-sm border border-input rounded-md pl-10 pr-3 py-2 bg-background outline-none focus:ring-1 focus:ring-ring w-full cursor-pointer"
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

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Không có bệnh nhân nào đang chờ khám</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(({ patient, appointment }) => {
            const cardKey = appointment ? `${patient.id}-${appointment.id}` : patient.id
            return (
              <Card key={cardKey} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{patient.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {patient.gender === "M" ? "Nam" : "Nữ"}
                      </Badge>
                      {patient.patientCode && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {patient.patientCode}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Ngày sinh:</span> {new Date(patient.dateOfBirth).toLocaleDateString("vi-VN")}
                      </div>
                      <div>
                        <span className="font-medium">Điện thoại:</span> {patient.phone}
                      </div>
                      <div>
                        <span className="font-medium">Địa chỉ:</span> {patient.address}
                      </div>
                      <div>
                        <span className="font-medium">Mã BHYT:</span> {patient.insuranceNumber || "Không có"}
                      </div>
                    </div>
                    {/* Thông tin lịch hẹn */}
                    {appointment && (
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        {appointment.timeSlot && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{appointment.timeSlot}</span>
                          </div>
                        )}
                        {appointment.symptomsInitial && (
                          <div className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="line-clamp-1">{appointment.symptomsInitial}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedPatientId(patient.id)
                        setShowProfileModal(true)
                      }}
                    >
                      Hồ sơ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={!appointment}
                      onClick={() => handleOpenCancelModal(appointment)}
                    >
                      Hủy lịch hẹn
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleStartExamination(patient, appointment)}
                    >
                      {appointment?.status === "IN_PROGRESS" ? "Tiếp tục khám" : "Khám bệnh"}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showCancelModal && cancelAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Xác nhận hủy lịch</p>
              <h3 className="text-xl font-semibold text-foreground">Bạn có chắc chắn muốn hủy lịch hẹn này?</h3>
              <p className="text-sm text-muted-foreground">
                Lịch hẹn của bệnh nhân sẽ được gửi thông báo cùng lý do hủy bạn chọn bên dưới.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Chọn lý do hủy</p>
                <div className="space-y-2">
                  {cancellationReasonOptions.map((reason) => (
                    <label key={reason} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
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
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
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
              <Button variant="outline" onClick={() => {
                setShowCancelModal(false)
                setCancelAppointment(null)
                setSelectedCancelReason("")
                setCustomCancelReason("")
                setCancelError("")
              }}>
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
