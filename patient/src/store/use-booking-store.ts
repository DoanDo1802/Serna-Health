import { create } from 'zustand';
import {
  AppointmentSlotRow,
  BookingDepartment,
  BookingPhase,
  BookingPractitioner,
  BookingPractitionerRole,
  BookingRoom,
  BookingService,
  EnrichedAppointmentSlot,
  AppointmentSlotSession,
  PaymentIntentRow,
  SlotHoldRow,
} from '@/types/scheduling';
import { schedulingService } from '@/services/scheduling-service';
import { usePatientStore } from '@/store/use-patient-store';
import { useAuthStore } from '@/store/use-auth-store';

export type BookingErrorType =
  | 'AUTH_REQUIRED'
  | 'ACCESS_DENIED'
  | 'NO_PATIENT'
  | 'SLOT_UNAVAILABLE'
  | 'HOLD_EXPIRED'
  | 'PAYMENT_FAILED'
  | 'RECONCILIATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface BookingErrorInfo {
  type: BookingErrorType;
  message: string;
  statusCode?: number;
}

interface BookingFilters {
  departmentId: string;
  serviceId: string;
  practitionerId: string;
  date: string;
  session: 'ALL' | AppointmentSlotSession;
}

interface BookingState {
  departments: BookingDepartment[];
  rooms: BookingRoom[];
  services: BookingService[];
  practitioners: BookingPractitioner[];
  practitionerRoles: Map<string, BookingPractitionerRole>;
  filters: BookingFilters;
  rawSlots: AppointmentSlotRow[];
  enrichedSlots: EnrichedAppointmentSlot[];
  selectedSlot: EnrichedAppointmentSlot | null;
  currentHold: SlotHoldRow | null;
  currentPaymentIntent: PaymentIntentRow | null;
  bookingPhase: BookingPhase;
  holdIdempotencyKey: string | null;
  paymentIdempotencyKey: string | null;
  mockPaymentIdempotencyKey: string | null;
  mockPaymentOutcome: 'SUCCEEDED' | 'FAILED' | null;
  isLoadingCatalogs: boolean;
  isLoadingSlots: boolean;
  isHolding: boolean;
  isCreatingPaymentIntent: boolean;
  isSimulatingPayment: boolean;
  error: string | null;
  errorInfo: BookingErrorInfo | null;
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
  createSlotHold: (slot: EnrichedAppointmentSlot) => Promise<boolean>;
  createPaymentIntent: () => Promise<boolean>;
  simulateMockPaymentOutcome: (outcome: 'SUCCEEDED' | 'FAILED') => Promise<boolean>;
  refreshBookingStatus: () => Promise<void>;
  resetBookingFlow: () => void;
  clearError: () => void;
}

const getTodayDateString = (): string => new Date().toISOString().split('T')[0];

const createIdempotencyKey = (): string => crypto.randomUUID();

const errorFrom = (err: unknown, fallback: string): BookingErrorInfo => {
  const value = err as { status?: number; code?: string; message?: string; response?: { headers?: Record<string, string> } };
  if (value.status === 401 || value.code === 'AUTH_REQUIRED') {
    return { type: 'AUTH_REQUIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', statusCode: 401 };
  }
  if (value.status === 403 || value.code === 'ACCESS_DENIED') {
    return { type: 'ACCESS_DENIED', message: 'Bạn không có quyền thực hiện thao tác này cho hồ sơ bệnh nhân.', statusCode: 403 };
  }
  if (value.status === 409) {
    return { type: 'SLOT_UNAVAILABLE', message: 'Ca khám hoặc phiên giữ chỗ không còn khả dụng. Vui lòng chọn lại.', statusCode: 409 };
  }
  if (value.status === 429) {
    return { type: 'RATE_LIMITED', message: 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.', statusCode: 429 };
  }
  if (!value.status || value.status >= 500) {
    return { type: 'NETWORK_ERROR', message: 'Không thể kết nối máy chủ. Kết quả có thể chưa xác định; vui lòng thử lại.', statusCode: value.status };
  }
  return { type: 'UNKNOWN', message: value.message || fallback, statusCode: value.status };
};

const paymentPhase = (intent: PaymentIntentRow): BookingPhase => {
  switch (intent.status) {
    case 'SUCCEEDED': return 'SUCCEEDED';
    case 'FAILED': return 'FAILED';
    case 'CANCELLED': return 'CANCELLED';
    case 'RECONCILIATION_REQUIRED': return 'RECONCILIATION_REQUIRED';
    case 'PROCESSING': return 'PAYMENT_PROCESSING';
    default: return 'AWAITING_PAYMENT';
  }
};

const bookingPhaseFromState = (hold: SlotHoldRow | null, intent: PaymentIntentRow | null): BookingPhase => {
  if (intent?.status === 'SUCCEEDED') {
    return hold?.status === 'CONSUMED' ? 'SUCCEEDED' : 'RECONCILIATION_REQUIRED';
  }
  if (intent) return paymentPhase(intent);
  if (hold?.status === 'ACTIVE') return 'HOLD_ACTIVE';
  return hold ? 'HOLD_EXPIRED' : 'IDLE';
};

export const useBookingStore = create<BookingState>((set, get) => ({
  departments: [], rooms: [], services: [], practitioners: [], practitionerRoles: new Map(),
  filters: { departmentId: 'ALL', serviceId: 'ALL', practitionerId: 'ALL', date: getTodayDateString(), session: 'ALL' },
  rawSlots: [], enrichedSlots: [], selectedSlot: null,
  currentHold: null, currentPaymentIntent: null, bookingPhase: 'IDLE',
  holdIdempotencyKey: null, paymentIdempotencyKey: null, mockPaymentIdempotencyKey: null, mockPaymentOutcome: null,
  isLoadingCatalogs: false, isLoadingSlots: false, isHolding: false, isCreatingPaymentIntent: false, isSimulatingPayment: false,
  error: null, errorInfo: null,

  clearError: () => set({ error: null, errorInfo: null }),

  initBooking: async () => {
    const authStore = useAuthStore.getState();
    if (authStore.isLoading) return;
    if (!authStore.isAuthenticated) {
      const errorInfo = { type: 'AUTH_REQUIRED' as const, message: 'Vui lòng đăng nhập để tra cứu lịch khám.', statusCode: 401 };
      set({ errorInfo, error: errorInfo.message, isLoadingCatalogs: false, isLoadingSlots: false });
      return;
    }
    const patientStore = usePatientStore.getState();
    let patientId = patientStore.activePatientId;
    if (!patientId) patientId = (await patientStore.loadAccountLinks())[0]?.patientId || null;
    if (!patientId) {
      const errorInfo = { type: 'NO_PATIENT' as const, message: 'Cần tạo hoặc chọn hồ sơ bệnh nhân trước khi đặt lịch.' };
      set({ errorInfo, error: errorInfo.message, isLoadingCatalogs: false, isLoadingSlots: false });
      return;
    }
    await get().loadCatalogs();
    if (!get().errorInfo) await get().loadSlots();
  },

  loadCatalogs: async () => {
    const patientId = usePatientStore.getState().activePatientId;
    if (!patientId) {
      const errorInfo = { type: 'NO_PATIENT' as const, message: 'Chưa chọn hồ sơ bệnh nhân.' };
      set({ errorInfo, error: errorInfo.message, isLoadingCatalogs: false });
      return;
    }
    set({ isLoadingCatalogs: true, error: null, errorInfo: null, departments: [], rooms: [], services: [], practitioners: [], practitionerRoles: new Map(), rawSlots: [], enrichedSlots: [], selectedSlot: null });
    try {
      const catalog = await schedulingService.getBookingCatalog(patientId);
      set({ departments: catalog.departments, rooms: catalog.rooms, services: catalog.services, practitioners: catalog.practitioners, practitionerRoles: new Map(catalog.practitionerRoles.map((role) => [role.id, role])), isLoadingCatalogs: false });
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể tải dữ liệu đặt khám.');
      set({ errorInfo, error: errorInfo.message, isLoadingCatalogs: false });
    }
  },

  loadSlots: async () => {
    set({ isLoadingSlots: true, error: null });
    try {
      const response = await schedulingService.searchAppointmentSlots();
      const rawSlots = (response.items || []).filter((slot) => slot.status === 'ACTIVE');
      const { departments, rooms, services, practitioners, practitionerRoles, filters } = get();
      const deptMap = new Map(departments.map((department) => [department.id, department.name]));
      const roomMap = new Map(rooms.map((room) => [room.id, room.name]));
      const serviceMap = new Map(services.map((service) => [service.id, service.name]));
      const practitionerMap = new Map<string, { name: string; title: string }>();
      practitionerRoles.forEach((role, roleId) => {
        const practitioner = practitioners.find((item) => item.id === role.practitionerId);
        if (practitioner) practitionerMap.set(roleId, { name: practitioner.fullName.startsWith('BS') ? practitioner.fullName : `BS ${practitioner.fullName}`, title: role.roleCode || 'Bác sĩ chuyên khoa' });
      });
      const enriched = rawSlots.map<EnrichedAppointmentSlot>((slot) => {
        const service = services.find((item) => item.id === slot.serviceId);
        const start = new Date(slot.startAt);
        const end = new Date(slot.endAt);
        const formatTime = (value: Date) => value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        return {
          ...slot,
          departmentName: deptMap.get(slot.departmentId) || 'Khoa Khám Bệnh',
          roomName: roomMap.get(slot.roomId) || 'Phòng Khám',
          serviceName: serviceMap.get(slot.serviceId) || 'Khám Tổng Quát',
          practitionerName: practitionerMap.get(slot.practitionerRoleId)?.name || 'Bác sĩ phụ trách ca',
          practitionerTitle: practitionerMap.get(slot.practitionerRoleId)?.title || 'Bác sĩ chuyên khoa',
          priceAmount: service?.priceAmount ?? 0,
          priceCurrency: service?.priceCurrency ?? 'VND',
          checkInStart: formatTime(new Date(start.getTime() - 60 * 60 * 1000)),
          checkInEnd: formatTime(new Date(end.getTime() - 30 * 60 * 1000)),
        };
      }).filter((slot) => {
        if (filters.departmentId !== 'ALL' && slot.departmentId !== filters.departmentId) return false;
        if (filters.serviceId !== 'ALL' && slot.serviceId !== filters.serviceId) return false;
        if (filters.practitionerId !== 'ALL' && practitionerRoles.get(slot.practitionerRoleId)?.practitionerId !== filters.practitionerId) return false;
        if (filters.date && slot.startAt.split('T')[0] !== filters.date) return false;
        return filters.session === 'ALL' || slot.session === filters.session;
      });
      set({ rawSlots, enrichedSlots: enriched, isLoadingSlots: false, error: null, errorInfo: null });
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể tải danh sách ca khám.');
      set({ errorInfo, error: errorInfo.message, isLoadingSlots: false });
    }
  },

  setDepartmentFilter: (departmentId) => { set((state) => ({ filters: { ...state.filters, departmentId } })); void get().loadSlots(); },
  setServiceFilter: (serviceId) => { set((state) => ({ filters: { ...state.filters, serviceId } })); void get().loadSlots(); },
  setPractitionerFilter: (practitionerId) => { set((state) => ({ filters: { ...state.filters, practitionerId } })); void get().loadSlots(); },
  setDateFilter: (date) => { set((state) => ({ filters: { ...state.filters, date } })); void get().loadSlots(); },
  setSessionFilter: (session) => { set((state) => ({ filters: { ...state.filters, session } })); void get().loadSlots(); },
  resetFilters: () => { set({ filters: { departmentId: 'ALL', serviceId: 'ALL', practitionerId: 'ALL', date: '', session: 'ALL' } }); void get().loadSlots(); },
  selectSlot: (selectedSlot) => set({ selectedSlot }),

  createSlotHold: async (slot) => {
    const patientId = usePatientStore.getState().activePatientId;
    if (!patientId) {
      const errorInfo = { type: 'NO_PATIENT' as const, message: 'Chưa chọn hồ sơ bệnh nhân.' };
      set({ errorInfo, error: errorInfo.message });
      return false;
    }
    const key = get().holdIdempotencyKey || createIdempotencyKey();
    set({ isHolding: true, bookingPhase: 'CREATING_HOLD', holdIdempotencyKey: key, error: null, errorInfo: null, selectedSlot: slot });
    try {
      const hold = await schedulingService.createSlotHold({ slotId: slot.id, patientId }, { idempotencyKey: key });
      const phase: BookingPhase = hold.status === 'ACTIVE' ? 'HOLD_ACTIVE' : 'HOLD_EXPIRED';
      set({ currentHold: hold, isHolding: false, bookingPhase: phase });
      return hold.status === 'ACTIVE';
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể giữ chỗ ca khám.');
      set({ errorInfo, error: errorInfo.message, isHolding: false, bookingPhase: 'IDLE' });
      if (errorInfo.type === 'SLOT_UNAVAILABLE') {
        set({ selectedSlot: null });
        void get().loadSlots();
      }
      return false;
    }
  },

  createPaymentIntent: async () => {
    const hold = get().currentHold;
    if (!hold || hold.status !== 'ACTIVE') {
      const errorInfo = { type: 'HOLD_EXPIRED' as const, message: 'Phiên giữ chỗ đã hết hiệu lực. Vui lòng chọn lại ca khám.' };
      set({ errorInfo, error: errorInfo.message, bookingPhase: 'HOLD_EXPIRED' });
      return false;
    }
    const key = get().paymentIdempotencyKey || createIdempotencyKey();
    set({ isCreatingPaymentIntent: true, bookingPhase: 'CREATING_PAYMENT_INTENT', paymentIdempotencyKey: key, error: null, errorInfo: null });
    try {
      const intent = await schedulingService.createPaymentIntent(hold.id, { idempotencyKey: key });
      set({ currentPaymentIntent: intent, isCreatingPaymentIntent: false, bookingPhase: paymentPhase(intent), mockPaymentIdempotencyKey: null, mockPaymentOutcome: null });
      if (intent.status === 'SUCCEEDED') await get().refreshBookingStatus();
      return true;
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể tạo yêu cầu thanh toán.');
      set({ errorInfo, error: errorInfo.message, isCreatingPaymentIntent: false, bookingPhase: 'HOLD_ACTIVE' });
      return false;
    }
  },

  simulateMockPaymentOutcome: async (outcome) => {
    const { currentHold, currentPaymentIntent, mockPaymentIdempotencyKey, mockPaymentOutcome } = get();
    if (!currentHold || currentHold.status !== 'ACTIVE' || !currentPaymentIntent
      || currentPaymentIntent.provider !== 'MOCK_PAY'
      || currentPaymentIntent.status !== 'REQUIRES_PAYMENT_METHOD') {
      const errorInfo = { type: 'SLOT_UNAVAILABLE' as const, message: 'Yêu cầu thanh toán mock không còn hiệu lực. Vui lòng cập nhật trạng thái đặt lịch.' };
      set({ errorInfo, error: errorInfo.message });
      return false;
    }

    const key = mockPaymentOutcome === outcome && mockPaymentIdempotencyKey
      ? mockPaymentIdempotencyKey
      : createIdempotencyKey();
    set({
      isSimulatingPayment: true,
      bookingPhase: 'PAYMENT_PROCESSING',
      mockPaymentIdempotencyKey: key,
      mockPaymentOutcome: outcome,
      error: null,
      errorInfo: null,
    });
    try {
      await schedulingService.simulateMockPaymentOutcome(currentPaymentIntent.id, { outcome }, { idempotencyKey: key });
      set({ isSimulatingPayment: false });
      await get().refreshBookingStatus();
      return true;
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể mô phỏng thanh toán. Kiểm tra quyền payment.mock.simulate và cấu hình mock của máy chủ.');
      set({
        errorInfo,
        error: errorInfo.message,
        isSimulatingPayment: false,
        bookingPhase: paymentPhase(currentPaymentIntent),
      });
      return false;
    }
  },

  refreshBookingStatus: async () => {
    const { currentHold, currentPaymentIntent } = get();
    try {
      const [hold, intent] = await Promise.all([
        currentHold ? schedulingService.getSlotHold(currentHold.id) : Promise.resolve(null),
        currentPaymentIntent ? schedulingService.getPaymentIntent(currentPaymentIntent.id) : Promise.resolve(null),
      ]);
      set({
        currentHold: hold,
        currentPaymentIntent: intent,
        bookingPhase: bookingPhaseFromState(hold, intent),
      });
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể cập nhật trạng thái đặt lịch.');
      set({ errorInfo, error: errorInfo.message });
    }
  },

  resetBookingFlow: () => set({ selectedSlot: null, currentHold: null, currentPaymentIntent: null, bookingPhase: 'IDLE', holdIdempotencyKey: null, paymentIdempotencyKey: null, mockPaymentIdempotencyKey: null, mockPaymentOutcome: null, isHolding: false, isCreatingPaymentIntent: false, isSimulatingPayment: false, error: null, errorInfo: null }),
}));
