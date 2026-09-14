export type SpecialtyExamFieldType = "text" | "textarea" | "number" | "select" | "checkbox"

export interface SpecialtyExamTemplateField {
  id: string
  label: string
  type: SpecialtyExamFieldType
  required?: boolean
  options?: string[]
}

export interface SpecialtyExamTemplate {
  fields: SpecialtyExamTemplateField[]
}

export interface Specialty {
  id: string
  name: string
  code: string
  description: string
  doctorCount: number
  status: "active" | "inactive"
  examTemplate?: SpecialtyExamTemplate
  version?: number
}

export interface Doctor {
  id: string
  name: string
  specialtyId: string
  title: string // Học vị: Bác sĩ, Thạc sĩ, Tiến sĩ, PGS, GS
  email: string
  phone: string
  experience: number // số năm kinh nghiệm
  status: "active" | "inactive"
  avatar?: string
  bio?: string
  doctorCode?: string
}

export type ShiftType = "morning" | "afternoon" | "full_day" | "night" | "off"

export interface ScheduleEntry {
  doctorId: string
  // key: date string YYYY-MM-DD
  shifts: Record<string, ShiftType>
  scheduleIds?: Record<string, string>
}

export interface ScheduleRequest {
  doctorId: number
  workDate: string
  timeSlot: string
}

export interface ScheduleResponse {
  id: number
  doctorId: number
  doctorName?: string
  doctorCode?: string
  workDate: string
  timeSlot: string
  isBooked?: boolean
}

export interface Medicine {
  id: string
  name: string
  code: string
  category: string // nhóm thuốc
  unit: string // đơn vị: viên, ống, chai
  price: number
  stock: number
  manufacturer: string
  status: "available" | "low" | "out"
}

export interface IcdCode {
  id: string
  code: string // mã ICD-10, vd A00
  name: string // tên bệnh
  category: string // chương
  description: string
}

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "IN_CONSULTATION" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "WAITING" | "IN_PROGRESS" | "DONE" | "FULFILLED"

export interface Appointment {
  id: string
  patientName: string
  patientId: string
  doctorId: string
  specialtyId: string
  appointmentDate: string // ISO date format
  icdCode?: string
  mainDiagnosis?: string
  status: AppointmentStatus
  timeSlot?: string
  symptomsInitial?: string
  patientCode?: string
  cancellationReason?: string
  doctorName?: string
  departmentName?: string
  roomName?: string
  serviceName?: string
  slotId?: string
  startAt?: string
  endAt?: string
}

export interface Patient {
  id: string
  name: string
  dateOfBirth: string // ISO date
  gender: "M" | "F"
  phone: string
  email: string
  address: string
  insuranceNumber?: string
  status: "waiting" | "in-examination" | "completed" | "no-show"
  createdAt: string
  patientCode?: string
}

export interface PrescriptionItem {
  medicineId: string
  medicineName: string
  quantity: number
  unit: string
  dosage: string // vd: 1 viên x 3 lần/ngày
  notes?: string
}

export interface Prescription {
  id: string
  appointmentId: string
  patientId: string
  doctorId: string
  prescriptionDate: string
  items: PrescriptionItem[]
  notes?: string
  status: "draft" | "issued" | "dispensed"
}

export interface ExaminationRecord {
  id: string
  appointmentId: string
  patientId: string
  doctorId: string
  examinationDate: string
  icdCode: string
  mainDiagnosis: string
  symptoms: string
  physicalExamination: string
  testResults?: string
  treatment: string
  followUpDate?: string
  notes?: string
  specialtyExamValues?: Record<string, unknown>
  specialtyExamTemplate?: SpecialtyExamTemplate
  createdAt: string
}


export interface SpecialtyRequest {
  name: string
  examTemplate?: SpecialtyExamTemplate
}

export interface SpecialtyResponse {
  id: number
  name: string
  doctorCount: number
  active?: boolean
  examTemplate?: SpecialtyExamTemplate
}

export interface DoctorRequest {
  name: string
  specialtyId: number
  title?: string
  bio?: string
  phone?: string
  experience?: number
  email?: string
  password?: string
  status?: Doctor["status"]
  avatarUrl?: string
  achievements?: string[]
}

export interface DoctorProfileRequest {
  name: string
  specialtyId: number
  title?: string
  bio?: string
  phone?: string
  experience?: number
  avatarUrl?: string
  achievements?: string[]
}

export interface DoctorResponse {
  id: number
  name: string
  specialtyId: number
  specialtyName?: string
  title?: string
  bio?: string
  email?: string
  phone?: string
  experience?: number
  status?: Doctor["status"]
  avatar?: string
  doctorCode?: string
  achievements?: string[]
}

export interface MedicineRequest {
  name: string
  unit: string
  category?: string
  price?: number
  stock?: number
  manufacturer?: string
}

export interface MedicineResponse {
  id: number
  name: string
  code?: string
  category?: string
  unit: string
  price?: number
  stock?: number
  manufacturer?: string
  status?: Medicine["status"]
}

export interface DiseaseRequest {
  code: string
  name: string
  category?: string
  description?: string
}

export interface DiseaseResponse {
  id: string
  code: string
  name: string
  category?: string
  description?: string
}

export interface TreatmentTemplateDetail {
  id?: number
  medicineId: number
  medicineName?: string
  unit?: string
  quantity: number
  dosage: string
}

export interface TreatmentTemplate {
  id: string
  icd10Code: string
  icd10Name?: string
  templateName: string
  description?: string
  details: TreatmentTemplateDetail[]
}

export interface TreatmentTemplateRequest {
  icd10Code: string
  templateName: string
  description?: string
  medicines: {
    medicineId: number
    quantity: number
    dosage: string
  }[]
}

export interface TreatmentTemplateResponse {
  id: number
  icd10Code: string
  icd10Name?: string
  templateName: string
  description?: string
  details: TreatmentTemplateDetail[]
}

export interface PatientRequest {
  name: string
  dateOfBirth: string
  gender: Patient["gender"]
  phone?: string
  address?: string
  email?: string
  insuranceNumber?: string
  status?: Patient["status"]
}

export interface PatientResponse {
  id: number
  name: string
  dateOfBirth: string
  gender: Patient["gender"]
  phone?: string
  email?: string
  address?: string
  insuranceNumber?: string
  status?: Patient["status"]
  patientCode?: string
  createdAt?: string
}

export interface AppointmentRequest {
  patientId: string
  doctorId: number
  appointmentDate: string
  timeSlot: string
  symptomsInitial?: string
  status?: AppointmentStatus
  cancellationReason?: string
}

export interface AppointmentResponse {
  id: number
  patientName: string
  patientId: string
  patientDbId?: number
  patientDateOfBirth?: string
  patientGender?: Patient["gender"]
  patientPhone?: string
  patientAddress?: string
  doctorId: number
  doctorName?: string
  specialtyId?: number
  appointmentDate: string
  timeSlot?: string
  symptomsInitial?: string
  status?: AppointmentStatus
  icdCode?: string
  mainDiagnosis?: string
  cancellationReason?: string
}

export interface MedicalRecordRequest {
  appointmentId: number
  symptoms?: string
  physicalExamination?: string
  testResults?: string
  mainDiagnosis?: string
  clinicalNote?: string
  historySummary?: string
  careAdvice?: string
  followUpDate?: string
  additionalData?: Record<string, unknown>
  diagnoses?: {
    icd10Code: string
    isPrimary?: boolean
  }[]
  medicines?: {
    medicineId: number
    quantity: number
    dosageInstruction: string
  }[]
}

export interface MedicalRecordResponse extends MedicalRecordRequest {
  id: number
  emrCode: string
  patientId?: string
  patientName?: string
  doctorId?: number
  doctorName?: string
  appointmentDate?: string
  timeSlot?: string
  diagnosisIcd10?: string
  diagnosisName?: string
  pdfUrl?: string | null
  pdfStoragePath?: string | null
  pdfGeneratedAt?: string | null
  createdAt?: string
}
