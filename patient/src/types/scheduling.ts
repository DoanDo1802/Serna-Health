export type AppointmentSlotSession = 'MORNING' | 'AFTERNOON';
export type AppointmentSlotStatus = 'ACTIVE' | 'CANCELLED' | 'REPLACED';
export type SlotHoldStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'RELEASED';
export type PaymentIntentStatus =
  | 'REQUIRES_PAYMENT_METHOD'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED';

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_CONSULTATION'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'
  | 'ENTERED_IN_ERROR';

export interface AppointmentRow {
  id: string;
  version: number;
  patientId: string;
  slotHoldId?: string;
  slotId: string;
  rescheduledFromId?: string | null;
  rescheduledToId?: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentPageResponse {
  items: AppointmentRow[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface EnrichedAppointment extends AppointmentRow {
  slot?: AppointmentSlotRow;
  departmentName?: string;
  roomName?: string;
  serviceName?: string;
  practitionerName?: string;
  startAt?: string;
  endAt?: string;
  session?: AppointmentSlotSession;
  priceAmount?: number;
  priceCurrency?: string;
}

export interface BookingCatalog {
  departments: BookingDepartment[];
  rooms: BookingRoom[];
  services: BookingService[];
  practitioners: BookingPractitioner[];
  practitionerRoles: BookingPractitionerRole[];
}

export interface BookingDepartment {
  id: string;
  name: string;
}

export interface BookingRoom {
  id: string;
  departmentId: string;
  name: string;
}

export interface BookingService {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
}

export interface BookingPractitioner {
  id: string;
  fullName: string;
}

export interface BookingPractitionerRole {
  id: string;
  practitionerId: string;
  roleCode: string;
}

export interface AppointmentSlotRow {
  id: string;
  version: number;
  practitionerRoleId: string;
  departmentId: string;
  roomId: string;
  serviceId: string;
  session: AppointmentSlotSession;
  startAt: string;
  endAt: string;
  capacity: number;
  status: AppointmentSlotStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentSlotPageResponse {
  items: AppointmentSlotRow[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface EnrichedAppointmentSlot extends AppointmentSlotRow {
  departmentName: string;
  roomName: string;
  serviceName: string;
  practitionerName: string;
  practitionerTitle?: string;
  priceAmount: number;
  priceCurrency: string;
  checkInStart: string;
  checkInEnd: string;
}

export interface SlotHoldRow {
  id: string;
  slotId: string;
  patientId: string;
  expiresAt: string;
  depositAmount: number;
  currency: string;
  status: SlotHoldStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntentRow {
  id: string;
  slotHoldId: string;
  provider: string;
  providerReference: string | null;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  reconciliationReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlotHoldRequest {
  slotId: string;
  patientId: string;
}

export interface SimulateMockPaymentOutcomeRequest {
  outcome: 'SUCCEEDED' | 'FAILED';
}

export interface CommandAcceptedResponse {
  status: 'ACCEPTED';
}

export type BookingPhase =
  | 'IDLE'
  | 'CREATING_HOLD'
  | 'HOLD_ACTIVE'
  | 'CREATING_PAYMENT_INTENT'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED'
  | 'HOLD_EXPIRED';
