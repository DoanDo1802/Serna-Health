"use client"

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type {
  Appointment,
  AppointmentRequest,
  AppointmentResponse,
  AppointmentStatus,
  Doctor,
  DoctorRequest,
  DoctorResponse,
  ExaminationRecord,
  IcdCode,
  Medicine,
  MedicineRequest,
  MedicineResponse,
  Patient,
  PatientRequest,
  PatientResponse,
  Prescription,
  ScheduleEntry,
  ScheduleRequest,
  ScheduleResponse,
  ShiftType,
  Specialty,
  SpecialtyExamTemplate,
  SpecialtyResponse,
} from "@/types/medical"
import {
  appointmentsApi,
  departmentsApi,
  diseasesApi,
  doctorsApi,
  medicinesApi,
  patientsApi,
  personnelApi,
  schedulesApi,
  specialtiesApi,
  type Department,
  type Personnel,
} from "@/lib/api"
import { useAuth } from "@/components/base/providers/auth-provider"
// Mock data seeds removed for production backend connection

interface DataContextValue {
  specialties: Specialty[]
  doctors: Doctor[]
  medicines: Medicine[]
  icdCodes: IcdCode[]
  schedule: ScheduleEntry[]
  appointments: Appointment[]
  patients: Patient[]
  prescriptions: Prescription[]
  examinationRecords: ExaminationRecord[]
  // Specialty CRUD
  addSpecialty: (s: Omit<Specialty, "id" | "doctorCount">) => Promise<Specialty>
  updateSpecialty: (id: string, s: Omit<Specialty, "id" | "doctorCount">) => Promise<void>
  updateSpecialtyStatus: (id: string, active: boolean) => Promise<void>
  deleteSpecialty: (id: string) => Promise<void>
  // Doctor CRUD
  addDoctor: (d: Omit<Doctor, "id"> & { password?: string }) => void
  updateDoctor: (id: string, d: Omit<Doctor, "id"> & { password?: string }) => void
  deleteDoctor: (id: string) => Promise<string>
  setShift: (doctorId: string, dateStr: string, shift: ShiftType) => Promise<void>
  // Medicine CRUD
  addMedicine: (m: Omit<Medicine, "id">) => void
  updateMedicine: (id: string, m: Omit<Medicine, "id">) => void
  deleteMedicine: (id: string) => void
  // ICD CRUD
  addIcd: (c: Omit<IcdCode, "id">) => void
  updateIcd: (id: string, c: Omit<IcdCode, "id">) => void
  deleteIcd: (id: string) => void
  // Appointment CRUD
  addAppointment: (a: Omit<Appointment, "id">) => void
  updateAppointment: (id: string, a: Omit<Appointment, "id">) => Promise<void>
  deleteAppointment: (id: string) => void
  // Patient CRUD
  addPatient: (p: Omit<Patient, "id">) => void
  updatePatient: (id: string, p: Omit<Patient, "id">) => Promise<void>
  deletePatient: (id: string) => void
  // Prescription CRUD
  addPrescription: (p: Omit<Prescription, "id">) => void
  updatePrescription: (id: string, p: Omit<Prescription, "id">) => void
  deletePrescription: (id: string) => void
  // Examination Record CRUD
  addExaminationRecord: (e: Omit<ExaminationRecord, "id">) => void
  updateExaminationRecord: (id: string, e: Omit<ExaminationRecord, "id">) => void
  deleteExaminationRecord: (id: string) => void
  // Helper methods
  getWaitingPatients: (date?: string) => Patient[]
  getPatientPrescriptions: (patientId: string) => Prescription[]
  getPatientRecords: (patientId: string) => ExaminationRecord[]
  // Lazy loaders — gọi khi vào trang cần data
  ensureMedicinesLoaded: () => Promise<void>
  ensureIcdLoaded: () => Promise<void>
  ensurePatientsLoaded: () => Promise<void>
  ensureAppointmentsLoaded: () => Promise<void>
  loadWaitingAppointments: (date?: string) => Promise<void>
  ensureScheduleLoaded: () => Promise<void>
  ensureDoctorsLoaded: () => Promise<void>
  ensureSpecialtiesLoaded: () => Promise<void>
  ensurePrescriptionsLoaded: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

const uid = () => Math.random().toString(36).slice(2, 9)

const toNumber = (value: string) => Number.parseInt(value, 10)
const safeNumber = (value: number | undefined, fallback = 0) => value ?? fallback

const emptyExamTemplate: SpecialtyExamTemplate = { fields: [] }

const normalizeExamTemplate = (template?: SpecialtyExamTemplate | null): SpecialtyExamTemplate => ({
  fields: Array.isArray(template?.fields) ? template.fields : [],
})

const defaultIcdCodes: IcdCode[] = [
  { id: "icd-1", code: "J00", name: "Viêm mũi họng cấp (cảm thường)", category: "Bệnh hệ hô hấp", description: "Cảm lạnh thông thường" },
  { id: "icd-2", code: "J02", name: "Viêm họng cấp", category: "Bệnh hệ hô hấp", description: "Viêm họng cấp tính" },
  { id: "icd-3", code: "J06", name: "Nhiễm khuẩn hô hấp trên cấp tính ở nhiều vị trí", category: "Bệnh hệ hô hấp", description: "Nhiễm khuẩn đường hô hấp trên" },
  { id: "icd-4", code: "I10", name: "Tăng huyết áp vô căn (nguyên phát)", category: "Bệnh hệ tuần hoàn", description: "Huyết áp cao nguyên phát" },
  { id: "icd-5", code: "K29", name: "Viêm dạ dày và tá tràng", category: "Bệnh hệ tiêu hóa", description: "Viêm dạ dày, tá tràng" },
  { id: "icd-6", code: "E11", name: "Bệnh đái tháo đường không phụ thuộc insulin (Typ 2)", category: "Bệnh nội tiết, dinh dưỡng và chuyển hóa", description: "Tiểu đường type 2" },
  { id: "icd-7", code: "H10", name: "Viêm kết mạc", category: "Bệnh về mắt", description: "Đau mắt đỏ" },
  { id: "icd-8", code: "H52", name: "Rối loạn khúc xạ và điều tiết", category: "Bệnh về mắt", description: "Cận thị, viễn thị, loạn thị" },
  { id: "icd-9", code: "M54", name: "Đau lưng", category: "Bệnh hệ cơ - xương khớp", description: "Đau cột sống thắt lưng" },
  { id: "icd-10", code: "R50", name: "Sốt không rõ nguyên nhân", category: "Triệu chứng, dấu hiệu và kết quả lâm sàng", description: "Sốt chưa rõ nguyên nhân" },
]

const defaultMedicines: Medicine[] = [
  { id: "med-1", name: "Paracetamol 500mg", code: "PARA500", unit: "Viên", price: 1000, stock: 1000, manufacturer: "Dược Hậu Giang", status: "available", category: "Giảm đau, hạ sốt" },
  { id: "med-2", name: "Amoxicillin 500mg", code: "AMOX500", unit: "Viên", price: 2500, stock: 500, manufacturer: "Mekophar", status: "available", category: "Kháng sinh" },
  { id: "med-3", name: "Ibuprofen 400mg", code: "IBU400", unit: "Viên", price: 1500, stock: 400, manufacturer: "Dược Hà Tây", status: "available", category: "Kháng viêm" },
  { id: "med-4", name: "Omeprazole 20mg", code: "OMEP20", unit: "Viên", price: 3000, stock: 600, manufacturer: "Dược Hậu Giang", status: "available", category: "Dạ dày" },
  { id: "med-5", name: "Cetirizine 10mg", code: "CETI10", unit: "Viên", price: 1200, stock: 800, manufacturer: "Dược TW1", status: "available", category: "Kháng dị ứng" },
]

const getStoredSpecialtyMeta = (deptId: string) => {
  if (typeof window === "undefined") return { description: "", examTemplate: emptyExamTemplate }
  try {
    const desc = window.localStorage.getItem(`dept_desc_${deptId}`) || ""
    const tplRaw = window.localStorage.getItem(`dept_tpl_${deptId}`)
    const examTemplate = tplRaw ? JSON.parse(tplRaw) : emptyExamTemplate
    return { description: desc, examTemplate: normalizeExamTemplate(examTemplate) }
  } catch {
    return { description: "", examTemplate: emptyExamTemplate }
  }
}

const saveStoredSpecialtyMeta = (deptId: string, description?: string, examTemplate?: SpecialtyExamTemplate) => {
  if (typeof window === "undefined") return
  try {
    if (description !== undefined) window.localStorage.setItem(`dept_desc_${deptId}`, description)
    if (examTemplate !== undefined) window.localStorage.setItem(`dept_tpl_${deptId}`, JSON.stringify(examTemplate))
  } catch {
    // Ignore storage issues
  }
}

const removeStoredSpecialtyMeta = (deptId: string) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(`dept_desc_${deptId}`)
    window.localStorage.removeItem(`dept_tpl_${deptId}`)
  } catch {
    // Ignore storage issues
  }
}

const mapDepartmentToSpecialty = (d: Department, fallback?: Partial<Specialty>): Specialty => {
  const meta = getStoredSpecialtyMeta(d.id)
  const dbTemplate = d.examTemplate ? normalizeExamTemplate(d.examTemplate) : null
  const fallbackTemplate = fallback?.examTemplate ? normalizeExamTemplate(fallback.examTemplate) : null
  const localTemplate = meta.examTemplate ? normalizeExamTemplate(meta.examTemplate) : null

  const resolvedTemplate = (fallbackTemplate && fallbackTemplate.fields.length > 0)
    ? fallbackTemplate
    : (dbTemplate && dbTemplate.fields.length > 0)
    ? dbTemplate
    : (localTemplate && localTemplate.fields.length > 0)
    ? localTemplate
    : (dbTemplate ?? localTemplate ?? emptyExamTemplate)

  return {
    id: d.id,
    name: d.name,
    code: d.code,
    description: fallback?.description ?? meta.description,
    doctorCount: fallback?.doctorCount ?? 0,
    status: d.active ? "active" : "inactive",
    examTemplate: resolvedTemplate,
    version: d.version,
  }
}

const mapPersonnelToDoctor = (p: Personnel): Doctor => ({
  id: p.accountId,
  name: p.fullName,
  specialtyId: p.departmentId ? String(p.departmentId) : "",
  title: p.doctorProfile?.academicDegree || p.doctorProfile?.professionalTitle || "Bác sĩ",
  email: p.displayEmail,
  phone: p.doctorProfile?.phone || "",
  experience: p.doctorProfile?.yearsExperience || 0,
  status: p.active ? "active" : "inactive",
  avatar: p.doctorProfile?.avatarUrl || undefined,
  bio: p.doctorProfile?.biography || undefined,
  doctorCode: p.staffCode,
})

const mapSpecialty = (s: SpecialtyResponse, fallback?: Partial<Specialty>): Specialty => ({
  id: String(s.id),
  name: s.name,
  code: fallback?.code ?? `SP${s.id}`,
  description: fallback?.description ?? "",
  doctorCount: Number(s.doctorCount ?? fallback?.doctorCount ?? 0),
  status: s.active === false ? "inactive" : fallback?.status ?? "active",
  examTemplate: normalizeExamTemplate(s.examTemplate ?? fallback?.examTemplate ?? emptyExamTemplate),
  version: (s as any).version ?? fallback?.version ?? 0,
})

const mapDoctor = (d: DoctorResponse, fallback?: Partial<Doctor>): Doctor => ({
  id: String(d.id),
  name: d.name,
  specialtyId: String(d.specialtyId),
  title: d.title ?? fallback?.title ?? "Bác sĩ",
  email: d.email ?? fallback?.email ?? "",
  phone: d.phone ?? fallback?.phone ?? "",
  experience: safeNumber(d.experience, fallback?.experience ?? 0),
  status: (d.status ?? fallback?.status ?? "active") as "active" | "inactive",
  avatar: d.avatar ?? fallback?.avatar,
  bio: d.bio ?? fallback?.bio,
  doctorCode: d.doctorCode ?? fallback?.doctorCode,
})

const mapMedicine = (m: MedicineResponse, fallback?: Partial<Medicine>): Medicine => ({
  id: String(m.id),
  name: m.name,
  code: m.code ?? fallback?.code ?? `MED${m.id}`,
  category: m.category ?? fallback?.category ?? "",
  unit: m.unit,
  price: safeNumber(m.price, fallback?.price ?? 0),
  stock: safeNumber(m.stock, fallback?.stock ?? 0),
  manufacturer: m.manufacturer ?? fallback?.manufacturer ?? "",
  status: (m.status ?? fallback?.status ?? "available") as "available" | "low" | "out",
})

const mapIcdCode = (d: { id?: string; code: string; name: string; category?: string; description?: string }): IcdCode => ({
  id: d.id ?? d.code,
  code: d.code,
  name: d.name,
  category: d.category ?? "",
  description: d.description ?? "",
})

const mapPatient = (p: any, fallback?: Partial<Patient>): Patient => ({
  id: String(p.id),
  name: p.fullName ?? p.name ?? fallback?.name ?? "Bệnh nhân",
  dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth) : (fallback?.dateOfBirth ?? "1980-01-01"),
  gender: (p.declaredGender === "FEMALE" || p.gender === "F" || fallback?.gender === "F" ? "F" : "M"),
  phone: p.phone ?? fallback?.phone ?? "",
  email: p.email ?? fallback?.email ?? "",
  address: p.address ?? fallback?.address ?? "",
  insuranceNumber: p.insuranceNumber ?? fallback?.insuranceNumber,
  status: (p.status ?? fallback?.status ?? "waiting") as "waiting" | "in-examination" | "completed" | "no-show",
  createdAt: p.createdAt ? String(p.createdAt) : (fallback?.createdAt ?? new Date().toISOString()),
  patientCode: p.patientCode ?? fallback?.patientCode,
})

const mapAppointment = (a: any, patientList: Patient[], fallback?: Partial<Appointment>): Appointment => {
  const patient = patientList.find((p) => p.id === String(a.patientId) || p.patientCode === a.patientId || p.id === String(a.patientDbId ?? a.patientId))

  let appointmentDate = a.appointmentDate
  if (!appointmentDate && a.startAt) {
    try {
      const d = new Date(a.startAt)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      appointmentDate = `${y}-${m}-${day}`
    } catch {
      appointmentDate = a.startAt.split("T")[0]
    }
  }
  if (!appointmentDate) appointmentDate = new Date().toISOString().split("T")[0]

  let timeSlot = a.timeSlot
  if (!timeSlot && a.startAt && a.endAt) {
    try {
      const start = new Date(a.startAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      const end = new Date(a.endAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      timeSlot = `${start} - ${end}`
    } catch {}
  }
  if (!timeSlot && a.session) {
    timeSlot = a.session === "MORNING" ? "08:00 - 12:00 (Sáng)" : "13:30 - 17:30 (Chiều)"
  }

  return {
    id: String(a.id),
    patientName: patient?.name ?? a.patientName ?? "Bệnh nhân",
    patientId: patient?.id ?? String(a.patientDbId ?? a.patientId),
    doctorId: String(a.doctorId ?? a.practitionerId ?? ""),
    doctorName: a.doctorName ?? a.practitionerName,
    specialtyId: String(a.specialtyId ?? a.departmentId ?? fallback?.specialtyId ?? ""),
    departmentName: a.departmentName,
    roomName: a.roomName,
    serviceName: a.serviceName,
    appointmentDate,
    icdCode: a.icdCode ?? fallback?.icdCode,
    mainDiagnosis: a.mainDiagnosis ?? fallback?.mainDiagnosis,
    status: (a.status ?? fallback?.status ?? "CONFIRMED") as AppointmentStatus,
    timeSlot: timeSlot ?? fallback?.timeSlot,
    symptomsInitial: a.symptomsInitial ?? fallback?.symptomsInitial,
    patientCode: patient?.patientCode ?? a.patientCode ?? a.patientId,
    slotId: a.slotId,
    startAt: a.startAt,
    endAt: a.endAt,
  }
}

const mapPatientFromAppointment = (a: any, fallback?: Partial<Patient>): Patient => ({
  id: String(a.patientDbId ?? fallback?.id ?? a.patientId),
  name: a.patientName ?? fallback?.name ?? "Bệnh nhân",
  dateOfBirth: a.patientDateOfBirth ?? fallback?.dateOfBirth ?? "1980-01-01",
  gender: (a.patientGender === "F" || a.patientGender === "FEMALE" || fallback?.gender === "F" ? "F" : "M"),
  phone: a.patientPhone ?? fallback?.phone ?? "",
  email: fallback?.email ?? "",
  address: a.patientAddress ?? fallback?.address ?? "",
  insuranceNumber: fallback?.insuranceNumber,
  status: fallback?.status ?? "waiting",
  createdAt: fallback?.createdAt ?? new Date().toISOString(),
  patientCode: a.patientCode ?? a.patientId,
})

const normalizeShift = (timeSlot?: string): ShiftType => {
  const normalized = (timeSlot ?? "").trim().toLowerCase()
  if (normalized === "morning" || normalized === "ca sáng" || normalized === "08:00 - 12:00") return "morning"
  if (normalized === "afternoon" || normalized === "ca chiều" || normalized === "13:30 - 17:30") return "afternoon"
  if (normalized === "full_day" || normalized === "cả ngày" || normalized === "ca cả ngày" || normalized === "08:00 - 17:30") return "full_day"
  if (normalized === "night" || normalized === "ca tối" || normalized === "17:30 - 21:30") return "night"
  return "off"
}

const toScheduleTimeSlot = (shift: ShiftType) => {
  if (shift === "morning") return "08:00 - 12:00"
  if (shift === "afternoon") return "13:30 - 17:30"
  if (shift === "full_day") return "08:00 - 17:30"
  if (shift === "night") return "17:30 - 21:30"
  return "off"
}

const mapScheduleEntries = (scheduleResponses: ScheduleResponse[]): ScheduleEntry[] => {
  const byDoctor = new Map<string, ScheduleEntry>()

  scheduleResponses.forEach((scheduleResponse) => {
    const doctorId = String(scheduleResponse.doctorId)
    const entry = byDoctor.get(doctorId) ?? { doctorId, shifts: {}, scheduleIds: {} }
    entry.shifts[scheduleResponse.workDate] = normalizeShift(scheduleResponse.timeSlot)
    entry.scheduleIds = { ...(entry.scheduleIds ?? {}), [scheduleResponse.workDate]: String(scheduleResponse.id) }
    byDoctor.set(doctorId, entry)
  })

  return Array.from(byDoctor.values())
}

const toScheduleRequest = (doctorId: string, dateStr: string, shift: ShiftType): ScheduleRequest => ({
  doctorId: toNumber(doctorId),
  workDate: dateStr,
  timeSlot: toScheduleTimeSlot(shift),
})

const withDoctorCounts = (specialtyList: Specialty[], doctorList: Doctor[]) =>
  specialtyList.map((sp) => ({
    ...sp,
    doctorCount: doctorList.filter((d) => d.specialtyId === sp.id).length,
  }))

const toDoctorRequest = (d: Omit<Doctor, "id"> & { password?: string }): DoctorRequest => ({
  name: d.name,
  specialtyId: toNumber(d.specialtyId),
  title: d.title,
  bio: d.bio,
  phone: d.phone,
  experience: d.experience,
  email: d.email,
  password: d.password,
  status: d.status,
  avatarUrl: d.avatar,
})

const toMedicineRequest = (m: Omit<Medicine, "id">): MedicineRequest => ({
  name: m.name,
  unit: m.unit,
  category: m.category,
  price: m.price,
  stock: m.stock,
  manufacturer: m.manufacturer,
})

const toPatientRequest = (p: Omit<Patient, "id">): PatientRequest => ({
  name: p.name,
  dateOfBirth: p.dateOfBirth,
  gender: p.gender,
  phone: p.phone,
  address: p.address,
  email: p.email,
  insuranceNumber: p.insuranceNumber,
  status: p.status,
})

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [icdCodes, setIcdCodes] = useState<IcdCode[]>([])
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [examinationRecords, setExaminationRecords] = useState<ExaminationRecord[]>([])
  // Load clinical examination records and prescriptions from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const storedRecords = localStorage.getItem("medicore_examination_records")
      if (storedRecords) {
        const parsed = JSON.parse(storedRecords)
        if (Array.isArray(parsed)) setExaminationRecords(parsed)
      }
      const storedPrescriptions = localStorage.getItem("medicore_prescriptions")
      if (storedPrescriptions) {
        const parsed = JSON.parse(storedPrescriptions)
        if (Array.isArray(parsed)) setPrescriptions(parsed)
      }
    } catch (e) {
      console.warn("Lỗi đọc dữ liệu hồ sơ khám/đơn thuốc từ localStorage:", e)
    }
  }, [])

  // Track which datasets have been loaded from backend to avoid duplicate fetches
  const loadedRef = React.useRef<Record<string, boolean>>({})

  // ── Lazy loaders: only fetch from backend once per session ──────────
  const ensureMedicinesLoaded = React.useCallback(async () => {
    if (loadedRef.current.medicines) return
    loadedRef.current.medicines = true
    try {
      const res = await medicinesApi.list()
      if (Array.isArray(res) && res.length > 0) {
        setMedicines(res.map((m) => mapMedicine(m)))
      } else {
        setMedicines(defaultMedicines)
      }
    } catch {
      setMedicines(defaultMedicines)
    }
  }, [])

  const ensureIcdLoaded = React.useCallback(async () => {
    if (loadedRef.current.icd) return
    loadedRef.current.icd = true
    try {
      const res = await diseasesApi.list()
      if (Array.isArray(res) && res.length > 0) {
        setIcdCodes(res.map((d) => mapIcdCode(d)))
      } else {
        setIcdCodes(defaultIcdCodes)
      }
    } catch {
      setIcdCodes(defaultIcdCodes)
    }
  }, [])

  const ensurePatientsLoaded = React.useCallback(async () => {
    if (loadedRef.current.patients) return
    loadedRef.current.patients = true
    try {
      const res = await patientsApi.list()
      const raw: any = res
      const items = Array.isArray(raw) ? raw : (raw?.items ?? [])
      setPatients(items.map((p: any) => mapPatient(p)))
    } catch (e) {
      loadedRef.current.patients = false
      console.error("Không thể tải danh sách bệnh nhân", e)
    }
  }, [])

  const ensureAppointmentsLoaded = React.useCallback(async () => {
    if (loadedRef.current.appointments) return
    loadedRef.current.appointments = true
    try {
      const res = await appointmentsApi.listAppointments(100)
      const raw: any = res
      const items = Array.isArray(raw) ? raw : (raw?.items ?? [])

      // Nạp thông tin bệnh nhân tương ứng nếu chưa có
      const patientIds = Array.from(new Set<string>(items.map((a: any) => String(a.patientId)).filter(Boolean)))
      let fetchedPatients: Patient[] = []
      if (patientIds.length > 0) {
        try {
          const results = await Promise.allSettled(patientIds.map((id: string) => patientsApi.get(id)))
          fetchedPatients = results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && Boolean(r.value))
            .map((r) => mapPatient(r.value))
        } catch {}
      }

      let allPatients: Patient[] = []
      setPatients((prev) => {
        const byId = new Map(prev.map((patient) => [patient.id, patient]))
        fetchedPatients.forEach((p) => byId.set(p.id, p))
        items.forEach((a: any) => {
          if (!byId.has(String(a.patientId))) {
            const p = mapPatientFromAppointment(a)
            byId.set(p.id, p)
          }
        })
        allPatients = Array.from(byId.values())
        return allPatients
      })

      let patches: Record<string, any> = {}
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("medicore_appointment_patches")
          if (raw) patches = JSON.parse(raw)
        } catch {}
      }

      setAppointments(() => {
        return items.map((a: any) => {
          const mapped = mapAppointment(a, allPatients)
          if (patches[mapped.id]) {
            return { ...mapped, ...patches[mapped.id] }
          }
          return mapped
        })
      })
    } catch (e) {
      loadedRef.current.appointments = false
      console.error("Không thể tải danh sách lịch hẹn", e)
    }
  }, [])

  const loadWaitingAppointments = React.useCallback(async (_date?: string) => {
    try {
      const res = await appointmentsApi.listAppointments(100)
      const raw: any = res
      const items = Array.isArray(raw) ? raw : (raw?.items ?? [])

      const patientIds = Array.from(new Set<string>(items.map((a: any) => String(a.patientId)).filter(Boolean)))
      let fetchedPatients: Patient[] = []
      if (patientIds.length > 0) {
        try {
          const results = await Promise.allSettled(patientIds.map((id: string) => patientsApi.get(id)))
          fetchedPatients = results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && Boolean(r.value))
            .map((r) => mapPatient(r.value))
        } catch {}
      }

      let allPatients: Patient[] = []
      setPatients((prev) => {
        const byId = new Map(prev.map((patient) => [patient.id, patient]))
        fetchedPatients.forEach((p) => byId.set(p.id, p))
        items.forEach((a: any) => {
          if (!byId.has(String(a.patientId))) {
            const p = mapPatientFromAppointment(a)
            byId.set(p.id, p)
          }
        })
        allPatients = Array.from(byId.values())
        return allPatients
      })

      let patches: Record<string, any> = {}
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("medicore_appointment_patches")
          if (raw) patches = JSON.parse(raw)
        } catch {}
      }

      setAppointments(() => {
        return items.map((a: any) => {
          const mapped = mapAppointment(a, allPatients)
          if (patches[mapped.id]) {
            return { ...mapped, ...patches[mapped.id] }
          }
          return mapped
        })
      })
    } catch (e) {
      console.error("Không thể tải danh sách bệnh nhân chờ khám", e)
    }
  }, [])

  const ensureScheduleLoaded = React.useCallback(async () => {
    if (loadedRef.current.schedule || user?.role !== "ADMIN") return
    loadedRef.current.schedule = true
    try {
      const res = await schedulesApi.list()
      setSchedule(mapScheduleEntries(res))
    } catch (e) {
      loadedRef.current.schedule = false
      console.error("Không thể tải lịch trực", e)
    }
  }, [user])

  const ensureDoctorsLoaded = React.useCallback(async () => {
    if (loadedRef.current.doctors || user?.role !== "ADMIN") return
    loadedRef.current.doctors = true
    try {
      const page = await personnelApi.list({ type: "DOCTOR" })
      const nextDoctors = page.items.map(mapPersonnelToDoctor)
      setDoctors(nextDoctors)
      setSpecialties((prev) => withDoctorCounts(prev, nextDoctors))
    } catch (e) {
      loadedRef.current.doctors = false
      console.error("Không thể tải danh sách bác sĩ", e)
    }
  }, [user?.role])

  const ensureSpecialtiesLoaded = React.useCallback(async () => {
    if (loadedRef.current.specialties) return
    loadedRef.current.specialties = true
    try {
      const page = await departmentsApi.list()
      const nextSpecialties = page.items.map((d) => mapDepartmentToSpecialty(d))
      setSpecialties(withDoctorCounts(nextSpecialties, doctors))
    } catch (e) {
      loadedRef.current.specialties = false
      console.error("Không thể tải danh sách chuyên khoa", e)
    }
  }, [doctors])

  const ensurePrescriptionsLoaded = React.useCallback(async () => {
    if (loadedRef.current.prescriptions || user?.role !== "ADMIN") return
    loadedRef.current.prescriptions = true
    setPrescriptions([])
  }, [user?.role])

  // ── Initial load by role ──────────────────────────────────────────
  useEffect(() => {
    if (user?.role !== "ADMIN") return

    let cancelled = false

    // Reset loaded flags when the authenticated portal role changes.
    loadedRef.current = {}

    async function loadData() {
      try {
        if (user?.role === "ADMIN") {
          // ADMIN Dashboard cần: specialties, doctors, appointments
          const [deptPage, personnelDoctorPage, appointmentResponses] = await Promise.all([
            departmentsApi.list(),
            personnelApi.list({ type: "DOCTOR" }),
            appointmentsApi.list(),
          ])

          if (cancelled) return

          const nextDoctors = personnelDoctorPage.items.map(mapPersonnelToDoctor)
          const nextSpecialties = withDoctorCounts(
            deptPage.items.map((d) => mapDepartmentToSpecialty(d)),
            nextDoctors,
          )
          const nextAppointments = appointmentResponses.map((a) => mapAppointment(a, patients))

          setDoctors(nextDoctors)
          setSpecialties(nextSpecialties)
          setAppointments(nextAppointments)

          loadedRef.current.doctors = true
          loadedRef.current.specialties = true
          loadedRef.current.appointments = true
        } else {
          // DOCTOR: defer heavy data loads to each page.
          // Waiting patients uses a filtered endpoint; prescriptions/records load patients on demand.
          if (cancelled) return
        }
      } catch (error) {
        console.error("Không thể tải dữ liệu từ backend, giữ dữ liệu mock hiện tại", error)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [user?.role])

  const updateDoctorCounts = (nextDoctors: Doctor[]) => {
    setSpecialties((prev) => withDoctorCounts(prev, nextDoctors))
  }

  const reloadMedicines = async () => {
    const medicineResponses = await medicinesApi.list()
    setMedicines(medicineResponses.map((m) => mapMedicine(m)))
  }

  const getAppointmentRequest = (a: Omit<Appointment, "id">): AppointmentRequest => {
    const patient = patients.find((p) => p.id === a.patientId || p.patientCode === a.patientId)

    return {
      patientId: patient?.patientCode ?? a.patientCode ?? a.patientId,
      doctorId: toNumber(a.doctorId),
      appointmentDate: a.appointmentDate,
      timeSlot: a.timeSlot ?? "08:00 - 09:00",
      symptomsInitial: a.symptomsInitial ?? a.mainDiagnosis,
      status: a.status,
      cancellationReason: a.cancellationReason,
    }
  }

  const value: DataContextValue = {
    specialties,
    doctors,
    medicines,
    icdCodes,
    schedule,
    appointments,
    patients,
    prescriptions,
    examinationRecords,

    addSpecialty: async (s) => {
      try {
        const res = await departmentsApi.create({
          code: s.code || `DEP-${Date.now().toString(36).toUpperCase()}`,
          name: s.name,
          examTemplate: s.examTemplate ? normalizeExamTemplate(s.examTemplate) : undefined,
        })
        const createdDept = res.data
        if (s.status === "inactive") {
          const deactRes = await departmentsApi.deactivate(createdDept.id, `"${createdDept.version}"`)
          createdDept.active = false
          createdDept.version = deactRes.data.version
        }
        saveStoredSpecialtyMeta(createdDept.id, s.description, normalizeExamTemplate(s.examTemplate))
        const newSpecialty = mapDepartmentToSpecialty(createdDept, s)
        setSpecialties((p) => withDoctorCounts([...p, newSpecialty], doctors))
        return newSpecialty
      } catch (error) {
        console.error("Không thể tạo chuyên khoa", error)
        throw error
      }
    },
    updateSpecialty: async (id, s) => {
      try {
        const existing = specialties.find((x) => x.id === id)
        const etag = `"${s.version ?? existing?.version ?? 0}"`
        const res = await departmentsApi.update(
          id,
          {
            code: s.code || existing?.code || "",
            name: s.name,
            examTemplate: s.examTemplate !== undefined ? normalizeExamTemplate(s.examTemplate) : existing?.examTemplate,
          },
          etag
        )
        let updatedDept = res.data
        if (s.status && existing && s.status !== existing.status) {
          const statusEtag = `"${updatedDept.version}"`
          const statusRes = s.status === "active"
            ? await departmentsApi.activate(id, statusEtag)
            : await departmentsApi.deactivate(id, statusEtag)
          updatedDept = statusRes.data
        }
        saveStoredSpecialtyMeta(id, s.description, normalizeExamTemplate(s.examTemplate))
        setSpecialties((p) =>
          p.map((x) => (x.id === id ? mapDepartmentToSpecialty(updatedDept, { ...x, ...s }) : x))
        )
      } catch (error) {
        console.error("Không thể cập nhật chuyên khoa", error)
        throw error
      }
    },
    updateSpecialtyStatus: async (id, active) => {
      try {
        const existing = specialties.find((x) => x.id === id)
        const etag = `"${existing?.version ?? 0}"`
        const res = active
          ? await departmentsApi.activate(id, etag)
          : await departmentsApi.deactivate(id, etag)
        const updatedDept = res.data
        setSpecialties((p) =>
          p.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: updatedDept.active ? "active" : "inactive",
                  version: updatedDept.version,
                }
              : x
          )
        )
      } catch (error) {
        console.error("Không thể cập nhật trạng thái chuyên khoa", error)
        throw error
      }
    },
    deleteSpecialty: async (id) => {
      try {
        const existing = specialties.find((x) => x.id === id)
        const etag = `"${existing?.version ?? 0}"`
        await departmentsApi.delete(id, etag)
        removeStoredSpecialtyMeta(id)
        setSpecialties((p) => p.filter((x) => x.id !== id))
      } catch (error) {
        console.error("Không thể xóa chuyên khoa", error)
        throw error
      }
    },

    addDoctor: async (d) => {
      try {
        const created = await doctorsApi.create(toDoctorRequest(d))
        setDoctors((p) => {
          const next = [...p, mapDoctor(created, d)]
          updateDoctorCounts(next)
          return next
        })
      } catch (error) {
        console.error("Không thể tạo bác sĩ", error)
      }
    },
    updateDoctor: async (id, d) => {
      try {
        const updated = await doctorsApi.update(id, toDoctorRequest(d))
        setDoctors((p) => {
          const next = p.map((x) => (x.id === id ? mapDoctor(updated, { ...x, ...d }) : x))
          updateDoctorCounts(next)
          return next
        })
      } catch (error) {
        console.error("Không thể cập nhật bác sĩ", error)
      }
    },
    deleteDoctor: async (id) => {
      try {
        const { message } = await doctorsApi.delete(id)
        const isDeactivated = message.includes("Ngừng làm việc")

        if (isDeactivated) {
          // Soft delete: cập nhật trạng thái bác sĩ trong danh sách
          setDoctors((p) => {
            const next = p.map((x) => x.id === id ? { ...x, status: "inactive" as const } : x)
            updateDoctorCounts(next)
            return next
          })
        } else {
          // Hard delete: xóa bác sĩ khỏi danh sách
          setDoctors((p) => {
            const next = p.filter((x) => x.id !== id)
            updateDoctorCounts(next)
            return next
          })
        }

        return message
      } catch (error) {
        console.error("Không thể xóa bác sĩ", error)
        throw error
      }
    },
    setShift: async (doctorId, dateStr, shift) => {
      const existingEntry = schedule.find((e) => e.doctorId === doctorId)
      const scheduleId = existingEntry?.scheduleIds?.[dateStr]

      try {
        if (shift === "off") {
          if (scheduleId) {
            await schedulesApi.delete(scheduleId)
          }
        } else if (scheduleId) {
          await schedulesApi.update(scheduleId, toScheduleRequest(doctorId, dateStr, shift))
        } else {
          const created = await schedulesApi.create(toScheduleRequest(doctorId, dateStr, shift))
          setSchedule((p) => {
            const exists = p.find((e) => e.doctorId === doctorId)
            if (exists) {
              return p.map((e) =>
                e.doctorId === doctorId
                  ? {
                      ...e,
                      shifts: { ...e.shifts, [dateStr]: shift },
                      scheduleIds: { ...(e.scheduleIds ?? {}), [dateStr]: String(created.id) },
                    }
                  : e,
              )
            }
            return [{ doctorId, shifts: { [dateStr]: shift }, scheduleIds: { [dateStr]: String(created.id) } }, ...p]
          })
          return
        }

        setSchedule((p) => {
          const exists = p.find((e) => e.doctorId === doctorId)
          if (exists) {
            return p.map((e) => {
              if (e.doctorId !== doctorId) return e

              const nextShifts = { ...e.shifts, [dateStr]: shift }
              const nextScheduleIds = { ...(e.scheduleIds ?? {}) }
              if (shift === "off") {
                delete nextShifts[dateStr]
                delete nextScheduleIds[dateStr]
              }

              return { ...e, shifts: nextShifts, scheduleIds: nextScheduleIds }
            })
          }
          return shift === "off" ? p : [...p, { doctorId, shifts: { [dateStr]: shift } }]
        })
      } catch (error) {
        console.error("Không thể cập nhật lịch trực", error)
        throw error
      }
    },

    addMedicine: async (m) => {
      try {
        await medicinesApi.create(toMedicineRequest(m))
        await reloadMedicines()
      } catch (error) {
        console.error("Không thể tạo thuốc", error)
      }
    },
    updateMedicine: async (id, m) => {
      try {
        await medicinesApi.update(id, toMedicineRequest(m))
        await reloadMedicines()
      } catch (error) {
        console.error("Không thể cập nhật thuốc", error)
      }
    },
    deleteMedicine: async (id) => {
      try {
        await medicinesApi.delete(id)
        await reloadMedicines()
      } catch (error) {
        console.error("Không thể xóa thuốc", error)
      }
    },

    addIcd: async (c) => {
      try {
        const created = await diseasesApi.create(c)
        setIcdCodes((p) => [...p, mapIcdCode(created)])
      } catch (error) {
        console.error("Không thể tạo mã ICD", error)
      }
    },
    updateIcd: async (id, c) => {
      const current = icdCodes.find((x) => x.id === id)
      try {
        const updated = await diseasesApi.update(current?.code ?? id, c)
        setIcdCodes((p) => p.map((x) => (x.id === id ? mapIcdCode(updated) : x)))
      } catch (error) {
        console.error("Không thể cập nhật mã ICD", error)
      }
    },
    deleteIcd: async (id) => {
      const current = icdCodes.find((x) => x.id === id)
      try {
        await diseasesApi.delete(current?.code ?? id)
        setIcdCodes((p) => p.filter((x) => x.id !== id))
      } catch (error) {
        console.error("Không thể xóa mã ICD", error)
      }
    },

    addAppointment: async (a) => {
      try {
        const created = await appointmentsApi.create(getAppointmentRequest(a))
        setAppointments((p) => [...p, mapAppointment(created, patients, a)])
      } catch (error) {
        console.error("Không thể tạo lịch hẹn", error)
      }
    },
    updateAppointment: async (id, a) => {
      // 1. Cập nhật ngay vào local state và lưu patch vào localStorage
      setAppointments((p) => {
        const next = p.map((x) => (x.id === id ? { ...x, ...a } : x))
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("medicore_appointment_patches") || "{}"
            const patches = JSON.parse(raw)
            patches[id] = { ...patches[id], ...a, updatedAt: new Date().toISOString() }
            localStorage.setItem("medicore_appointment_patches", JSON.stringify(patches))
          } catch {}
        }
        return next
      })

      // 2. Cố gắng đồng bộ lên backend API
      try {
        let updated: any = null
        if (a.status === "CANCELLED") {
          const currentAppt = appointments.find((x) => x.id === id)
          const ver = (a as any).version ?? (currentAppt as any)?.version ?? 0
          updated = await appointmentsApi.cancel(id, (a as any).cancellationReason || "Bác sĩ hủy lịch khám", ver)
        } else if (a.status === "IN_PROGRESS") {
          updated = await appointmentsApi.startExam(id)
        } else {
          updated = await appointmentsApi.update(id, getAppointmentRequest(a))
        }
        if (updated) {
          setAppointments((p) => p.map((x) => (x.id === id ? mapAppointment(updated, patients, { ...x, ...a }) : x)))
        }
      } catch (error) {
        console.warn("API update appointment fallback sang lưu cục bộ:", error)
      }
    },
    deleteAppointment: async (id) => {
      try {
        await appointmentsApi.delete(id)
        setAppointments((p) => p.filter((x) => x.id !== id))
      } catch (error) {
        console.error("Không thể xóa lịch hẹn", error)
      }
    },

    addPatient: async (p) => {
      try {
        const created = await patientsApi.create(toPatientRequest(p))
        setPatients((prev) => [...prev, mapPatient(created, p)])
      } catch (error) {
        console.error("Không thể tạo bệnh nhân", error)
      }
    },
    updatePatient: async (id, p) => {
      // 1. Cập nhật ngay vào local state
      let hasDemographicChange = false
      setPatients((prev) =>
        prev.map((x) => {
          if (x.id === id) {
            hasDemographicChange = Boolean(
              (p.name && p.name !== x.name) ||
              (p.dateOfBirth && p.dateOfBirth !== x.dateOfBirth) ||
              (p.phone && p.phone !== x.phone) ||
              (p.email && p.email !== x.email) ||
              (p.address && p.address !== x.address)
            )
            return { ...x, ...p }
          }
          return x
        })
      )

      // 2. Chỉ gọi PATCH API nếu có thông tin nhân khẩu thay đổi thực sự
      try {
        if (hasDemographicChange) {
          const updated = await patientsApi.update(id, toPatientRequest(p))
          if (updated) {
            setPatients((prev) => prev.map((x) => (x.id === id ? mapPatient(updated, { ...x, ...p }) : x)))
          }
        }
      } catch (error) {
        console.warn("API update patient fallback sang lưu cục bộ:", error)
      }
    },
    deletePatient: async (id) => {
      try {
        await patientsApi.delete(id)
        setPatients((prev) => prev.filter((x) => x.id !== id))
      } catch (error) {
        console.error("Không thể xóa bệnh nhân", error)
      }
    },

    addPrescription: (p) => setPrescriptions((prev) => {
      const next = [...prev, { ...p, id: uid() }]
      if (typeof window !== "undefined") {
        try { localStorage.setItem("medicore_prescriptions", JSON.stringify(next)) } catch {}
      }
      return next
    }),
    updatePrescription: (id, p) => setPrescriptions((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...p } : x))
      if (typeof window !== "undefined") {
        try { localStorage.setItem("medicore_prescriptions", JSON.stringify(next)) } catch {}
      }
      return next
    }),
    deletePrescription: (id) => setPrescriptions((prev) => {
      const next = prev.filter((x) => x.id !== id)
      if (typeof window !== "undefined") {
        try { localStorage.setItem("medicore_prescriptions", JSON.stringify(next)) } catch {}
      }
      return next
    }),

    addExaminationRecord: (e) => setExaminationRecords((prev) => {
      const next = [...prev, { ...e, id: uid() }]
      if (typeof window !== "undefined") {
        try { localStorage.setItem("medicore_examination_records", JSON.stringify(next)) } catch {}
      }
      return next
    }),
    updateExaminationRecord: (id, e) => setExaminationRecords((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...e } : x))
      if (typeof window !== "undefined") {
        try { localStorage.setItem("medicore_examination_records", JSON.stringify(next)) } catch {}
      }
      return next
    }),
    deleteExaminationRecord: (id) => setExaminationRecords((prev) => {
      const next = prev.filter((x) => x.id !== id)
      if (typeof window !== "undefined") {
        try { localStorage.setItem("medicore_examination_records", JSON.stringify(next)) } catch {}
      }
      return next
    }),

    getWaitingPatients: (date) => {
      const targetDate = date ?? new Date().toISOString().split("T")[0]
      const waitingStatuses = new Set(["WAITING", "PENDING", "IN_PROGRESS", "CONFIRMED", "CHECKED_IN"])

      // Nếu là bác sĩ: chỉ hiển thị bệnh nhân có lịch hẹn của bác sĩ này
      if (user?.role === "DOCTOR") {
        const doctorIdStr = String(user?.doctorId || "")
        const doctorNameLower = (user?.name || "").trim().toLowerCase()

        const doctorWaitingAppointments = appointments.filter((a) => {
          if (!waitingStatuses.has(a.status)) return false
          if (a.appointmentDate !== targetDate) return false

          const idMatch = a.doctorId && (a.doctorId === doctorIdStr)
          const nameMatch = a.doctorName && doctorNameLower && (
            a.doctorName.toLowerCase().includes(doctorNameLower) ||
            doctorNameLower.includes(a.doctorName.toLowerCase())
          )
          return idMatch || nameMatch
        })

        const waitingPatientIds = new Set(doctorWaitingAppointments.map((a) => a.patientId))
        const waitingPatientCodes = new Set(doctorWaitingAppointments.map((a) => a.patientCode).filter(Boolean))

        return patients.filter(
          (p) => waitingPatientIds.has(p.id) || (p.patientCode && waitingPatientCodes.has(p.patientCode))
        )
      }
      // Admin: hiển thị tất cả bệnh nhân có lịch hẹn trong ngày hoặc status waiting
      const dayAppointments = appointments.filter(
        (a) => waitingStatuses.has(a.status) && a.appointmentDate === targetDate
      )
      const waitingPatientIds = new Set(dayAppointments.map((a) => a.patientId))
      return patients.filter((p) => waitingPatientIds.has(p.id) || p.status === "waiting")
    },
    getPatientPrescriptions: (patientId) => prescriptions.filter((p) => p.patientId === patientId),
    getPatientRecords: (patientId) => examinationRecords.filter((e) => e.patientId === patientId),

    ensureMedicinesLoaded,
    ensureIcdLoaded,
    ensurePatientsLoaded,
    ensureAppointmentsLoaded,
    loadWaitingAppointments,
    ensureScheduleLoaded,
    ensureDoctorsLoaded,
    ensureSpecialtiesLoaded,
    ensurePrescriptionsLoaded,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function SessionDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return <DataProvider key={session?.accountId ?? "anonymous"}>{children}</DataProvider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error("useData must be used within DataProvider")
  return ctx
}
