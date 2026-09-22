export interface DepartmentView {
  id: string;
  version: number;
  code: string;
  name: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomView {
  id: string;
  version: number;
  departmentId: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceView {
  id: string;
  version: number;
  code: string;
  name: string;
  serviceType: string;
  active: boolean;
  allowsCritical: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePriceView {
  id: string;
  version: number;
  serviceId: string;
  amount: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PractitionerView {
  id: string;
  version: number;
  userAccountId?: string | null;
  staffCode: string;
  fullName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PractitionerRoleView {
  id: string;
  version: number;
  practitionerId: string;
  departmentId: string;
  roleCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  revokedAt?: string | null;
  revokedByAccountId?: string | null;
  revokeReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogPageResponse<T> {
  items: T[];
  nextCursor?: string | null;
  hasMore: boolean;
}
