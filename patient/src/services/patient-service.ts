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

// In-memory cache for patient details & identifiers to prevent waterfall re-fetches
const patientCache = new Map<string, { data: PatientView; timestamp: number }>();
const identifiersCache = new Map<string, { data: PageResponse<PatientIdentifierView>; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const patientService = {
  clearCache(patientId?: string) {
    if (patientId) {
      patientCache.delete(patientId);
      identifiersCache.delete(patientId);
    } else {
      patientCache.clear();
      identifiersCache.clear();
    }
  },

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
    patientCache.set(response.data.id, { data: response.data, timestamp: Date.now() });
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
    patientCache.set(response.data.id, { data: response.data, timestamp: Date.now() });
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
      verificationTier: 'REPRESENTATION_VERIFIED',
      permissionScope: {
        version: 1,
        'patient.read': true,
        'slot_hold.create': true,
        'slot_hold.read': true,
        'slot_hold.cancel': true,
        'appointment.reschedule': true,
        'appointment.cancel': true,
      },
      validFrom: new Date().toISOString(),
    });
    patientCache.set(patient.id, { data: patient, timestamp: Date.now() });
    return patient;
  },

  /**
   * Lấy chi tiết thông tin hồ sơ bệnh nhân theo ID (có bộ đệm RAM để tải trang tức thì).
   */
  async getPatient(patientId: string, bypassCache = false): Promise<PatientView> {
    const cached = patientCache.get(patientId);
    if (!bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    const response = await axiosClient.get<PatientView>(`/patients/${patientId}`);
    patientCache.set(patientId, { data: response.data, timestamp: Date.now() });
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
    patientCache.set(patientId, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  /**
   * Lấy danh sách giấy tờ tùy thân của bệnh nhân (CCCD / Hộ chiếu đã che số).
   */
  async listPatientIdentifiers(
    patientId: string,
    cursor?: string,
    limit: number = 20,
    bypassCache = false
  ): Promise<PageResponse<PatientIdentifierView>> {
    const cacheKey = `${patientId}:${cursor || ''}:${limit}`;
    const cached = identifiersCache.get(cacheKey);
    if (!bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    const response = await axiosClient.get<PageResponse<PatientIdentifierView>>(
      `/patients/${patientId}/identifiers`,
      {
        params: { cursor, limit },
      }
    );
    identifiersCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
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
    // Invalidate identifiers cache for this patient
    for (const key of identifiersCache.keys()) {
      if (key.startsWith(`${patientId}:`)) {
        identifiersCache.delete(key);
      }
    }
    return response.data;
  },
};
