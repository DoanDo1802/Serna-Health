import { apiClient } from '@/lib/axios'
import { AppointmentSlot, SlotHold, Appointment } from '@/types'
import { generateIdempotencyKey } from '@/utils'
import { APP_CONFIG } from '@/constants'

export const SchedulingService = {
  async getAvailability(date: string, departmentId?: string): Promise<AppointmentSlot[]> {
    const res = await apiClient.get('/scheduling/slots/availability', {
      params: { date, departmentId }
    })
    return res.data
  },

  async createSlotHold(slotId: string, patientId: string): Promise<SlotHold> {
    const res = await apiClient.post(
      '/scheduling/slot-holds',
      { slotId, patientId },
      {
        headers: {
          [APP_CONFIG.idempotencyHeaderName]: generateIdempotencyKey('HOLD')
        }
      }
    )
    return res.data
  },

  async cancelSlotHold(holdId: string, version: number): Promise<void> {
    await apiClient.post(
      `/scheduling/slot-holds/${holdId}/actions/cancel`,
      {},
      {
        headers: {
          'If-Match': `"${version}"`
        }
      }
    )
  },

  async listMyAppointments(): Promise<Appointment[]> {
    const res = await apiClient.get('/scheduling/appointments/my-appointments')
    return res.data
  }
}
