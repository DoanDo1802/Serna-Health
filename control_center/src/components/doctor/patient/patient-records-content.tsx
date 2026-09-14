"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useData } from "@/components/base/providers/data-provider"
import { useAuth } from "@/components/base/providers/auth-provider"
import { Card } from "@/components/base/ui/card"
import { Input } from "@/components/base/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/base/ui/table"
import { Badge } from "@/components/base/ui/badge"
import { Button } from "@/components/base/ui/button"
import { Search, Eye, FolderClock, Calendar } from "lucide-react"
import { PatientRecordModal } from "./patient-record-modal"
import { practitionersApi, type PractitionerView } from "@/lib/api"
import type { Patient, Appointment, ExaminationRecord } from "@/types/medical"

export function PatientRecordsContent() {
  const { user } = useAuth()
  const { patients, appointments, examinationRecords, ensureAppointmentsLoaded, ensurePatientsLoaded } = useData()
  const [query, setQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [practitioner, setPractitioner] = useState<PractitionerView | null>(null)

  useEffect(() => {
    ensureAppointmentsLoaded()
    ensurePatientsLoaded()
  }, [ensureAppointmentsLoaded, ensurePatientsLoaded])

  // Lấy thông tin Practitioner của bác sĩ đang đăng nhập
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

  // Kiểm tra lịch hẹn có thuộc về bác sĩ này không
  const isDoctorAppointment = useCallback((a: Appointment) => {
    if (user?.role === "ADMIN") return true

    if (practitioner?.fullName) {
      const pracNameLower = practitioner.fullName.trim().toLowerCase()
      if (a.doctorName && a.doctorName.trim().toLowerCase() === pracNameLower) return true
      if (a.doctorId && (a.doctorId === practitioner.id || a.doctorId === String(user?.doctorId))) return true
    }

    const userNameLower = (user?.name || "").trim().toLowerCase()
    if (userNameLower && a.doctorName && a.doctorName.trim().toLowerCase().includes(userNameLower)) {
      return true
    }
    if (user?.doctorId && a.doctorId === String(user.doctorId)) {
      return true
    }

    return false
  }, [user, practitioner])

  // Kiểm tra hồ sơ khám có thuộc về bác sĩ này không
  const isDoctorRecord = useCallback((rec: ExaminationRecord) => {
    if (user?.role === "ADMIN") return true
    if (rec.doctorId === String(user?.doctorId)) return true
    if (practitioner?.id && rec.doctorId === practitioner.id) return true
    return false
  }, [user, practitioner])

  // Kiểm tra lịch hẹn được coi là đã khám hoặc hoàn tất
  const isCompletedVisit = useCallback((a: Appointment) => {
    const status = (a.status || "").toUpperCase()
    if (["COMPLETED", "DONE", "FULFILLED"].includes(status)) return true
    const todayStr = new Date().toISOString().split("T")[0]
    // Những lịch hẹn trong quá khứ không bị hủy được coi là đã diễn ra
    if (a.appointmentDate && a.appointmentDate < todayStr && status !== "CANCELLED") {
      return true
    }
    return false
  }, [])

  // Tập hợp các ID/Code bệnh nhân đã từng khám với bác sĩ
  const completedPatientKeys = useMemo(() => {
    const keys = new Set<string>()

    // Từ các cuộc hẹn đã khám / hoàn tất
    appointments
      .filter((a) => isDoctorAppointment(a) && isCompletedVisit(a))
      .forEach((a) => {
        if (a.patientId) keys.add(String(a.patientId))
        if (a.patientCode) keys.add(String(a.patientCode))
      })

    // Từ các hồ sơ khám bệnh đã được lưu
    examinationRecords
      .filter((r) => isDoctorRecord(r))
      .forEach((r) => {
        if (r.patientId) keys.add(String(r.patientId))
      })

    return keys
  }, [appointments, examinationRecords, isDoctorAppointment, isCompletedVisit, isDoctorRecord])

  // Lấy các lần khám cụ thể của một bệnh nhân với bác sĩ này
  const getPatientVisits = useCallback((patient: Patient) => {
    const patientDoctorAppointments = appointments
      .filter((a) =>
        isDoctorAppointment(a) &&
        isCompletedVisit(a) &&
        (String(a.patientId) === String(patient.id) ||
          String(a.patientCode) === String(patient.patientCode) ||
          String(a.patientCode) === String(patient.id))
      )

    const patientDoctorRecords = examinationRecords
      .filter((r) =>
        isDoctorRecord(r) &&
        (String(r.patientId) === String(patient.id) ||
          String(r.patientId) === String(patient.patientCode))
      )

    const sortedAppointments = [...patientDoctorAppointments].sort((a, b) => {
      const dateCompare = new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
      if (dateCompare !== 0) return dateCompare
      return (b.timeSlot ?? "").localeCompare(a.timeSlot ?? "")
    })

    const count = Math.max(sortedAppointments.length, patientDoctorRecords.length)

    return {
      appointments: sortedAppointments,
      records: patientDoctorRecords,
      count,
    }
  }, [appointments, examinationRecords, isDoctorAppointment, isCompletedVisit, isDoctorRecord])

  const getLastExamTime = useCallback((patient: Patient) => {
    const { appointments: appts, records } = getPatientVisits(patient)
    const latestAppt = appts[0]
    const latestRecord = records[records.length - 1]

    const dateStr = latestAppt?.appointmentDate || latestRecord?.examinationDate
    if (!dateStr) return "—"

    try {
      const examDate = new Date(dateStr).toLocaleDateString("vi-VN")
      return latestAppt?.timeSlot ? `${examDate} • ${latestAppt.timeSlot}` : examDate
    } catch {
      return dateStr
    }
  }, [getPatientVisits])

  // Lọc danh sách bệnh nhân hiển thị
  const visiblePatients = useMemo(
    () => patients.filter((patient) =>
      completedPatientKeys.has(String(patient.id)) ||
      (patient.patientCode ? completedPatientKeys.has(String(patient.patientCode)) : false)
    ),
    [patients, completedPatientKeys]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return visiblePatients
    const term = query.toLowerCase().trim()
    return visiblePatients.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.phone.includes(term) ||
      p.id.includes(term) ||
      (p.patientCode && p.patientCode.toLowerCase().includes(term))
    )
  }, [visiblePatients, query])

  const isGeneratedPatientEmail = (email?: string) =>
    Boolean(email && /^pat-\d{4}-\d+@medicore\.com$/i.test(email))

  const calculateAge = (dobString: string) => {
    try {
      const dob = new Date(dobString)
      if (isNaN(dob.getTime())) return null
      return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    } catch {
      return null
    }
  }

  return (
    <>
      <Card className="p-4 mb-6 animate-slide-in-up">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm bệnh nhân theo tên, số điện thoại hoặc mã bệnh nhân..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden animate-slide-in-up border">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[24%]">Bệnh nhân</TableHead>
              <TableHead className="w-[14%]">Ngày sinh</TableHead>
              <TableHead className="w-[10%]">Giới tính</TableHead>
              <TableHead className="w-[18%]">Liên hệ</TableHead>
              <TableHead className="w-[12%] text-center">Số lần khám</TableHead>
              <TableHead className="w-[12%]">Khám gần nhất</TableHead>
              <TableHead className="w-[10%] text-right pr-4">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((patient) => {
              const visits = getPatientVisits(patient)
              const visitCount = visits.count || 1
              const lastExamTime = getLastExamTime(patient)
              const age = calculateAge(patient.dateOfBirth)

              return (
                <TableRow key={patient.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="whitespace-normal">
                    <div>
                      <p className="font-semibold text-sm text-foreground truncate">{patient.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {patient.patientCode || patient.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    <div>{new Date(patient.dateOfBirth).toLocaleDateString("vi-VN")}</div>
                    {age !== null && (
                      <div className="text-xs text-muted-foreground">({age} tuổi)</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="outline" className="text-xs font-normal">
                      {patient.gender === "M" ? "Nam" : "Nữ"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-normal">
                    <div className="text-xs font-medium text-foreground/90">{patient.phone || "Chưa có SĐT"}</div>
                    {patient.email && !isGeneratedPatientEmail(patient.email) && (
                      <div className="text-xs text-muted-foreground truncate" title={patient.email}>
                        {patient.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-medium">
                      {visitCount} lần khám
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    <div className="flex items-center gap-1.5 text-foreground/90 font-medium text-xs">
                      <Calendar className="w-3.5 h-3.5 opacity-60 text-primary shrink-0" />
                      <span className="truncate">{lastExamTime}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10 border-primary/20"
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem hồ sơ</span>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="text-center py-16 whitespace-normal">
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2.5 max-w-md mx-auto px-4">
                    <FolderClock className="w-10 h-10 opacity-30 stroke-1 text-primary" />
                    <p className="text-base font-medium text-foreground">Không tìm thấy bệnh nhân nào</p>
                    <p className="text-xs text-muted-foreground leading-relaxed text-center whitespace-normal">
                      {query
                        ? `Không có kết quả phù hợp với từ khóa "${query}". Hãy thử tìm theo tên hoặc số điện thoại khác.`
                        : "Bạn chưa có dữ liệu khám bệnh"
                      }
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedPatient && (
        <PatientRecordModal
          patient={selectedPatient}
          open={!!selectedPatient}
          onOpenChange={(open) => !open && setSelectedPatient(null)}
        />
      )}
    </>
  )
}
