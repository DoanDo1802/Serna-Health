import { useBookingStore } from '../store/useBookingStore'
import { Doctor } from '../types'

export const useBooking = () => {
  const store = useBookingStore()

  const startBookingWithDoctor = (doctor: Doctor) => {
    store.setSelectedDoctor(doctor)
    store.setStep(2)
  }

  return {
    ...store,
    startBookingWithDoctor
  }
}
