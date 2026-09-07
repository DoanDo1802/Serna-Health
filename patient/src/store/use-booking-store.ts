import { create } from 'zustand';
import {
  AppointmentSlotRow,
  BookingDepartment,
  BookingPractitioner,
  BookingPractitionerRole,
  BookingRoom,
  BookingService,
  EnrichedAppointmentSlot,
  AppointmentSlotSession,
} from '@/types/scheduling';
import { schedulingService } from '@/services/scheduling-service';
import { usePatientStore } from '@/store/use-patient-store';
import { useAuthStore } from '@/store/use-auth-store';

export type BookingErrorType =
  | 'AUTH_REQUIRED'
  | 'ACCESS_DENIED'
  | 'NO_PATIENT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface BookingErrorInfo {
  type: BookingErrorType;
  message: string;
  statusCode?: number;
}

interface BookingFilters {
  departmentId: string; // 'ALL' or UUID
  serviceId: string; // 'ALL' or UUID
  practitionerId: string; // 'ALL' or UUID
  date: string; // YYYY-MM-DD or ''
  session: 'ALL' | AppointmentSlotSession;
}

interface BookingState {
  // Catalogs
  departments: BookingDepartment[];
  rooms: BookingRoom[];
  services: BookingService[];
  practitioners: BookingPractitioner[];
  practitionerRoles: Map<string, BookingPractitionerRole>;

  // Filters
  filters: BookingFilters;

  // Slots
  rawSlots: AppointmentSlotRow[];
  enrichedSlots: EnrichedAppointmentSlot[];
  selectedSlot: EnrichedAppointmentSlot | null;

  // Loading & Error States
  isLoadingCatalogs: boolean;
  isLoadingSlots: boolean;
  isHolding: boolean;
  error: string | null;
  errorInfo: BookingErrorInfo | null;

  // Actions
  initBooking: () => Promise<void>;
  loadCatalogs: () => Promise<void>;
  loadSlots: () => Promise<void>;
  setDepartmentFilter: (departmentId: string) => void;
  setServiceFilter: (serviceId: string) => void;
  setPractitionerFilter: (practitionerId: string) => void;
  setDateFilter: (date: string) => void;
  setSessionFilter: (session: 'ALL' | AppointmentSlotSession) => void;
  resetFilters: () => void;
  selectSlot: (slot: EnrichedAppointmentSlot | null) => void;
  clearError: () => void;
}

const getTodayDateString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const useBookingStore = create<BookingState>((set, get) => ({
  departments: [],
  rooms: [],
  services: [],
  practitioners: [],
  practitionerRoles: new Map(),

  filters: {
    departmentId: 'ALL',
    serviceId: 'ALL',
    practitionerId: 'ALL',
    date: getTodayDateString(),
    session: 'ALL',
  },

  rawSlots: [],
  enrichedSlots: [],
  selectedSlot: null,

  isLoadingCatalogs: false,
  isLoadingSlots: false,
  isHolding: false,
  error: null,
  errorInfo: null,

  clearError: () => set({ error: null, errorInfo: null }),

  initBooking: async () => {
    // Gate booking initialization until authentication is verified
    const authStore = useAuthStore.getState();
    if (authStore.isLoading) {
      return;
    }
    if (!authStore.isAuthenticated) {
      const errInfo: BookingErrorInfo = {
        type: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập để tra cứu lịch khám.',
        statusCode: 401,
      };
      set({
        errorInfo: errInfo,
        error: errInfo.message,
        isLoadingCatalogs: false,
        isLoadingSlots: false,
      });
      return;
    }

    const patientStore = usePatientStore.getState();
    let patientId = patientStore.activePatientId;
    if (!patientId) {
      const links = await patientStore.loadAccountLinks();
      patientId = links[0]?.patientId || null;
    }

    if (!patientId) {
      const errInfo: BookingErrorInfo = {
        type: 'NO_PATIENT',
        message: 'Cần tạo hoặc chọn hồ sơ bệnh nhân trước khi đặt lịch.',
      };
      set({
        errorInfo: errInfo,
        error: errInfo.message,
        isLoadingCatalogs: false,
        isLoadingSlots: false,
      });
      return;
    }

    await get().loadCatalogs();
    if (!get().errorInfo) {
      await get().loadSlots();
    }
  },

  loadCatalogs: async () => {
    const patientId = usePatientStore.getState().activePatientId;
    if (!patientId) {
      const errInfo: BookingErrorInfo = {
        type: 'NO_PATIENT',
        message: 'Chưa chọn hồ sơ bệnh nhân.',
      };
      set({ errorInfo: errInfo, error: errInfo.message, isLoadingCatalogs: false });
      return;
    }

    set({
      isLoadingCatalogs: true,
      error: null,
      errorInfo: null,
      departments: [],
      rooms: [],
      services: [],
      practitioners: [],
      practitionerRoles: new Map(),
      rawSlots: [],
      enrichedSlots: [],
      selectedSlot: null,
    });
    try {
      const catalog = await schedulingService.getBookingCatalog(patientId);
      set({
        departments: catalog.departments,
        rooms: catalog.rooms,
        services: catalog.services,
        practitioners: catalog.practitioners,
        practitionerRoles: new Map(catalog.practitionerRoles.map((role) => [role.id, role])),
        isLoadingCatalogs: false,
        error: null,
        errorInfo: null,
      });
    } catch (err: unknown) {
      const customErr = err as { status?: number; code?: string; message?: string };
      const status = customErr?.status;
      const code = customErr?.code;

      let errorInfo: BookingErrorInfo;
      if (status === 401 || code === 'AUTH_REQUIRED') {
        errorInfo = {
          type: 'AUTH_REQUIRED',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          statusCode: 401,
        };
      } else if (status === 403 || code === 'ACCESS_DENIED') {
        errorInfo = {
          type: 'ACCESS_DENIED',
          message: 'Bạn không có quyền truy cập thông tin đặt lịch cho hồ sơ này hoặc hồ sơ chưa được xác thực.',
          statusCode: 403,
        };
      } else if (!status || status >= 500) {
        errorInfo = {
          type: 'NETWORK_ERROR',
          message: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.',
          statusCode: status,
        };
      } else {
        errorInfo = {
          type: 'UNKNOWN',
          message: customErr?.message || 'Không thể tải dữ liệu đặt khám.',
          statusCode: status,
        };
      }

      set({
        errorInfo,
        error: errorInfo.message,
        isLoadingCatalogs: false,
      });
    }
  },

  loadSlots: async () => {
    set({ isLoadingSlots: true, error: null });
    try {
      const response = await schedulingService.searchAppointmentSlots();
      const rawSlots = (response.items || []).filter((s) => s.status === 'ACTIVE');

      const {
        departments,
        rooms,
        services,
        practitioners,
        practitionerRoles,
        filters,
      } = get();

      // Department Map
      const deptMap = new Map(departments.map((d) => [d.id, d.name]));
      // Room Map
      const roomMap = new Map(rooms.map((room) => [room.id, room.name]));
      // Service Map
      const serviceMap = new Map(services.map((s) => [s.id, s.name]));
      // Practitioner Map (via role)
      const pracNameMap = new Map<string, { name: string; title: string }>();

      practitionerRoles.forEach((role, roleId) => {
        const prac = practitioners.find((p) => p.id === role.practitionerId);
        if (prac) {
          pracNameMap.set(roleId, {
            name: prac.fullName.startsWith('BS') ? prac.fullName : `BS ${prac.fullName}`,
            title: role.roleCode || 'Bác sĩ chuyên khoa',
          });
        }
      });

      // Enrich all active slots
      const enriched: EnrichedAppointmentSlot[] = rawSlots.map((slot) => {
        const deptName = deptMap.get(slot.departmentId) || 'Khoa Khám Bệnh';
        const roomName = roomMap.get(slot.roomId) || 'Phòng Khám';
        const serviceName = serviceMap.get(slot.serviceId) || 'Khám Tổng Quát';

        const pracInfo = pracNameMap.get(slot.practitionerRoleId) || {
          name: 'Bác sĩ phụ trách ca',
          title: 'Bác sĩ chuyên khoa',
        };

        const service = services.find((item) => item.id === slot.serviceId);
        const priceAmount = service?.priceAmount ?? 0;
        const priceCurrency = service?.priceCurrency ?? 'VND';

        // Calculate check-in window (typically 60 mins before start until 30 mins before end)
        const startDate = new Date(slot.startAt);
        const endDate = new Date(slot.endAt);

        const checkInStartDate = new Date(startDate.getTime() - 60 * 60 * 1000);
        const checkInEndDate = new Date(endDate.getTime() - 30 * 60 * 1000);

        const formatTime = (d: Date) =>
          d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

        const checkInStart = formatTime(checkInStartDate);
        const checkInEnd = formatTime(checkInEndDate);

        return {
          ...slot,
          departmentName: deptName,
          roomName,
          serviceName,
          practitionerName: pracInfo.name,
          practitionerTitle: pracInfo.title,
          priceAmount,
          priceCurrency,
          checkInStart,
          checkInEnd,
          remainingCapacity: slot.capacity, // Capacity from active slot
        };
      });

      // Apply in-memory filters
      const filtered = enriched.filter((slot) => {
        // Department filter
        if (filters.departmentId !== 'ALL' && slot.departmentId !== filters.departmentId) {
          return false;
        }

        // Service filter
        if (filters.serviceId !== 'ALL' && slot.serviceId !== filters.serviceId) {
          return false;
        }

        // Practitioner filter
        if (filters.practitionerId !== 'ALL') {
          const role = practitionerRoles.get(slot.practitionerRoleId);
          if (!role || role.practitionerId !== filters.practitionerId) {
            return false;
          }
        }

        // Date filter
        if (filters.date) {
          const slotDate = slot.startAt.split('T')[0];
          if (slotDate !== filters.date) {
            return false;
          }
        }

        // Session filter
        if (filters.session !== 'ALL' && slot.session !== filters.session) {
          return false;
        }

        return true;
      });

      set({
        rawSlots,
        enrichedSlots: filtered,
        isLoadingSlots: false,
        error: null,
        errorInfo: null,
      });
    } catch (err: unknown) {
      const customErr = err as { status?: number; code?: string; message?: string };
      const status = customErr?.status;
      const code = customErr?.code;

      let errorInfo: BookingErrorInfo;
      if (status === 401 || code === 'AUTH_REQUIRED') {
        errorInfo = {
          type: 'AUTH_REQUIRED',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          statusCode: 401,
        };
      } else if (status === 403 || code === 'ACCESS_DENIED') {
        errorInfo = {
          type: 'ACCESS_DENIED',
          message: 'Bạn không có quyền truy cập danh sách ca khám.',
          statusCode: 403,
        };
      } else {
        errorInfo = {
          type: 'NETWORK_ERROR',
          message: 'Không thể tải danh sách ca khám khả dụng. Vui lòng thử lại.',
          statusCode: status,
        };
      }

      set({
        errorInfo,
        error: errorInfo.message,
        isLoadingSlots: false,
      });
    }
  },

  setDepartmentFilter: (departmentId: string) => {
    set((state) => ({
      filters: { ...state.filters, departmentId },
    }));
    get().loadSlots();
  },

  setServiceFilter: (serviceId: string) => {
    set((state) => ({
      filters: { ...state.filters, serviceId },
    }));
    get().loadSlots();
  },

  setPractitionerFilter: (practitionerId: string) => {
    set((state) => ({
      filters: { ...state.filters, practitionerId },
    }));
    get().loadSlots();
  },

  setDateFilter: (date: string) => {
    set((state) => ({
      filters: { ...state.filters, date },
    }));
    get().loadSlots();
  },

  setSessionFilter: (session: 'ALL' | AppointmentSlotSession) => {
    set((state) => ({
      filters: { ...state.filters, session },
    }));
    get().loadSlots();
  },

  resetFilters: () => {
    set({
      filters: {
        departmentId: 'ALL',
        serviceId: 'ALL',
        practitionerId: 'ALL',
        date: '',
        session: 'ALL',
      },
    });
    get().loadSlots();
  },

  selectSlot: (slot: EnrichedAppointmentSlot | null) => {
    set({ selectedSlot: slot });
  },
}));
