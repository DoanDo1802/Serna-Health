export type AppointmentSlotSession = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type AppointmentSlotStatus = 'ACTIVE' | 'CANCELLED';

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
  remainingCapacity: number;
}

export interface SlotHoldRow {
  id: string;
  slotId: string;
  patientId: string;
  expiresAt: string;
  depositAmount: number;
  currency: string;
  status: 'HELD' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlotHoldRequest {
  slotId: string;
  patientId: string;
}
