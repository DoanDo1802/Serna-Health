import { axiosClient } from '@/lib/axios-client';
import {
  PatientView,
  PatientAccountLinkView,
  PatientIdentifierView,
  PatientCreateRequest,
  PatientUpdateRequest,
  PatientIdentifierAddRequest,
  PatientAccountLinkRequest,
  PageResponse,
} from '@/types/patient';

export const patientService = {
  /**
   * Lấy danh sách các liên kết hồ sơ bệnh nhân của tài khoản hiện tại.
   */
  async getMyAccountLinks(): Promise<PatientAccountLinkView[]> {
    const response = await axiosClient.get<PatientAccountLinkView[]>('/patients/account-links');
    return response.data;
  },

  /**
   * Tạo hồ sơ bệnh nhân chính chủ (OWN) cho tài khoản đang đăng nhập.
   */
  async createOwnPatient(payload: PatientCreateRequest): Promise<PatientView> {
    const response = await axiosClient.post<PatientView>('/patients/self', {
      ...payload,
      emergencyContact: payload.emergencyContact
        ? { ...payload.emergencyContact, version: 1 }
        : undefined,
    });
    return response.data;
  },

  /**
   * Tạo bản ghi bệnh nhân mới (dùng cho hồ sơ người thân phụ thuộc hoặc nhân viên y tế).
   */
  async createPatient(payload: PatientCreateRequest): Promise<PatientView> {
    const response = await axiosClient.post<PatientView>('/patients', {
      ...payload,
      emergencyContact: payload.emergencyContact
        ? { ...payload.emergencyContact, version: 1 }
        : undefined,
    });
    return response.data;
  },

  /**
   * Liên kết hồ sơ bệnh nhân với tài khoản người dùng theo mối quan hệ (CHILD, PARENT, SPOUSE...).
   */
  async linkPatientAccount(
    patientId: string,
    payload: PatientAccountLinkRequest
  ): Promise<PatientAccountLinkView> {
    const response = await axiosClient.post<PatientAccountLinkView>(
      `/patients/${patientId}/account-links`,
      payload
    );
    return response.data;
  },

  /**
   * Tạo hồ sơ người thân (phụ thuộc) và liên kết ngay vào tài khoản hiện tại.
   */
  async createDependentPatient(
    payload: PatientCreateRequest,
    relationship: string,
    accountId: string
  ): Promise<PatientView> {
    const patient = await this.createPatient(payload);
    await this.linkPatientAccount(patient.id, {
      accountId,
      relationship,
      verificationTier: 'PENDING',
      permissionScope: { version: 1 },
      validFrom: new Date().toISOString(),
    });
    return patient;
  },

  /**
   * Lấy chi tiết thông tin hồ sơ bệnh nhân theo ID.
   */
  async getPatient(patientId: string): Promise<PatientView> {
    const response = await axiosClient.get<PatientView>(`/patients/${patientId}`);
    return response.data;
  },

  /**
   * Cập nhật thông tin hồ sơ bệnh nhân (Yêu cầu If-Match version).
   */
  async updatePatient(
    patientId: string,
    payload: PatientUpdateRequest,
    version: number
  ): Promise<PatientView> {
    const response = await axiosClient.patch<PatientView>(
      `/patients/${patientId}`,
      {
        ...payload,
        emergencyContact: payload.emergencyContact
          ? { ...payload.emergencyContact, version: 1 }
          : undefined,
      },
      {
        headers: {
          'If-Match': `"${version}"`,
        },
      }
    );
    return response.data;
  },

  /**
   * Lấy danh sách giấy tờ tùy thân của bệnh nhân (CCCD / Hộ chiếu đã che số).
   */
  async listPatientIdentifiers(
    patientId: string,
    cursor?: string,
    limit: number = 20
  ): Promise<PageResponse<PatientIdentifierView>> {
    const response = await axiosClient.get<PageResponse<PatientIdentifierView>>(
      `/patients/${patientId}/identifiers`,
      {
        params: { cursor, limit },
      }
    );
    return response.data;
  },

  /**
   * Thêm giấy tờ tùy thân mới cho bệnh nhân (CCCD / Hộ chiếu).
   */
  async addPatientIdentifier(
    patientId: string,
    payload: PatientIdentifierAddRequest
  ): Promise<PatientIdentifierView> {
    const response = await axiosClient.post<PatientIdentifierView>(
      `/patients/${patientId}/identifiers`,
      payload
    );
    return response.data;
  },
};
