import { axiosClient } from '@/lib/axios-client';
import {
  AppointmentSlotRow,
  AppointmentSlotPageResponse,
  BookingAvailabilityPageResponse,
  BookingCatalog,
  CancelAppointmentRequest,
  CommandAcceptedResponse,
  CreateSlotHoldRequest,
  PatientAppointment,
  PatientAppointmentPageResponse,
  PaymentIntentRow,
  RescheduleAppointmentRequest,
  RescheduleAppointmentResponse,
  RescheduleTopUpRequest,
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

  async getBookingAvailability(params: {
    patientId: string;
    cursor?: string;
    limit?: number;
  }): Promise<BookingAvailabilityPageResponse> {
    const response = await axiosClient.get<BookingAvailabilityPageResponse>('/booking/availability', {
      params: {
        patientId: params.patientId,
        cursor: params.cursor,
        limit: params.limit || 100,
      },
    });
    return response.data;
  },

  async getRescheduleAvailability(
    appointmentId: string,
    params?: { cursor?: string; limit?: number }
  ): Promise<BookingAvailabilityPageResponse> {
    const response = await axiosClient.get<BookingAvailabilityPageResponse>(
      `/appointments/${appointmentId}/actions/reschedule-availability`,
      {
        params: {
          cursor: params?.cursor,
          limit: params?.limit || 100,
        },
      }
    );
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

  async createRescheduleSlotHold(
    appointmentId: string,
    slotId: string,
    { idempotencyKey }: IdempotentRequest
  ): Promise<SlotHoldRow> {
    const response = await axiosClient.post<SlotHoldRow>(
      `/appointments/${appointmentId}/actions/reschedule-slot-holds`,
      { slotId },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data;
  },

  async getSlotHold(holdId: string): Promise<SlotHoldRow> {
    const response = await axiosClient.get<SlotHoldRow>(`/slot-holds/${holdId}`);
    return response.data;
  },

  async cancelSlotHold(
    holdId: string,
    ifMatchVersion: number,
    { idempotencyKey }: IdempotentRequest
  ): Promise<SlotHoldRow> {
    const response = await axiosClient.delete<SlotHoldRow>(`/slot-holds/${holdId}`, {
      headers: {
        'If-Match': `"${ifMatchVersion}"`,
        'Idempotency-Key': idempotencyKey,
      },
    });
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

  async listAppointments(
    params?: { patientId?: string; cursor?: string; limit?: number } | string,
    maybeLimit?: number
  ): Promise<PatientAppointmentPageResponse> {
    let patientId: string | undefined;
    let cursor: string | undefined;
    let limit = 20;

    if (typeof params === 'string' || params === undefined) {
      cursor = params;
      if (maybeLimit !== undefined) limit = maybeLimit;
    } else {
      patientId = params.patientId;
      cursor = params.cursor;
      if (params.limit !== undefined) limit = params.limit;
    }

    const response = await axiosClient.get<PatientAppointmentPageResponse>('/appointments', {
      params: { patientId, cursor, limit },
    });
    return response.data;
  },

  async getAppointment(appointmentId: string): Promise<PatientAppointment> {
    const response = await axiosClient.get<PatientAppointment>(`/appointments/${appointmentId}`);
    return response.data;
  },

  async cancelAppointment(
    appointmentId: string,
    payload: CancelAppointmentRequest,
    ifMatchVersion: number,
    { idempotencyKey }: IdempotentRequest
  ): Promise<PatientAppointment> {
    const response = await axiosClient.post<PatientAppointment>(
      `/appointments/${appointmentId}/actions/cancel`,
      payload,
      {
        headers: {
          'If-Match': `"${ifMatchVersion}"`,
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data;
  },

  async createRescheduleTopUpIntent(
    appointmentId: string,
    payload: RescheduleTopUpRequest,
    ifMatchVersion: number,
    { idempotencyKey }: IdempotentRequest
  ): Promise<PaymentIntentRow> {
    const response = await axiosClient.post<PaymentIntentRow>(
      `/appointments/${appointmentId}/actions/reschedule-top-up`,
      payload,
      {
        headers: {
          'If-Match': `"${ifMatchVersion}"`,
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data;
  },

  async rescheduleAppointment(
    appointmentId: string,
    payload: RescheduleAppointmentRequest,
    ifMatchVersion: number,
    { idempotencyKey }: IdempotentRequest
  ): Promise<RescheduleAppointmentResponse> {
    const response = await axiosClient.post<RescheduleAppointmentResponse>(
      `/appointments/${appointmentId}/actions/reschedule`,
      payload,
      {
        headers: {
          'If-Match': `"${ifMatchVersion}"`,
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data;
  },
};
