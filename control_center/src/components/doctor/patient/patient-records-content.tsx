"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Search, Eye } from "lucide-react"
import { PatientRecordModal } from "./patient-record-modal"
import type { Patient } from "@/types/medical"

export function PatientRecordsContent() {
  const { user } = useAuth()
  const { patients, appointments, ensureAppointmentsLoaded } = useData()
  const [query, setQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  const completedStatuses = useMemo(() => new Set(["DONE", "COMPLETED"]), [])

  const isGeneratedPatientEmail = (email?: string) =>
    Boolean(email && /^pat-\d{4}-\d+@medicore\.com$/i.test(email))

  useEffect(() => {
    ensureAppointmentsLoaded()
  }, [ensureAppointmentsLoaded])

  const completedPatientKeys = useMemo(() => {
    const doctorId = String(user?.doctorId ?? "")

    return new Set(
      appointments
        .filter((appointment) =>
          appointment.doctorId === doctorId && completedStatuses.has(appointment.status)
        )
        .flatMap((appointment) => [appointment.patientId, appointment.patientCode].filter(Boolean) as string[])
    )
  }, [appointments, completedStatuses, user?.doctorId])

  const visiblePatients = useMemo(
    () => patients.filter((patient) =>
      completedPatientKeys.has(patient.id) ||
      (patient.patientCode ? completedPatientKeys.has(patient.patientCode) : false)
    ),
    [patients, completedPatientKeys]
  )

  const filtered = visiblePatients.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.phone.includes(query) ||
    p.id.includes(query) ||
    (p.patientCode && p.patientCode.toLowerCase().includes(query.toLowerCase()))
  )

  const getCompletedAppointments = (patient: Patient) => {
    const doctorId = String(user?.doctorId ?? "")

    return appointments
      .filter((appointment) =>
        appointment.doctorId === doctorId &&
        completedStatuses.has(appointment.status) &&
        (
          appointment.patientId === patient.id ||
          appointment.patientCode === patient.patientCode ||
          appointment.patientCode === patient.id
        )
      )
      .sort((a, b) => {
        const dateCompare = new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
        if (dateCompare !== 0) return dateCompare
        return (b.timeSlot ?? "").localeCompare(a.timeSlot ?? "")
      })
  }

  const getLastExamTime = (patient: Patient) => {
    const latest = getCompletedAppointments(patient)[0]
    if (!latest) return "—"

    const examDate = new Date(latest.appointmentDate).toLocaleDateString("vi-VN")
    return latest.timeSlot ? `${examDate} • ${latest.timeSlot}` : examDate
  }

  return (
    <>
      <Card className="p-4 mb-6 animate-slide-in-up">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm bệnh nhân theo tên, số điện thoại hoặc ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden animate-slide-in-up">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Bệnh nhân</TableHead>
                <TableHead>Ngày sinh</TableHead>
                <TableHead>Giới tính</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead className="text-center">Số lần khám</TableHead>
                <TableHead>Khám gần nhất</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((patient) => {
                const completedAppointments = getCompletedAppointments(patient)
                const visitCount = completedAppointments.length
                const lastExamTime = getLastExamTime(patient)
                return (
                  <TableRow key={patient.id} className="hover:bg-secondary/50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-foreground">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.patientCode || patient.id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(patient.dateOfBirth).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {patient.gender === "M" ? "Nam" : "Nữ"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="text-xs">{patient.phone || "Chưa có SĐT"}</div>
                      {patient.email && !isGeneratedPatientEmail(patient.email) && (
                        <div className="text-xs">{patient.email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={visitCount > 0 ? "default" : "secondary"}>
                        {visitCount} lần khám
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lastExamTime}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="sr-only">Xem hồ sơ</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                    Không tìm thấy bệnh nhân nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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
