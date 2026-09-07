import { axiosClient } from '@/lib/axios-client';
import {
  AppointmentRow,
  AppointmentPageResponse,
  AppointmentSlotRow,
  AppointmentSlotPageResponse,
  BookingCatalog,
  CommandAcceptedResponse,
  CreateSlotHoldRequest,
  PaymentIntentRow,
  SimulateMockPaymentOutcomeRequest,
  SlotHoldRow,
} from '@/types/scheduling';

interface IdempotentRequest {
  idempotencyKey: string;
}

export const schedulingService = {
  async searchAppointmentSlots(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<AppointmentSlotPageResponse> {
    const response = await axiosClient.get<AppointmentSlotPageResponse>('/appointment-slots', {
      params: {
        cursor: params?.cursor,
        limit: params?.limit || 100,
      },
    });
    return response.data;
  },

  async getAppointmentSlot(slotId: string): Promise<AppointmentSlotRow> {
    const response = await axiosClient.get<AppointmentSlotRow>(`/appointment-slots/${slotId}`);
    return response.data;
  },

  async getBookingCatalog(patientId: string): Promise<BookingCatalog> {
    const response = await axiosClient.get<BookingCatalog>('/booking/catalog', {
      params: { patientId },
    });
    return response.data;
  },

  async createSlotHold(
    payload: CreateSlotHoldRequest,
    { idempotencyKey }: IdempotentRequest
  ): Promise<SlotHoldRow> {
    const response = await axiosClient.post<SlotHoldRow>('/slot-holds', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return response.data;
  },

  async getSlotHold(holdId: string): Promise<SlotHoldRow> {
    const response = await axiosClient.get<SlotHoldRow>(`/slot-holds/${holdId}`);
    return response.data;
  },

  async createPaymentIntent(
    holdId: string,
    { idempotencyKey }: IdempotentRequest
  ): Promise<PaymentIntentRow> {
    const response = await axiosClient.post<PaymentIntentRow>(
      `/slot-holds/${holdId}/payment-intents`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data;
  },

  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentRow> {
    const response = await axiosClient.get<PaymentIntentRow>(`/payment-intents/${paymentIntentId}`);
    return response.data;
  },

  async simulateMockPaymentOutcome(
    paymentIntentId: string,
    payload: SimulateMockPaymentOutcomeRequest,
    { idempotencyKey }: IdempotentRequest
  ): Promise<CommandAcceptedResponse> {
    const response = await axiosClient.post<CommandAcceptedResponse>(
      `/mock-payment-intents/${paymentIntentId}/actions/simulate`,
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data;
  },

  async listAppointments(cursor?: string, limit = 20): Promise<AppointmentPageResponse> {
    const response = await axiosClient.get<AppointmentPageResponse>('/appointments', {
      params: { cursor, limit },
    });
    return response.data;
  },

  async getAppointment(appointmentId: string): Promise<AppointmentRow> {
    const response = await axiosClient.get<AppointmentRow>(`/appointments/${appointmentId}`);
    return response.data;
  },
};
