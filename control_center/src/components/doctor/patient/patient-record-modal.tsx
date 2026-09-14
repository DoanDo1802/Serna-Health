"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useData } from "@/components/base/providers/data-provider"
import { useAuth } from "@/components/base/providers/auth-provider"
import { medicalRecordsApi, practitionersApi, type PractitionerView } from "@/lib/api"
import type { MedicalRecordResponse, Patient, Appointment } from "@/types/medical"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import { Card } from "@/components/base/ui/card"
import { Badge } from "@/components/base/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/ui/tabs"
import { ScrollArea } from "@/components/base/ui/scroll-area"
import {
  Calendar,
  Clock,
  Building2,
  MapPin,
  Stethoscope,
  Pill,
  FileText,
  Activity,
  AlertCircle,
  CalendarCheck,
  User,
} from "lucide-react"

interface PatientRecordModalProps {
  patient: Patient
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PatientRecordModal({ patient, open, onOpenChange }: PatientRecordModalProps) {
  const { user } = useAuth()
  const { appointments, examinationRecords, prescriptions, ensureAppointmentsLoaded } = useData()
  const [backendRecords, setBackendRecords] = useState<Record<string, MedicalRecordResponse>>({})
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({})
  const [loadingRecordIds, setLoadingRecordIds] = useState<Record<string, boolean>>({})
  const [practitioner, setPractitioner] = useState<PractitionerView | null>(null)

  useEffect(() => {
    if (open) ensureAppointmentsLoaded()
  }, [open, ensureAppointmentsLoaded])

  // Lấy thông tin Practitioner của bác sĩ
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

  // Lấy tất cả các cuộc hẹn của bệnh nhân này
  const patientAppointments = useMemo(() => appointments
    .filter((appointment) =>
      appointment.patientId === patient.id ||
      appointment.patientCode === patient.patientCode ||
      appointment.patientCode === patient.id
    )
    .sort((a, b) => {
      const dateCompare = new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
      if (dateCompare !== 0) return dateCompare
      return (b.timeSlot ?? "").localeCompare(a.timeSlot ?? "")
    }), [appointments, patient.id, patient.patientCode])

  // Nạp hồ sơ khám từ backend nếu có
  useEffect(() => {
    if (!open || patientAppointments.length === 0) return

    patientAppointments
      .filter((appointment) => ["DONE", "COMPLETED", "FULFILLED"].includes((appointment.status || "").toUpperCase()))
      .forEach((appointment) => {
        const appointmentId = String(appointment.id)
        if (backendRecords[appointmentId] || loadingRecordIds[appointmentId] || recordErrors[appointmentId]) return

        setLoadingRecordIds((current) => ({ ...current, [appointmentId]: true }))
        medicalRecordsApi.getByAppointment(appointment.id)
          .then((record) => {
            setBackendRecords((current) => ({ ...current, [appointmentId]: record }))
          })
          .catch((error) => {
            setRecordErrors((current) => ({
              ...current,
              [appointmentId]: error instanceof Error ? error.message : "Không thể tải hồ sơ khám",
            }))
          })
          .finally(() => {
            setLoadingRecordIds((current) => ({ ...current, [appointmentId]: false }))
          })
      })
  }, [open, patientAppointments, backendRecords, loadingRecordIds, recordErrors])

  const patientRecords = useMemo(() => examinationRecords
    .filter((e) => e.patientId === patient.id || e.patientId === patient.patientCode)
    .sort((a, b) => new Date(b.examinationDate).getTime() - new Date(a.examinationDate).getTime()),
    [examinationRecords, patient.id, patient.patientCode]
  )

  const age = useMemo(() => {
    try {
      const dob = new Date(patient.dateOfBirth)
      if (isNaN(dob.getTime())) return null
      return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    } catch {
      return null
    }
  }, [patient.dateOfBirth])

  const isGeneratedPatientEmail = (email?: string) =>
    Boolean(email && /^pat-\d{4}-\d+@medicore\.com$/i.test(email))

  const getAppointmentStatusText = (status: string) => {
    switch (status?.toUpperCase()) {
      case "WAITING":
      case "PENDING":
        return "Chờ khám"
      case "IN_PROGRESS":
        return "Đang khám"
      case "DONE":
      case "COMPLETED":
      case "FULFILLED":
        return "Đã khám"
      case "CANCELLED":
        return "Đã hủy"
      default:
        return status || "Chưa rõ"
    }
  }

  const getAppointmentStatusVariant = (status: string) => {
    switch (status?.toUpperCase()) {
      case "DONE":
      case "COMPLETED":
      case "FULFILLED":
        return "default"
      case "CANCELLED":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-6 overflow-hidden flex flex-col">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span>Hồ sơ bệnh nhân: {patient.name}</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {patient.patientCode || patient.id}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Xem thông tin cá nhân và toàn bộ lịch sử các lần khám bệnh
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="records" className="w-full flex-1 flex flex-col overflow-hidden mt-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="records" className="text-xs sm:text-sm">
              Lịch sử khám bệnh ({patientAppointments.length || patientRecords.length})
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs sm:text-sm">
              Thông tin cá nhân
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          <TabsContent value="info" className="flex-1 overflow-y-auto pt-3 space-y-4">
            <Card className="p-5 border bg-card/60">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span>Thông tin định danh & Liên hệ</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Mã bệnh nhân</p>
                  <p className="font-semibold text-foreground font-mono">{patient.patientCode || patient.id}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Họ và tên</p>
                  <p className="font-semibold text-foreground">{patient.name}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Ngày sinh & Tuổi</p>
                  <p className="font-medium text-foreground">
                    {new Date(patient.dateOfBirth).toLocaleDateString("vi-VN")}{" "}
                    {age !== null && <span className="text-muted-foreground font-normal">({age} tuổi)</span>}
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Giới tính</p>
                  <p className="font-medium text-foreground">{patient.gender === "M" ? "Nam" : "Nữ"}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Số điện thoại</p>
                  <p className="font-medium text-foreground">{patient.phone || "Chưa cập nhật"}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="font-medium text-foreground">
                    {patient.email && !isGeneratedPatientEmail(patient.email) ? patient.email : "Chưa cập nhật"}
                  </p>
                </div>
                <div className="sm:col-span-2 p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Địa chỉ thường trú</p>
                  <p className="font-medium text-foreground">{patient.address || "Chưa cập nhật"}</p>
                </div>
                {patient.insuranceNumber && (
                  <div className="sm:col-span-2 p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Số thẻ BHYT</p>
                    <p className="font-medium text-foreground font-mono">{patient.insuranceNumber}</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 2: LỊCH SỬ KHÁM BỆNH */}
          <TabsContent value="records" className="flex-1 overflow-hidden pt-2">
            <ScrollArea className="h-[55vh] pr-3">
              <div className="space-y-4">
                {patientAppointments.length === 0 && patientRecords.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <CalendarCheck className="w-10 h-10 opacity-30 stroke-1 text-primary" />
                    <p className="text-sm font-medium text-foreground">Chưa có lịch sử khám bệnh</p>
                    <p className="text-xs max-w-sm">
                      Bệnh nhân chưa có lịch khám hoặc hồ sơ bệnh án nào được ghi nhận.
                    </p>
                  </div>
                ) : (
                  patientAppointments.map((appointment) => {
                    const backendRecord = backendRecords[String(appointment.id)]
                    const localRecord = patientRecords.find((item) => item.appointmentId === appointment.id)
                    const isRecordLoading = loadingRecordIds[String(appointment.id)]
                    const recordError = recordErrors[String(appointment.id)]

                    // Tìm đơn thuốc tương ứng với ca khám này
                    const appointmentPrescription = prescriptions.find(
                      (p) =>
                        p.appointmentId === appointment.id ||
                        (p.patientId === patient.id && p.prescriptionDate === appointment.appointmentDate)
                    )

                    const mainDiag =
                      localRecord?.mainDiagnosis ||
                      appointment.mainDiagnosis ||
                      backendRecord?.mainDiagnosis ||
                      backendRecord?.diagnosisName

                    const icd = localRecord?.icdCode || appointment.icdCode

                    const symptoms = localRecord?.symptoms || appointment.symptomsInitial

                    const examAdvice =
                      localRecord?.treatment || localRecord?.notes || backendRecord?.careAdvice

                    return (
                      <Card key={appointment.id} className="p-4 border shadow-sm space-y-3 bg-card">
                        {/* Hàng 1: Thời gian khám, Khoa/Phòng, Trạng thái */}
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-base text-foreground flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-primary" />
                                {new Date(appointment.appointmentDate).toLocaleDateString("vi-VN")}
                              </span>
                              {appointment.timeSlot && (
                                <Badge variant="secondary" className="text-xs font-normal flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <span>{appointment.timeSlot}</span>
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                              {appointment.doctorName && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 opacity-70" />
                                  <span>BS: {appointment.doctorName}</span>
                                </span>
                              )}
                              {appointment.departmentName && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 opacity-70" />
                                  <span>Khoa: {appointment.departmentName}</span>
                                </span>
                              )}
                              {appointment.roomName && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 opacity-70" />
                                  <span>Phòng: {appointment.roomName}</span>
                                </span>
                              )}
                              {appointment.serviceName && (
                                <span className="flex items-center gap-1">
                                  <Stethoscope className="w-3.5 h-3.5 opacity-70" />
                                  <span>{appointment.serviceName}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <Badge variant={getAppointmentStatusVariant(appointment.status)}>
                            {getAppointmentStatusText(appointment.status)}
                          </Badge>
                        </div>

                        {/* Hàng 2: Chẩn đoán & Triệu chứng */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {mainDiag ? (
                            <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-lg">
                              <span className="font-semibold text-primary block mb-0.5">Chẩn đoán chính:</span>
                              <span className="text-foreground font-medium">
                                {icd && <strong className="font-mono text-primary/80">[{icd}] </strong>}
                                {mainDiag}
                              </span>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-muted/40 rounded-lg text-muted-foreground italic">
                              Chưa có thông tin chẩn đoán
                            </div>
                          )}

                          {symptoms ? (
                            <div className="p-2.5 bg-muted/40 rounded-lg">
                              <span className="font-semibold text-foreground/80 block mb-0.5">Triệu chứng & Lý do:</span>
                              <span className="text-muted-foreground">{symptoms}</span>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-muted/40 rounded-lg text-muted-foreground italic">
                              Không có ghi chú triệu chứng ban đầu
                            </div>
                          )}
                        </div>

                        {/* Hàng 3: Khám lâm sàng & Lời dặn (nếu có) */}
                        {(localRecord?.physicalExamination || examAdvice || localRecord?.followUpDate) && (
                          <div className="space-y-2 pt-1 text-xs border-t border-border/40">
                            {localRecord?.physicalExamination && (
                              <div>
                                <span className="font-semibold text-foreground">Khám lâm sàng / thể chất: </span>
                                <span className="text-muted-foreground">{localRecord.physicalExamination}</span>
                              </div>
                            )}
                            {examAdvice && (
                              <div>
                                <span className="font-semibold text-foreground">Chỉ định điều trị & Lời dặn: </span>
                                <span className="text-muted-foreground">{examAdvice}</span>
                              </div>
                            )}
                            {localRecord?.followUpDate && (
                              <div className="text-primary font-medium flex items-center gap-1.5">
                                <CalendarCheck className="w-3.5 h-3.5" />
                                <span>Hẹn tái khám ngày: {new Date(localRecord.followUpDate).toLocaleDateString("vi-VN")}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hàng 4: Đơn thuốc đã kê (nếu có) */}
                        {appointmentPrescription && appointmentPrescription.items.length > 0 && (
                          <div className="pt-2 border-t border-border/40">
                            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground mb-1.5">
                              <Pill className="w-3.5 h-3.5 text-primary" />
                              <span>Đơn thuốc đã kê ({appointmentPrescription.items.length} loại)</span>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-2 space-y-1.5 text-xs">
                              {appointmentPrescription.items.map((med, idx) => (
                                <div key={idx} className="flex items-center justify-between border-b border-border/30 pb-1 last:border-0 last:pb-0">
                                  <div>
                                    <span className="font-medium text-foreground">{med.medicineName}</span>
                                    {med.dosage && (
                                      <span className="text-muted-foreground text-[11px] block">{med.dosage}</span>
                                    )}
                                  </div>
                                  <div className="text-right font-medium text-foreground shrink-0 pl-2">
                                    {med.quantity} {med.unit || "viên"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hàng 5: Nút xem PDF (nếu có) */}
                        {backendRecord?.pdfUrl && (
                          <div className="pt-2">
                            <a
                              href={backendRecord.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Xem hồ sơ bệnh án PDF</span>
                            </a>
                          </div>
                        )}
                      </Card>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
