import { create } from 'zustand';
import {
  AppointmentSlotRow,
  BookingAvailabilitySlot,
  BookingHoldAssignment,
  BookingSessionAvailability,
  BookingDepartment,
  BookingPhase,
  BookingPractitioner,
  BookingPractitionerRole,
  BookingRoom,
  BookingService,
  EnrichedAppointmentSlot,
  AppointmentSlotSession,
  PaymentIntentRow,
  RescheduleAppointmentResponse,
  RescheduleContext,
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
  | 'RESCHEDULE_WINDOW_CLOSED'
  | 'CONCURRENCY_STALE'
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
  rawSlots: (AppointmentSlotRow | BookingAvailabilitySlot)[];
  enrichedSlots: EnrichedAppointmentSlot[];
  bookingSessions: BookingSessionAvailability[];
  selectedBookingSession: BookingSessionAvailability | null;
  selectedSlot: EnrichedAppointmentSlot | null;
  currentHold: SlotHoldRow | null;
  currentHoldAssignment: BookingHoldAssignment | null;
  currentPaymentIntent: PaymentIntentRow | null;
  bookingPhase: BookingPhase;
  holdIdempotencyKey: string | null;
  paymentIdempotencyKey: string | null;
  mockPaymentIdempotencyKey: string | null;
  mockPaymentOutcome: 'SUCCEEDED' | 'FAILED' | null;
  rescheduleContext: RescheduleContext | null;
  rescheduleReason: string;
  rescheduleSubmitIdempotencyKey: string | null;
  rescheduleResult: RescheduleAppointmentResponse | null;
  isSubmittingReschedule: boolean;
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
  setDateFilter: (date: string) => void;
  setSessionFilter: (session: 'ALL' | AppointmentSlotSession) => void;
  resetFilters: () => void;
  selectSlot: (slot: EnrichedAppointmentSlot | null) => void;
  selectBookingSession: (session: BookingSessionAvailability | null) => void;
  createSlotHold: (slot: EnrichedAppointmentSlot | BookingSessionAvailability) => Promise<boolean>;
  createPaymentIntent: () => Promise<boolean>;
  simulateMockPaymentOutcome: (outcome: 'SUCCEEDED' | 'FAILED') => Promise<boolean>;
  startRescheduleMode: (context: RescheduleContext) => Promise<boolean>;
  cancelRescheduleMode: () => Promise<boolean>;
  setRescheduleReason: (reason: string) => void;
  createRescheduleTopUp: () => Promise<boolean>;
  submitReschedule: () => Promise<RescheduleAppointmentResponse | null>;
  refreshBookingStatus: () => Promise<void>;
  releaseCurrentHold: (refreshSlots?: boolean) => Promise<boolean>;
  resetBookingFlow: () => void;
  resetBookingState: () => Promise<boolean>;
  discardBookingState: () => void;
  clearError: () => void;
}

const toLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateString = (): string => toLocalDateString(new Date());

const createIdempotencyKey = (): string => crypto.randomUUID();

const errorFrom = (err: unknown, fallback: string): BookingErrorInfo => {
  const value = err as { status?: number; code?: string; message?: string; response?: { headers?: Record<string, string> } };
  if (value.status === 401 || value.code === 'AUTH_REQUIRED') {
    return { type: 'AUTH_REQUIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', statusCode: 401 };
  }
  if (value.status === 403 || value.code === 'ACCESS_DENIED') {
    return { type: 'ACCESS_DENIED', message: 'Bạn không có quyền thực hiện thao tác này cho hồ sơ bệnh nhân.', statusCode: 403 };
  }
  if (value.code === 'SELF_SERVICE_RESCHEDULE_WINDOW_CLOSED') {
    return { type: 'RESCHEDULE_WINDOW_CLOSED', message: 'Đã quá thời hạn tự đổi lịch (trước giờ khám 24 giờ). Vui lòng liên hệ quầy tiếp đón để được hỗ trợ.', statusCode: 409 };
  }
  if (value.status === 412 || value.code === 'CONCURRENCY_STALE_VERSION') {
    return { type: 'CONCURRENCY_STALE', message: 'Thông tin lịch khám đã thay đổi. Đã tải lại dữ liệu; vui lòng kiểm tra và thử lại.', statusCode: 412 };
  }
  if (value.code === 'IDEMPOTENCY_KEY_REUSED') {
    return { type: 'CONCURRENCY_STALE', message: 'Thao tác trước đã thay đổi. Vui lòng chọn lại ca khám hoặc thử lại.', statusCode: 409 };
  }
  if (value.code === 'PAYMENT_TOP_UP_REQUIRED' || value.code === 'PAYMENT_TOP_UP_INVALID' || value.code === 'PAYMENT_TOP_UP_NOT_REQUIRED') {
    return { type: 'PAYMENT_FAILED', message: 'Trạng thái thanh toán chênh lệch đã thay đổi. Vui lòng kiểm tra lại trước khi xác nhận đổi lịch.', statusCode: 409 };
  }
  if (value.code === 'APPOINTMENT_PATIENT_DUPLICATE_SLOT' || value.code === 'APPOINTMENT_PATIENT_TIME_OVERLAP') {
    return { type: 'SLOT_UNAVAILABLE', message: 'Ca khám mới bị trùng lịch hiện có. Vui lòng chọn ca khác.', statusCode: 409 };
  }
  if (value.status === 409) {
    if (value.message === 'Slot is fully booked') {
      return { type: 'SLOT_UNAVAILABLE', message: 'Ca khám này đã hết chỗ tiếp nhận. Vui lòng chọn ca khác.', statusCode: 409 };
    }
    if (value.message === 'Slot is unavailable') {
      return { type: 'SLOT_UNAVAILABLE', message: 'Ca khám đã qua thời gian tiếp nhận hoặc tạm ngưng. Vui lòng chọn ca khác.', statusCode: 409 };
    }
    const msg = value.message && value.message !== 'Domain state conflict'
      ? value.message
      : 'Ca khám hoặc phiên giữ chỗ không còn khả dụng. Vui lòng chọn lại.';
    return { type: 'SLOT_UNAVAILABLE', message: msg, statusCode: 409 };
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

const projectSlots = (
  state: Pick<BookingState, 'departments' | 'rooms' | 'services' | 'practitioners' | 'practitionerRoles' | 'filters'>,
  rawSlots: (AppointmentSlotRow | BookingAvailabilitySlot)[]
): EnrichedAppointmentSlot[] => {
  const deptMap = new Map(state.departments.map((department) => [department.id, department.name]));
  const roomMap = new Map(state.rooms.map((room) => [room.id, room.name]));
  const serviceMap = new Map(state.services.map((service) => [service.id, service.name]));
  const practitionerMap = new Map<string, { name: string; title: string }>();
  state.practitionerRoles.forEach((role, roleId) => {
    const practitioner = state.practitioners.find((item) => item.id === role.practitionerId);
    if (practitioner) practitionerMap.set(roleId, {
      name: practitioner.fullName.startsWith('BS') ? practitioner.fullName : `BS ${practitioner.fullName}`,
      title: role.roleCode || 'Bác sĩ chuyên khoa',
    });
  });

  return rawSlots.map<EnrichedAppointmentSlot>((slot) => {
    const service = state.services.find((item) => item.id === slot.serviceId);
    const start = new Date(slot.startAt);
    const end = new Date(slot.endAt);
    const formatTime = (value: Date) => value.toLocaleTimeString('vi-VN', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const isPast = start.getTime() <= Date.now();
    const canCreateHold = isPast ? false : ('canCreateHold' in slot ? slot.canCreateHold : true);
    const disabledReason = isPast
      ? 'SLOT_PAST'
      : ('disabledReason' in slot ? slot.disabledReason : undefined);

    return {
      id: slot.id, version: slot.version, practitionerRoleId: slot.practitionerRoleId,
      departmentId: slot.departmentId, roomId: slot.roomId, serviceId: slot.serviceId,
      session: slot.session, startAt: slot.startAt, endAt: slot.endAt,
      capacity: 'capacity' in slot ? slot.capacity : 1,
      status: 'status' in slot ? slot.status : 'ACTIVE',
      createdAt: 'createdAt' in slot ? slot.createdAt : '',
      updatedAt: 'updatedAt' in slot ? slot.updatedAt : '',
      departmentName: deptMap.get(slot.departmentId) || 'Khoa Khám Bệnh',
      roomName: roomMap.get(slot.roomId) || 'Phòng Khám',
      serviceName: serviceMap.get(slot.serviceId) || 'Khám Tổng Quát',
      practitionerName: practitionerMap.get(slot.practitionerRoleId)?.name || 'Bác sĩ phụ trách ca',
      practitionerTitle: practitionerMap.get(slot.practitionerRoleId)?.title || 'Bác sĩ chuyên khoa',
      priceAmount: service?.priceAmount ?? 0, priceCurrency: service?.priceCurrency ?? 'VND',
      checkInStart: formatTime(new Date(start.getTime() - 60 * 60 * 1000)),
      checkInEnd: formatTime(new Date(end.getTime() - 30 * 60 * 1000)),
      canCreateHold,
      disabledReason,
    };
  }).filter((slot) => {
    if (state.filters.departmentId !== 'ALL' && slot.departmentId !== state.filters.departmentId) return false;
    if (state.filters.serviceId !== 'ALL' && slot.serviceId !== state.filters.serviceId) return false;
    if (state.filters.date) {
      const slotLocalDate = toLocalDateString(new Date(slot.startAt));
      if (slotLocalDate !== state.filters.date) return false;
    }
    return state.filters.session === 'ALL' || slot.session === state.filters.session;
  });
};

export const useBookingStore = create<BookingState>((set, get) => ({
  departments: [], rooms: [], services: [], practitioners: [], practitionerRoles: new Map(),
  filters: { departmentId: 'ALL', serviceId: 'ALL', date: getTodayDateString(), session: 'ALL' },
  rawSlots: [], enrichedSlots: [], bookingSessions: [], selectedBookingSession: null, selectedSlot: null,
  currentHold: null, currentHoldAssignment: null, currentPaymentIntent: null, bookingPhase: 'IDLE',
  holdIdempotencyKey: null, paymentIdempotencyKey: null, mockPaymentIdempotencyKey: null, mockPaymentOutcome: null,
  rescheduleContext: null, rescheduleReason: '', rescheduleSubmitIdempotencyKey: null, rescheduleResult: null, isSubmittingReschedule: false,
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

    // Fetch catalog and slots in parallel to halve load time.
    set({ isLoadingCatalogs: true, isLoadingSlots: true, error: null, errorInfo: null, selectedSlot: null });

    const rescheduleAppointmentId = get().rescheduleContext?.originalAppointment?.id;
    try {
      const filters = get().filters;
      const [catalog, availabilityResponse] = await Promise.all([
        rescheduleAppointmentId
          ? schedulingService.getRescheduleCatalog(rescheduleAppointmentId)
          : schedulingService.getBookingCatalog(patientId),
        rescheduleAppointmentId
          ? schedulingService.getRescheduleAvailability(rescheduleAppointmentId, { limit: 100 })
          : schedulingService.getBookingAvailability({
              patientId,
              departmentId: filters.departmentId === 'ALL' ? undefined : filters.departmentId,
              serviceId: filters.serviceId === 'ALL' ? undefined : filters.serviceId,
              date: filters.date || undefined,
              session: filters.session === 'ALL' ? undefined : filters.session,
              limit: 100,
            }),
      ]);
      const isRescheduleCatalog = (cat: typeof catalog): cat is import('@/types/scheduling').RescheduleCatalog => 'rooms' in cat;
      const rooms = isRescheduleCatalog(catalog) ? catalog.rooms : [];
      const practitioners = isRescheduleCatalog(catalog) ? catalog.practitioners : [];
      const practitionerRoles = isRescheduleCatalog(catalog)
        ? new Map(catalog.practitionerRoles.map((role) => [role.id, role]))
        : new Map<string, BookingPractitionerRole>();
      const next = {
        ...get(),
        departments: catalog.departments,
        rooms,
        services: catalog.services,
        practitioners,
        practitionerRoles,
      };
      const rawSlots: (AppointmentSlotRow | BookingAvailabilitySlot)[] = rescheduleAppointmentId
        ? availabilityResponse.items as BookingAvailabilitySlot[]
        : [];
      set({
        departments: next.departments,
        rooms: next.rooms,
        services: next.services,
        practitioners: next.practitioners,
        practitionerRoles: next.practitionerRoles,
        rawSlots,
        enrichedSlots: rescheduleAppointmentId ? projectSlots(next, rawSlots as (AppointmentSlotRow | BookingAvailabilitySlot)[]) : [],
        bookingSessions: rescheduleAppointmentId ? [] : availabilityResponse.items as BookingSessionAvailability[],
        selectedBookingSession: null,
        isLoadingCatalogs: false,
        isLoadingSlots: false,
        error: null,
        errorInfo: null,
      });
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể tải dữ liệu đặt khám.');
      set({ errorInfo, error: errorInfo.message, isLoadingCatalogs: false, isLoadingSlots: false });
    }
  },

  loadCatalogs: async () => {
    const patientId = usePatientStore.getState().activePatientId;
    if (!patientId) {
      const errorInfo = { type: 'NO_PATIENT' as const, message: 'Chưa chọn hồ sơ bệnh nhân.' };
      set({ errorInfo, error: errorInfo.message, isLoadingCatalogs: false });
      return;
    }
    set({ isLoadingCatalogs: true, error: null, errorInfo: null, departments: [], rooms: [], services: [], practitioners: [], practitionerRoles: new Map(), rawSlots: [], enrichedSlots: [], bookingSessions: [], selectedBookingSession: null, selectedSlot: null });
    try {
      const rescheduleAppointmentId = get().rescheduleContext?.originalAppointment?.id;
      if (rescheduleAppointmentId) {
        const catalog = await schedulingService.getRescheduleCatalog(rescheduleAppointmentId);
        set({
          departments: catalog.departments,
          rooms: catalog.rooms,
          services: catalog.services,
          practitioners: catalog.practitioners,
          practitionerRoles: new Map(catalog.practitionerRoles.map((role) => [role.id, role])),
          isLoadingCatalogs: false,
        });
      } else {
        const catalog = await schedulingService.getBookingCatalog(patientId);
        set({
          departments: catalog.departments,
          rooms: [],
          services: catalog.services,
          practitioners: [],
          practitionerRoles: new Map(),
          isLoadingCatalogs: false,
        });
      }
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể tải dữ liệu đặt khám.');
      set({ errorInfo, error: errorInfo.message, isLoadingCatalogs: false });
    }
  },

  loadSlots: async () => {
    if (get().departments.length === 0 && !get().isLoadingCatalogs) {
      void get().loadCatalogs();
    }
    set({ isLoadingSlots: true, error: null, errorInfo: null });
    try {
      const patientId = usePatientStore.getState().activePatientId;
      if (!patientId) throw new Error('Chưa chọn hồ sơ bệnh nhân.');
      const rescheduleAppointmentId = get().rescheduleContext?.originalAppointment?.id;
      const filters = get().filters;
      if (rescheduleAppointmentId) {
        const response = await schedulingService.getRescheduleAvailability(rescheduleAppointmentId, { limit: 100 });
        const rawSlots = response.items || [];
        set({
          rawSlots,
          enrichedSlots: projectSlots(get(), rawSlots),
          bookingSessions: [],
          selectedBookingSession: null,
          isLoadingSlots: false,
          error: null,
          errorInfo: null,
        });
      } else {
        const response = await schedulingService.getBookingAvailability({
          patientId,
          departmentId: filters.departmentId === 'ALL' ? undefined : filters.departmentId,
          serviceId: filters.serviceId === 'ALL' ? undefined : filters.serviceId,
          date: filters.date || undefined,
          session: filters.session === 'ALL' ? undefined : filters.session,
          limit: 100,
        });
        set({
          rawSlots: [],
          enrichedSlots: [],
          bookingSessions: response.items || [],
          selectedBookingSession: null,
          isLoadingSlots: false,
          error: null,
          errorInfo: null,
        });
      }
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể tải danh sách ca khám.');
      set({ errorInfo, error: errorInfo.message, isLoadingSlots: false });
    }
  },

  setDepartmentFilter: (departmentId) => {
    const services = get().services;
    const currentServiceId = get().filters.serviceId;
    let nextServiceId = currentServiceId;
    if (departmentId !== 'ALL' && currentServiceId !== 'ALL') {
      const currentService = services.find((s) => s.id === currentServiceId);
      if (currentService && currentService.departmentId && currentService.departmentId !== departmentId) {
        nextServiceId = 'ALL';
      }
    }
    set((state) => ({ filters: { ...state.filters, departmentId, serviceId: nextServiceId } }));
    void get().loadSlots();
  },
  setServiceFilter: (serviceId) => {
    const services = get().services;
    let nextDepartmentId = get().filters.departmentId;
    if (serviceId !== 'ALL') {
      const selectedService = services.find((s) => s.id === serviceId);
      if (selectedService?.departmentId) {
        nextDepartmentId = selectedService.departmentId;
      }
    }
    set((state) => ({ filters: { ...state.filters, serviceId, departmentId: nextDepartmentId } }));
    void get().loadSlots();
  },
  setDateFilter: (date) => {
    set((state) => ({ filters: { ...state.filters, date } }));
    void get().loadSlots();
  },
  setSessionFilter: (session) => {
    set((state) => ({ filters: { ...state.filters, session } }));
    void get().loadSlots();
  },
  resetFilters: () => {
    set({ filters: { departmentId: 'ALL', serviceId: 'ALL', date: '', session: 'ALL' } });
    void get().loadSlots();
  },
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  selectBookingSession: (selectedBookingSession) => set({ selectedBookingSession }),

  createSlotHold: async (selection) => {
    const patientId = usePatientStore.getState().activePatientId;
    if (!patientId) {
      const errorInfo = { type: 'NO_PATIENT' as const, message: 'Chưa chọn hồ sơ bệnh nhân.' };
      set({ errorInfo, error: errorInfo.message });
      return false;
    }
    const key = createIdempotencyKey();
    const rescheduleContext = get().rescheduleContext;
    const isReschedule = Boolean(rescheduleContext);
    set({
      isHolding: true,
      bookingPhase: 'CREATING_HOLD',
      holdIdempotencyKey: key,
      error: null,
      errorInfo: null,
      selectedSlot: isReschedule ? selection as EnrichedAppointmentSlot : null,
      selectedBookingSession: isReschedule ? null : selection as BookingSessionAvailability,
    });
    try {
      if (isReschedule) {
        const hold = await schedulingService.createRescheduleSlotHold(
          rescheduleContext!.originalAppointment.id,
          (selection as EnrichedAppointmentSlot).id,
          { idempotencyKey: key }
        );
        const phase: BookingPhase = hold.status === 'ACTIVE' ? 'HOLD_ACTIVE' : 'HOLD_EXPIRED';
        set({ currentHold: hold, currentHoldAssignment: null, isHolding: false, bookingPhase: phase });
        return hold.status === 'ACTIVE';
      }
      const response = await schedulingService.createSlotHold(
        { bookingSessionId: (selection as BookingSessionAvailability).id, patientId },
        { idempotencyKey: key }
      );
      const hold: SlotHoldRow = {
        id: response.id,
        patientId: response.patientId,
        expiresAt: response.expiresAt,
        depositAmount: response.depositAmount,
        currency: response.currency,
        status: response.status,
        version: response.version,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      };
      const phase: BookingPhase = hold.status === 'ACTIVE' ? 'HOLD_ACTIVE' : 'HOLD_EXPIRED';
      set({ currentHold: hold, currentHoldAssignment: response.assignment, isHolding: false, bookingPhase: phase });
      void get().loadSlots();
      return hold.status === 'ACTIVE';
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể giữ chỗ ca khám.');
      set({ errorInfo, error: null, isHolding: false, bookingPhase: 'IDLE', holdIdempotencyKey: null, selectedBookingSession: null });
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

  startRescheduleMode: async (context) => {
    await get().releaseCurrentHold();
    const { currentHold } = get();
    if (currentHold?.status === 'ACTIVE') {
      return false;
    }
    get().resetBookingFlow();
    set({
      rescheduleContext: context,
      rescheduleReason: '',
      rescheduleSubmitIdempotencyKey: null,
      rescheduleResult: null,
      isSubmittingReschedule: false,
      error: null,
      errorInfo: null,
    });
    await get().initBooking();
    return true;
  },

  cancelRescheduleMode: async () => {
    await get().releaseCurrentHold();
    const { currentHold } = get();
    if (currentHold?.status === 'ACTIVE') {
      return false;
    }
    get().resetBookingFlow();
    set({
      rescheduleContext: null,
      rescheduleReason: '',
      rescheduleSubmitIdempotencyKey: null,
      rescheduleResult: null,
      isSubmittingReschedule: false,
    });
    return true;
  },

  setRescheduleReason: (reason) => {
    set({ rescheduleReason: reason, rescheduleSubmitIdempotencyKey: null });
  },

  createRescheduleTopUp: async () => {
    const { rescheduleContext, currentHold, rescheduleReason } = get();
    if (!rescheduleContext || !currentHold || currentHold.status !== 'ACTIVE') {
      const errorInfo = { type: 'HOLD_EXPIRED' as const, message: 'Phiên giữ chỗ không hợp lệ hoặc đã hết hạn.' };
      set({ errorInfo, error: errorInfo.message });
      return false;
    }
    const key = get().paymentIdempotencyKey || createIdempotencyKey();
    set({ isCreatingPaymentIntent: true, bookingPhase: 'CREATING_PAYMENT_INTENT', paymentIdempotencyKey: key, error: null, errorInfo: null });
    try {
      const intent = await schedulingService.createRescheduleTopUpIntent(
        rescheduleContext.originalAppointment.id,
        { targetSlotHoldId: currentHold.id, reason: rescheduleReason || undefined },
        rescheduleContext.originalAppointment.version,
        { idempotencyKey: key }
      );
      set({
        currentPaymentIntent: intent,
        isCreatingPaymentIntent: false,
        bookingPhase: paymentPhase(intent),
        mockPaymentIdempotencyKey: null,
        mockPaymentOutcome: null,
      });
      if (intent.status === 'SUCCEEDED') {
        await get().refreshBookingStatus();
      }
      return true;
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể tạo yêu cầu thanh toán chênh lệch.');
      set({ errorInfo, error: errorInfo.message, isCreatingPaymentIntent: false, bookingPhase: 'HOLD_ACTIVE' });
      return false;
    }
  },

  submitReschedule: async () => {
    const { rescheduleContext, currentHold, currentPaymentIntent, rescheduleReason } = get();
    if (!rescheduleContext || !currentHold || currentHold.status !== 'ACTIVE') {
      const errorInfo = { type: 'HOLD_EXPIRED' as const, message: 'Phiên giữ chỗ đã hết hiệu lực. Vui lòng chọn lại ca khám.' };
      set({ errorInfo, error: errorInfo.message });
      return null;
    }

    const sourceDeposit =
      rescheduleContext.originalHold?.depositAmount ??
      ('paidDepositAmount' in rescheduleContext.originalAppointment
        ? parseFloat(rescheduleContext.originalAppointment.paidDepositAmount)
        : undefined);
    if (sourceDeposit === undefined) {
      const errorInfo = { type: 'SLOT_UNAVAILABLE' as const, message: 'Chưa có dữ liệu cọc ca hiện tại. Vui lòng tải lại lịch hẹn trước khi đổi lịch.' };
      set({ errorInfo, error: errorInfo.message });
      return null;
    }
    const targetDeposit = currentHold.depositAmount;
    if (targetDeposit > sourceDeposit) {
      if (!currentPaymentIntent || currentPaymentIntent.status !== 'SUCCEEDED') {
        const errorInfo = { type: 'PAYMENT_FAILED' as const, message: 'Cần thanh toán đủ khoản chênh lệch trước khi xác nhận đổi lịch.' };
        set({ errorInfo, error: errorInfo.message });
        return null;
      }
    }

    const key = get().rescheduleSubmitIdempotencyKey || createIdempotencyKey();
    set({ isSubmittingReschedule: true, rescheduleSubmitIdempotencyKey: key, error: null, errorInfo: null });

    try {
      const result = await schedulingService.rescheduleAppointment(
        rescheduleContext.originalAppointment.id,
        {
          targetSlotHoldId: currentHold.id,
          reason: rescheduleReason || undefined,
          topUpPaymentIntentId: currentPaymentIntent?.id,
        },
        rescheduleContext.originalAppointment.version,
        { idempotencyKey: key }
      );
      set({
        currentHold: null,
        currentHoldAssignment: null,
        currentPaymentIntent: null,
        selectedBookingSession: null,
        selectedSlot: null,
        holdIdempotencyKey: null,
        paymentIdempotencyKey: null,
        mockPaymentIdempotencyKey: null,
        mockPaymentOutcome: null,
        rescheduleSubmitIdempotencyKey: null,
        isSubmittingReschedule: false,
        rescheduleResult: result,
        bookingPhase: 'SUCCEEDED',
      });
      return result;
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể hoàn tất đổi lịch khám.');
      set({
        errorInfo,
        error: errorInfo.message,
        isSubmittingReschedule: false,
      });
      if (errorInfo.statusCode === 412) {
        try {
          const fresh = await schedulingService.getAppointment(rescheduleContext.originalAppointment.id);
          set((state) => ({
            currentPaymentIntent: null,
            paymentIdempotencyKey: null,
            mockPaymentIdempotencyKey: null,
            mockPaymentOutcome: null,
            rescheduleSubmitIdempotencyKey: null,
            rescheduleContext: state.rescheduleContext ? {
              ...state.rescheduleContext,
              originalAppointment: {
                ...state.rescheduleContext.originalAppointment,
                version: fresh.version,
                status: fresh.status,
              },
            } : null,
          }));
        } catch {
          // ignore
        }
      }
      return null;
    }
  },

  releaseCurrentHold: async (refreshSlots = true) => {
    const { currentHold, currentPaymentIntent } = get();
    if (!currentHold) {
      return true;
    }
    if (currentHold.status !== 'ACTIVE') {
      set({
        currentHold: null,
        currentHoldAssignment: null,
        currentPaymentIntent: null,
        selectedBookingSession: null,
        selectedSlot: null,
        holdIdempotencyKey: null,
        paymentIdempotencyKey: null,
        mockPaymentIdempotencyKey: null,
        mockPaymentOutcome: null,
        rescheduleSubmitIdempotencyKey: null,
        bookingPhase: 'IDLE',
      });
      if (refreshSlots && !get().rescheduleContext) void get().loadSlots();
      return true;
    }
    if (currentPaymentIntent?.status === 'SUCCEEDED') {
      const errorInfo = {
        type: 'RECONCILIATION_REQUIRED' as const,
        message: 'Thanh toán đã thành công. Không thể tự giải phóng phiên giữ chỗ; vui lòng cập nhật trạng thái đặt lịch.',
      };
      set({ errorInfo, error: errorInfo.message });
      return false;
    }
    try {
      await schedulingService.cancelSlotHold(currentHold.id, currentHold.version, {
        idempotencyKey: createIdempotencyKey(),
      });
    } catch (err) {
      const errorInfo = errorFrom(err, 'Không thể giải phóng phiên giữ chỗ. Máy chủ sẽ tự hết hạn phiên này.');
      set({ errorInfo, error: errorInfo.message });
      return false;
    }
    set({
      currentHold: null,
      currentHoldAssignment: null,
      currentPaymentIntent: null,
      selectedBookingSession: null,
      selectedSlot: null,
      holdIdempotencyKey: null,
      paymentIdempotencyKey: null,
      mockPaymentIdempotencyKey: null,
      mockPaymentOutcome: null,
      rescheduleSubmitIdempotencyKey: null,
      bookingPhase: 'IDLE',
    });
    if (refreshSlots && !get().rescheduleContext) void get().loadSlots();
    return true;
  },

  resetBookingFlow: () => set({
    selectedSlot: null,
    selectedBookingSession: null,
    currentHold: null,
    currentHoldAssignment: null,
    currentPaymentIntent: null,
    bookingPhase: 'IDLE',
    holdIdempotencyKey: null,
    paymentIdempotencyKey: null,
    mockPaymentIdempotencyKey: null,
    mockPaymentOutcome: null,
    rescheduleSubmitIdempotencyKey: null,
    rescheduleResult: null,
    isHolding: false,
    isCreatingPaymentIntent: false,
    isSimulatingPayment: false,
    isSubmittingReschedule: false,
    error: null,
    errorInfo: null,
  }),

  resetBookingState: async () => {
    if (!(await get().releaseCurrentHold(false))) return false;
    get().discardBookingState();
    return true;
  },

  discardBookingState: () => set({
    departments: [],
    rooms: [],
    services: [],
    practitioners: [],
    practitionerRoles: new Map(),
    filters: { departmentId: 'ALL', serviceId: 'ALL', date: getTodayDateString(), session: 'ALL' },
    rawSlots: [],
    enrichedSlots: [],
    bookingSessions: [],
    selectedBookingSession: null,
    selectedSlot: null,
    currentHold: null,
    currentHoldAssignment: null,
    currentPaymentIntent: null,
    bookingPhase: 'IDLE',
    holdIdempotencyKey: null,
    paymentIdempotencyKey: null,
    mockPaymentIdempotencyKey: null,
    mockPaymentOutcome: null,
    rescheduleContext: null,
    rescheduleReason: '',
    rescheduleSubmitIdempotencyKey: null,
    rescheduleResult: null,
    isSubmittingReschedule: false,
    isLoadingCatalogs: false,
    isLoadingSlots: false,
    isHolding: false,
    isCreatingPaymentIntent: false,
    isSimulatingPayment: false,
    error: null,
    errorInfo: null,
  }),
}));
