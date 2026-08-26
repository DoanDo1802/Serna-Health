import { create } from 'zustand';
import {
  PatientView,
  PatientAccountLinkView,
  PatientIdentifierView,
  PatientCreateRequest,
  PatientUpdateRequest,
  PatientIdentifierAddRequest,
} from '@/types/patient';
import { patientService } from '@/services/patient-service';

interface PatientState {
  accountLinks: PatientAccountLinkView[];
  activePatientId: string | null;
  activePatient: PatientView | null;
  identifiers: PatientIdentifierView[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  loadAccountLinks: () => Promise<PatientAccountLinkView[]>;
  selectPatient: (patientId: string) => Promise<void>;
  loadPatient: (patientId: string) => Promise<PatientView | null>;
  createOwnProfile: (data: PatientCreateRequest) => Promise<PatientView | null>;
  createDependentProfile: (data: PatientCreateRequest, relationship: string) => Promise<PatientView | null>;
  deleteDependentProfile: (patientId: string) => Promise<boolean>;
  updateProfile: (data: PatientUpdateRequest) => Promise<PatientView | null>;
  loadIdentifiers: (patientId: string) => Promise<void>;
  addIdentifier: (data: PatientIdentifierAddRequest) => Promise<boolean>;
  clearError: () => void;
}

export const usePatientStore = create<PatientState>((set, get) => ({
  accountLinks: [],
  activePatientId: null,
  activePatient: null,
  identifiers: [],
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  loadAccountLinks: async () => {
    set({ isLoading: true, error: null });
    try {
      const links = await patientService.getMyAccountLinks();
      set({ accountLinks: links });

      if (links.length > 0) {
        // Ưu tiên chọn hồ sơ chính chủ 'OWN', nếu không chọn hồ sơ đầu tiên
        const ownLink = links.find((l) => l.relationship === 'OWN') || links[0];
        const patientId = ownLink.patientId;
        set({ activePatientId: patientId });
        await get().selectPatient(patientId);
      } else {
        set({ activePatientId: null, activePatient: null, identifiers: [], isLoading: false });
      }
      return links;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách hồ sơ.';
      set({ error: msg, isLoading: false });
      return [];
    }
  },

  selectPatient: async (patientId: string) => {
    set({ activePatientId: patientId, isLoading: true, error: null });
    try {
      const patient = await patientService.getPatient(patientId);
      const identifiersData = await patientService.listPatientIdentifiers(patientId);
      set({
        activePatient: patient,
        identifiers: identifiersData.items || [],
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải thông tin hồ sơ bệnh nhân.';
      set({ error: msg, isLoading: false });
    }
  },

  loadPatient: async (patientId: string) => {
    try {
      const patient = await patientService.getPatient(patientId);
      set({ activePatient: patient });
      return patient;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi tải hồ sơ.';
      set({ error: msg });
      return null;
    }
  },

  createOwnProfile: async (data: PatientCreateRequest) => {
    set({ isSaving: true, error: null });
    try {
      const patient = await patientService.createOwnPatient(data);
      set({ isSaving: false, activePatient: patient, activePatientId: patient.id });
      await get().loadAccountLinks();
      await get().selectPatient(patient.id);
      return patient;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tạo hồ sơ bệnh nhân thất bại.';
      set({ error: msg, isSaving: false });
      return null;
    }
  },

  createDependentProfile: async (data: PatientCreateRequest, relationship: string) => {
    set({ isSaving: true, error: null });
    try {
      const links = get().accountLinks;
      let accountId = links[0]?.accountId;
      if (!accountId) {
        const { authService } = await import('@/services/auth-service');
        const currentSession = await authService.getCurrentSession();
        accountId = currentSession.accountId;
      }

      const patient = await patientService.createDependentPatient(data, relationship, accountId);
      set({ isSaving: false, activePatient: patient, activePatientId: patient.id });
      await get().loadAccountLinks();
      await get().selectPatient(patient.id);
      return patient;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tạo hồ sơ người thân thất bại.';
      set({ error: msg, isSaving: false });
      return null;
    }
  },

  deleteDependentProfile: async (patientId: string) => {
    set({ isSaving: true, error: null });
    try {
      const currentLinks = get().accountLinks.filter((l) => l.patientId !== patientId);
      set({ accountLinks: currentLinks });

      const ownLink = currentLinks.find((l) => l.relationship === 'OWN') || currentLinks[0];
      if (ownLink) {
        await get().selectPatient(ownLink.patientId);
      } else {
        set({ activePatientId: null, activePatient: null, identifiers: [] });
      }
      set({ isSaving: false });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Xóa hồ sơ người thân thất bại.';
      set({ error: msg, isSaving: false });
      return false;
    }
  },

  updateProfile: async (data: PatientUpdateRequest) => {
    const { activePatientId, activePatient } = get();
    if (!activePatientId || !activePatient) {
      set({ error: 'Không tìm thấy hồ sơ đang chọn.' });
      return null;
    }

    set({ isSaving: true, error: null });
    try {
      const updated = await patientService.updatePatient(
        activePatientId,
        data,
        activePatient.version
      );
      set({ activePatient: updated, isSaving: false, error: null });
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cập nhật hồ sơ thất bại.';
      set({ error: msg, isSaving: false });
      return null;
    }
  },

  loadIdentifiers: async (patientId: string) => {
    try {
      const res = await patientService.listPatientIdentifiers(patientId);
      set({ identifiers: res.items || [] });
    } catch (err: unknown) {
      console.error('Lỗi tải danh sách giấy tờ:', err);
    }
  },

  addIdentifier: async (data: PatientIdentifierAddRequest) => {
    const { activePatientId } = get();
    if (!activePatientId) return false;

    set({ isSaving: true, error: null });
    try {
      await patientService.addPatientIdentifier(activePatientId, data);
      await get().loadIdentifiers(activePatientId);
      set({ isSaving: false });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Thêm giấy tờ thất bại.';
      set({ error: msg, isSaving: false });
      return false;
    }
  },
}));
