import { create } from 'zustand'
import { Doctor, AppointmentSlot, SlotHold, Appointment } from '../types'

interface BookingState {
  currentStep: 1 | 2 | 3 | 4
  selectedDoctor: Doctor | null
  selectedDate: string
  selectedSlot: AppointmentSlot | null
  selectedPatientId: string
  activeHold: SlotHold | null
  createdAppointment: Appointment | null
  setStep: (step: 1 | 2 | 3 | 4) => void
  setSelectedDoctor: (doctor: Doctor | null) => void
  setSelectedDate: (date: string) => void
  setSelectedSlot: (slot: AppointmentSlot | null) => void
  setSelectedPatientId: (patientId: string) => void
  setActiveHold: (hold: SlotHold | null) => void
  setCreatedAppointment: (appointment: Appointment | null) => void
  resetBooking: () => void
}

export const useBookingStore = create<BookingState>((set) => ({
  currentStep: 1,
  selectedDoctor: null,
  selectedDate: '2026-08-15',
  selectedSlot: null,
  selectedPatientId: 'dep-01',
  activeHold: null,
  createdAppointment: null,
  setStep: (currentStep) => set({ currentStep }),
  setSelectedDoctor: (selectedDoctor) => set({ selectedDoctor }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setSelectedSlot: (selectedSlot) => set({ selectedSlot }),
  setSelectedPatientId: (selectedPatientId) => set({ selectedPatientId }),
  setActiveHold: (activeHold) => set({ activeHold }),
  setCreatedAppointment: (createdAppointment) => set({ createdAppointment }),
  resetBooking: () =>
    set({
      currentStep: 1,
      selectedDoctor: null,
      selectedSlot: null,
      activeHold: null,
      createdAppointment: null
    })
}))
