"use client"

import { useEffect } from "react"
import { ExaminationPage } from "./examination-page"
import { useData } from "@/components/base/providers/data-provider"

interface ExaminationPageWrapperProps {
  patientId: string
  appointmentId?: string
}

export function ExaminationPageWrapper({ patientId, appointmentId }: ExaminationPageWrapperProps) {
  const {
    patients,
    appointments,
    doctors,
    specialties,
    ensurePatientsLoaded,
    ensureAppointmentsLoaded,
    ensureDoctorsLoaded,
    ensureSpecialtiesLoaded,
  } = useData()

  useEffect(() => {
    ensurePatientsLoaded()
    ensureAppointmentsLoaded()
    ensureDoctorsLoaded()
    ensureSpecialtiesLoaded()
  }, [ensurePatientsLoaded, ensureAppointmentsLoaded, ensureDoctorsLoaded, ensureSpecialtiesLoaded])

  const patient = patients.find((p) => p.id === patientId)
  const today = new Date().toISOString().split("T")[0]
  const appointment = appointmentId
    ? appointments.find((a) => a.id === appointmentId)
    : appointments.find(
        (a) =>
          (a.patientId === patientId || (patient?.patientCode && a.patientCode === patient.patientCode)) &&
          a.appointmentDate === today &&
          a.status === "IN_PROGRESS"
      ) ?? appointments.find(
        (a) =>
          (a.patientId === patientId || (patient?.patientCode && a.patientCode === patient.patientCode)) &&
          a.appointmentDate === today &&
          (a.status === "WAITING" || a.status === "PENDING")
      )

  // Fallback to a mock patient if not found (for demo purposes)
  const displayPatient = patient || {
    id: patientId,
    name: "Bệnh nhân",
    dateOfBirth: "1980-05-15",
    gender: "M" as const,
    phone: "0912345678",
    email: "patient@example.com",
    address: "Địa chỉ",
    insuranceNumber: "BH001234567",
    status: "waiting" as const,
    createdAt: new Date().toISOString(),
  }

  const doctor = appointment ? doctors.find((d) => d.id === appointment.doctorId) : undefined
  const specialtyId = appointment?.specialtyId || doctor?.specialtyId
  const specialty = specialtyId ? specialties.find((s) => s.id === specialtyId) : undefined

  return <ExaminationPage patient={displayPatient} appointment={appointment} specialty={specialty} />
}
