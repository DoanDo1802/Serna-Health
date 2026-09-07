import { axiosClient } from '@/lib/axios-client';
import {
  DepartmentView,
  RoomView,
  ServiceView,
  ServicePriceView,
  PractitionerView,
  PractitionerRoleView,
  CatalogPageResponse,
} from '@/types/catalog';

export const catalogService = {
  /**
   * Lấy danh sách các khoa viện.
   */
  async getDepartments(limit: number = 100): Promise<DepartmentView[]> {
    try {
      const response = await axiosClient.get<CatalogPageResponse<DepartmentView>>('/departments', {
        params: { limit },
      });
      return response.data.items || [];
    } catch (err: unknown) {
      console.warn('Không thể tải danh sách khoa viện (chưa đăng nhập hoặc không có quyền):', err);
      return [];
    }
  },

  /**
   * Lấy danh sách các phòng khám.
   */
  async getRooms(limit: number = 100): Promise<RoomView[]> {
    try {
      const response = await axiosClient.get<CatalogPageResponse<RoomView>>('/rooms', {
        params: { limit },
      });
      return response.data.items || [];
    } catch (err: unknown) {
      console.warn('Không thể tải danh sách phòng khám:', err);
      return [];
    }
  },

  /**
   * Lấy danh sách dịch vụ y tế.
   */
  async getServices(limit: number = 100): Promise<ServiceView[]> {
    try {
      const response = await axiosClient.get<CatalogPageResponse<ServiceView>>('/services', {
        params: { limit },
      });
      return response.data.items || [];
    } catch (err: unknown) {
      console.warn('Không thể tải danh sách dịch vụ:', err);
      return [];
    }
  },

  /**
   * Lấy bảng giá của dịch vụ.
   */
  async getServicePrices(serviceId: string): Promise<ServicePriceView[]> {
    try {
      const response = await axiosClient.get<CatalogPageResponse<ServicePriceView>>(
        `/services/${serviceId}/prices`
      );
      return response.data.items || [];
    } catch (err: unknown) {
      console.warn(`Không thể tải bảng giá dịch vụ ${serviceId}:`, err);
      return [];
    }
  },

  /**
   * Lấy danh sách bác sĩ/nhân viên y tế.
   */
  async getPractitioners(limit: number = 100): Promise<PractitionerView[]> {
    try {
      const response = await axiosClient.get<CatalogPageResponse<PractitionerView>>(
        '/practitioners',
        {
          params: { limit },
        }
      );
      return response.data.items || [];
    } catch (err: unknown) {
      console.warn('Không thể tải danh sách bác sĩ:', err);
      return [];
    }
  },

  /**
   * Lấy chi tiết vai trò bác sĩ theo ID (PractitionerRole).
   */
  async getPractitionerRole(roleId: string): Promise<PractitionerRoleView | null> {
    try {
      const response = await axiosClient.get<PractitionerRoleView>(`/practitioner-roles/${roleId}`);
      return response.data;
    } catch (err: unknown) {
      console.warn(`Không thể tải vai trò bác sĩ ${roleId}:`, err);
      return null;
    }
  },

  /**
   * Lấy danh sách vai trò của một bác sĩ.
   */
  async getPractitionerRoles(practitionerId: string): Promise<PractitionerRoleView[]> {
    try {
      const response = await axiosClient.get<CatalogPageResponse<PractitionerRoleView>>(
        `/practitioners/${practitionerId}/roles`
      );
      return response.data.items || [];
    } catch (err: unknown) {
      console.warn(`Không thể tải danh sách vai trò của bác sĩ ${practitionerId}:`, err);
      return [];
    }
  },
};
