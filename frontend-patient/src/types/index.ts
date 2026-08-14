export interface UserProfile {
  id: string
  fullName: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  address: string
  nationalId?: string
  nationalIdStatus?: 'SELF_DECLARED' | 'STAFF_RECORDED' | 'MANUALLY_VERIFIED' | 'ELECTRONICALLY_VERIFIED'
  avatarUrl?: string
}

export interface DependentLink {
  id: string
  patientId: string
  fullName: string
  dateOfBirth: string
  relationship: 'OWN' | 'CHILD' | 'PARENT' | 'SPOUSE'
  relationshipLabel: string
  tier: 'Tier 0' | 'Tier 1' | 'Tier 2'
  tierCode: 0 | 1 | 2
}

export type Dependent = DependentLink

export interface Doctor {
  id: string
  name: string
  title: string
  specialty: string
  department: string
  rating: number
  reviewCount: number
  experienceYears: number
  price: number
  avatar: string
  bio: string
  availableToday: boolean
}

export interface AppointmentSlot {
  id: string
  doctorId: string
  date: string
  sessionName: string
  timeRange: string
  capacity: number
  bookedCount: number
  available: boolean
  price: number
}

export type Slot = AppointmentSlot

export interface SlotHold {
  id: string
  slotId: string
  patientId: string
  expiresAt: string
  depositAmount: number
  currency: string
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'RELEASED'
  version: number
}

export interface Appointment {
  id: string
  code: string
  doctor: Doctor
  patientName: string
  patientId: string
  date: string
  timeSlot: string
  roomName: string
  departmentName: string
  depositAmount: number
  status: 'CONFIRMED' | 'FULFILLED' | 'CANCELLED_BY_PATIENT' | 'CANCELLED_BY_HOSPITAL' | 'RESCHEDULED' | 'NO_SHOW'
  statusLabel: string
  queueNumber?: number
  currentCallingNumber?: number
  createdAt: string
  clinicalSummary?: {
    diagnosis: string
    note: string
    doctorName: string
    prescriptionItems: Array<{ medication: string; dosage: string; quantity: string }>
  }
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  timestamp: string
  type: 'APPOINTMENT' | 'PAYMENT' | 'SYSTEM'
  read: boolean
}

export interface ApiResponse<T> {
  data: T
  message?: string
  status: number
  timestamp: string
}
