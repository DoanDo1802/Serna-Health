import { axiosClient } from '@/lib/axios-client';
import {
  AppointmentSlotRow,
  AppointmentSlotPageResponse,
  BookingCatalog,
  SlotHoldRow,
  CreateSlotHoldRequest,
} from '@/types/scheduling';

export const schedulingService = {
  /**
   * Tìm kiếm danh sách ca khám (AppointmentSlot).
   */
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

  /**
   * Lấy chi tiết thông tin ca khám theo ID.
   */
  async getAppointmentSlot(slotId: string): Promise<AppointmentSlotRow> {
    const response = await axiosClient.get<AppointmentSlotRow>(`/appointment-slots/${slotId}`);
    return response.data;
  },

  /**
   * Lấy danh mục tối thiểu cho ca khám còn có thể đặt của một hồ sơ bệnh nhân.
   */
  async getBookingCatalog(patientId: string): Promise<BookingCatalog> {
    const response = await axiosClient.get<BookingCatalog>('/booking/catalog', {
      params: { patientId },
    });
    return response.data;
  },

  /**
   * Tạo yêu cầu giữ chỗ ca khám (SlotHold - R1-05/R1-06).
   */
  async createSlotHold(payload: CreateSlotHoldRequest): Promise<SlotHoldRow> {
    const response = await axiosClient.post<SlotHoldRow>('/slot-holds', payload);
    return response.data;
  },

  /**
   * Lấy thông tin chi tiết phiên giữ chỗ.
   */
  async getSlotHold(holdId: string): Promise<SlotHoldRow> {
    const response = await axiosClient.get<SlotHoldRow>(`/slot-holds/${holdId}`);
    return response.data;
  },
};
