const BASE_URL = "/api/backend"

export interface SessionView {
  accountId: string
  displayEmail: string
  status: "ACTIVE" | "EXPIRED" | "REVOKED"
  authenticatedAt: string
  lastSeenAt: string
  idleExpiresAt: string
  absoluteExpiresAt: string
  roleCodes: string[]
  permissions: string[]
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

import {
  clearCsrfToken as clearContextCsrfToken,
  currentTabContext,
  ensureTabContext,
  getCsrfToken,
  setCsrfToken as setContextCsrfToken,
} from "@/lib/tab-session-context"

export const clearCsrfToken = clearContextCsrfToken

function setCsrfToken(response: Response, context: string) {
  const token = response.headers.get("X-CSRF-Token")
  if (token && currentTabContext() === context) setContextCsrfToken(token, context)
}

async function responsePayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function apiError(response: Response, result: unknown): ApiError {
  const problem = result as { detail?: string; title?: string; message?: string; code?: string } | undefined
  const message = problem?.detail || problem?.message || problem?.title
  return new ApiError(
    response.status === 403 && (!message || message === "Access denied")
      ? "Tài khoản hiện tại chưa có quyền thực hiện thao tác này."
      : message || `Yêu cầu thất bại với mã lỗi ${response.status}`,
    response.status,
    problem?.code,
  )
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<{ response: Response; context: string }> {
  const method = (options.method ?? "GET").toUpperCase()
  const headers = new Headers(options.headers)
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  if (!isFormData && options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const context = await ensureTabContext()
  headers.set("X-MediCore-Tab-Context", context)

  const csrfToken = getCsrfToken(context)
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && csrfToken && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrfToken)
  }

  try {
    return { response: await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: "include" }), context }
  } catch {
    throw new Error("Không thể kết nối máy chủ. Vui lòng thử lại sau.")
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { response, context } = await fetchApi(path, options)
  const result = await responsePayload(response)
  if (!response.ok) {
    if (response.status === 401 && currentTabContext() === context) clearCsrfToken()
    throw apiError(response, result)
  }
  setCsrfToken(response, context)
  return result as T
}

async function requestWithMeta<T>(path: string, options: RequestInit = {}): Promise<{ data: T; etag: string | null }> {
  const { response, context } = await fetchApi(path, options)
  const result = await responsePayload(response)
  if (!response.ok) {
    if (response.status === 401 && currentTabContext() === context) clearCsrfToken()
    throw apiError(response, result)
  }
  setCsrfToken(response, context)
  return { data: result as T, etag: response.headers.get("ETag") }
}

async function requestFull<T>(path: string, options?: RequestInit): Promise<{ data: T; message: string }> {
  const data = await request<T>(path, options)
  return { data, message: "" }
}

export async function loginWithPassword(data: { email: string; password: string }): Promise<SessionView> {
  return request<SessionView>("/auth/password-sessions", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export const authApi = {
  login: loginWithPassword,
  currentSession: () => request<SessionView>("/auth/session"),
  async logout() {
    try {
      await request<void>("/auth/session", { method: "DELETE" })
    } finally {
      clearCsrfToken()
    }
  },
}

export type PersonnelType = "DOCTOR" | "STAFF"

export interface Department {
  id: string
  code: string
  name: string
  active: boolean
  effectiveFrom: string
  effectiveTo?: string | null
  version: number
}

export interface Room {
  id: string
  code: string
  name: string
  active: boolean
  version: number
  createdAt?: string
  updatedAt?: string
}

export interface RoomAssignments {
  roomId: string
  version: number
  departmentIds: string[]
  serviceIds: string[]
}

export interface RoomPage {
  items: Room[]
  nextCursor?: string | null
  hasMore: boolean
}

export interface DoctorProfessionalProfileInput {
  phone: string
  dateOfBirth: string
  gender: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED"
  address: string
  professionalTitle: string
  academicDegree: string
  specialtyDesignation: string
  licenseNumber: string
  licensingAuthority: string
  licenseIssuedOn: string
  licenseExpiresOn?: string | null
  yearsExperience: number
  biography?: string | null
  avatarUrl?: string | null
}

export interface PersonnelProvisionRequest {
  type: PersonnelType
  email: string
  initialPassword: string
  staffCode: string
  fullName: string
  departmentId?: string | null
  doctorProfile?: DoctorProfessionalProfileInput
}

export interface PersonnelUpdateRequest {
  type: PersonnelType
  staffCode: string
  fullName: string
  departmentId?: string | null
  doctorProfile?: DoctorProfessionalProfileInput
}

export interface Personnel {
  accountId: string
  accountVersion: number
  type: PersonnelType
  displayEmail: string
  accountStatus: string
  practitionerId?: string | null
  practitionerVersion?: number | null
  staffCode: string
  fullName: string
  active: boolean
  departmentId?: string | null
  practitionerRoleId?: string | null
  accountRoleAssignmentId?: string | null
  doctorProfile?: (DoctorProfessionalProfileInput & {
    version: number
    createdAt: string
    updatedAt: string
  }) | null
  deactivatedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonnelPage {
  items: Personnel[]
  nextCursor?: string | null
  hasMore: boolean
}

export interface DepartmentPage {
  items: Department[]
  nextCursor?: string | null
  hasMore: boolean
}

function idempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `personnel-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const departmentsApi = {
  list: (active?: boolean) => {
    const query = new URLSearchParams({ limit: "100" })
    if (active !== undefined) query.set("active", String(active))
    return request<DepartmentPage>(`/departments?${query.toString()}`)
  },
  get: (id: string) => requestWithMeta<Department>(`/departments/${id}`),
  create: (data: { code: string; name: string }) =>
    requestWithMeta<Department>("/departments", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ code: data.code.trim(), name: data.name, effectiveFrom: new Date().toISOString() }),
    }),
  update: (id: string, data: { code: string; name: string }, etag: string) =>
    requestWithMeta<Department>(`/departments/${id}`, {
      method: "PATCH",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
      body: JSON.stringify({ code: data.code.trim(), name: data.name, effectiveFrom: new Date().toISOString() }),
    }),
  activate: (id: string, etag: string) => requestWithMeta<Department>(`/departments/${id}/actions/activate`, { method: "POST", headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` } }),
  deactivate: (id: string, etag: string) => requestWithMeta<Department>(`/departments/${id}/actions/deactivate`, { method: "POST", headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` } }),
  delete: (id: string, etag: string) => request<void>(`/departments/${id}`, { method: "DELETE", headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` } }),
}

export interface Service {
  id: string
  code: string
  name: string
  serviceType: string
  departmentId?: string | null
  active: boolean
  allowsCritical: boolean
  version: number
  createdAt?: string
  updatedAt?: string
}

export interface ServicePage {
  items: Service[]
  nextCursor?: string | null
  hasMore: boolean
}

export const servicesApi = {
  list: (params: { serviceType?: string; active?: boolean; departmentId?: string; cursor?: string; limit?: number } = {}) => {
    const query = new URLSearchParams({ limit: String(params.limit ?? 100) })
    if (params.serviceType) query.set("serviceType", params.serviceType)
    if (params.active !== undefined) query.set("active", String(params.active))
    if (params.departmentId) query.set("departmentId", params.departmentId)
    if (params.cursor) query.set("cursor", params.cursor)
    return request<ServicePage>(`/services?${query.toString()}`)
  },
  get: (id: string) => requestWithMeta<Service>(`/services/${id}`),
  create: (data: { code: string; name: string; serviceType?: string; departmentId?: string | null }) =>
    requestWithMeta<Service>("/services", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({
        code: data.code.trim(),
        name: data.name.trim(),
        serviceType: data.serviceType ?? "CONSULTATION",
        departmentId: data.departmentId ?? null,
      }),
    }),
  update: (id: string, data: { code: string; name: string; serviceType?: string; departmentId?: string | null }, etag: string) =>
    requestWithMeta<Service>(`/services/${id}`, {
      method: "PATCH",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
      body: JSON.stringify({
        code: data.code.trim(),
        name: data.name.trim(),
        serviceType: data.serviceType ?? "CONSULTATION",
        departmentId: data.departmentId ?? null,
      }),
    }),
  deactivate: (id: string, etag: string) =>
    requestWithMeta<Service>(`/services/${id}/actions/deactivate`, {
      method: "POST",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
    }),
}

export const roomsApi = {
  list: (params: { departmentId?: string; active?: boolean; cursor?: string; limit?: number } = {}) => {
    const query = new URLSearchParams({ limit: String(params.limit ?? 100) })
    if (params.departmentId) query.set("departmentId", params.departmentId)
    if (params.active !== undefined) query.set("active", String(params.active))
    if (params.cursor) query.set("cursor", params.cursor)
    return request<RoomPage>(`/rooms?${query.toString()}`)
  },
  get: (id: string) => requestWithMeta<Room>(`/rooms/${id}`),
  create: (data: { code: string; name: string }) =>
    requestWithMeta<Room>("/rooms", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ code: data.code.trim(), name: data.name.trim() }),
    }),
  update: (id: string, data: { code: string; name: string }, etag: string) =>
    requestWithMeta<Room>(`/rooms/${id}`, {
      method: "PATCH",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
      body: JSON.stringify({ code: data.code.trim(), name: data.name.trim() }),
    }),
  deactivate: (id: string, etag: string) =>
    requestWithMeta<Room>(`/rooms/${id}/actions/deactivate`, {
      method: "POST",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
    }),
  assignments: (id: string) => requestWithMeta<RoomAssignments>(`/rooms/${id}/assignments`),
  replaceAssignments: (id: string, data: { departmentIds: string[]; serviceIds: string[] }, etag: string) =>
    requestWithMeta<RoomAssignments>(`/rooms/${id}/assignments`, {
      method: "PUT",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
      body: JSON.stringify(data),
    }),
  delete: (id: string, etag: string) =>
    request<void>(`/rooms/${id}`, {
      method: "DELETE",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
    }),
}

export type FacilityElementType =
  | "ROOM"
  | "WALKWAY"
  | "ELEVATOR"
  | "STAIRS"
  | "WC"
  | "RECEPTION"
  | "EQUIPMENT"
  | "WAITING_AREA"
  | "EMERGENCY_EXIT"
  | "OTHER"

export type DoorSide = "NORTH" | "EAST" | "SOUTH" | "WEST"

export type FacilitySymbolType = "WALL_STRAIGHT" | "WALL_CURVED" | "PARTITION" | "DOOR" | "STAIRS" | "ELEVATOR" | "WC" | "SKYWELL"
export type FacilityPoint = { x: number; y: number }
export type FacilitySymbolGeometry =
  | { start: FacilityPoint; end: FacilityPoint; thickness: number }
  | { center: FacilityPoint; radius: number; startAngle: number; sweepAngle: number; thickness: number }
  | { hinge: FacilityPoint; radius: number; startAngle: number; sweepAngle: 90 | -90; openingDirection: "CLOCKWISE" | "COUNTERCLOCKWISE" }
  | { x: number; y: number; width: number; height: number; rotation: 0 | 90 | 180 | 270 }

export interface FacilityFloor {
  id: string
  version: number
  code: string
  name: string
  level: number
  description?: string | null
  gridColumns: number
  gridRows: number
  createdAt?: string
  updatedAt?: string
}

export interface FacilityFloorElement {
  id: string
  floorId: string
  roomId?: string | null
  version: number
  elementType: FacilityElementType
  label: string
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  zIndex: number
  doorSide?: DoorSide | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface FacilityFloorPage {
  items: FacilityFloor[]
  nextCursor?: string | null
  hasMore: boolean
}

export interface FacilityFloorElementPage {
  items: FacilityFloorElement[]
  nextCursor?: string | null
  hasMore: boolean
}

export interface FacilityFloorSymbol {
  id: string
  floorId: string
  version: number
  symbolType: FacilitySymbolType
  label: string
  geometry: FacilitySymbolGeometry
  zIndex: number
  createdAt?: string
  updatedAt?: string
}

export interface FacilityFloorSymbolPage {
  items: FacilityFloorSymbol[]
  nextCursor?: string | null
  hasMore: boolean
}

export interface FacilityLayoutSnapshot {
  floor: FacilityFloor
  elements: FacilityFloorElement[]
  symbols: FacilityFloorSymbol[]
}

export interface FacilityRoomPlacement {
  roomId: string
  floorId: string
  elementId: string
}

export interface FacilityRoomPlacementList {
  items: FacilityRoomPlacement[]
}

export interface FacilityFloorElementChangeItem {
  id?: string | null
  roomId?: string | null
  elementType: FacilityElementType
  label: string
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  zIndex?: number
  doorSide?: DoorSide | null
  notes?: string | null
}

export interface FacilityFloorElementDeleteItem {
  id: string
  expectedVersion: number
}

export interface FacilityFloorLayoutChangesRequest {
  expectedFloorVersion: number
  creates?: FacilityFloorElementChangeItem[]
  updates?: FacilityFloorElementChangeItem[]
  deletes?: FacilityFloorElementDeleteItem[]
}

export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string | null; hasMore: boolean }>,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = []
  let cursor: string | undefined = undefined
  let pages = 0
  while (pages < maxPages) {
    const page = await fetchPage(cursor)
    all.push(...page.items)
    pages++
    if (!page.hasMore || !page.nextCursor) break
    cursor = page.nextCursor
  }
  return all
}

export const facilityLayoutApi = {
  listFloors: () => request<FacilityFloorPage>("/facility-floors?limit=100"),
  getFloor: (id: string) => requestWithMeta<FacilityFloor>(`/facility-floors/${id}`),
  getLayoutSnapshot: (floorId: string) =>
    requestWithMeta<FacilityLayoutSnapshot>(`/facility-floors/${floorId}/layout`),
  getRoomPlacements: () =>
    request<FacilityRoomPlacementList>("/facility-floors/room-placements"),
  applyLayoutChanges: (floorId: string, data: FacilityFloorLayoutChangesRequest, key = idempotencyKey()) =>
    requestWithMeta<FacilityLayoutSnapshot>(`/facility-floors/${floorId}/layout/changes`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(data),
    }),
  createFloor: (data: Omit<FacilityFloor, "id" | "version" | "createdAt" | "updatedAt">) =>
    requestWithMeta<FacilityFloor>("/facility-floors", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data),
    }),
  updateFloor: (id: string, data: Omit<FacilityFloor, "id" | "version" | "createdAt" | "updatedAt">, etag: string) =>
    requestWithMeta<FacilityFloor>(`/facility-floors/${id}`, {
      method: "PATCH",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
      body: JSON.stringify(data),
    }),
  deleteFloor: (id: string, etag: string) =>
    request<void>(`/facility-floors/${id}`, { method: "DELETE", headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` } }),
  listElements: (floorId: string, cursor?: string) =>
    request<FacilityFloorElementPage>(`/facility-floors/${floorId}/elements?limit=100${cursor ? `&cursor=${cursor}` : ""}`),
  getElement: (id: string) => requestWithMeta<FacilityFloorElement>(`/facility-floor-elements/${id}`),
  createElement: (floorId: string, data: Omit<FacilityFloorElement, "id" | "floorId" | "version" | "createdAt" | "updatedAt">) =>
    requestWithMeta<FacilityFloorElement>(`/facility-floors/${floorId}/elements`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data),
    }),
  updateElement: (id: string, data: Omit<FacilityFloorElement, "id" | "floorId" | "version" | "createdAt" | "updatedAt">, etag: string) =>
    requestWithMeta<FacilityFloorElement>(`/facility-floor-elements/${id}`, {
      method: "PATCH",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
      body: JSON.stringify(data),
    }),
  deleteElement: (id: string, etag: string) =>
    request<void>(`/facility-floor-elements/${id}`, { method: "DELETE", headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` } }),
  listSymbols: (floorId: string) => request<FacilityFloorSymbolPage>(`/facility-floors/${floorId}/symbols?limit=100`),
  getSymbol: (id: string) => requestWithMeta<FacilityFloorSymbol>(`/facility-floor-symbols/${id}`),
  createSymbol: (floorId: string, data: Omit<FacilityFloorSymbol, "id" | "floorId" | "version" | "createdAt" | "updatedAt">) =>
    requestWithMeta<FacilityFloorSymbol>(`/facility-floors/${floorId}/symbols`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data),
    }),
  updateSymbol: (id: string, data: Omit<FacilityFloorSymbol, "id" | "floorId" | "version" | "createdAt" | "updatedAt">, etag: string) =>
    requestWithMeta<FacilityFloorSymbol>(`/facility-floor-symbols/${id}`, {
      method: "PATCH", headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` }, body: JSON.stringify(data),
    }),
  deleteSymbol: (id: string, etag: string) =>
    request<void>(`/facility-floor-symbols/${id}`, { method: "DELETE", headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` } }),
}

export const personnelApi = {
  list: (params: { type?: PersonnelType; active?: boolean } = {}) => {
    const query = new URLSearchParams({ limit: "100" })
    if (params.type) query.set("type", params.type)
    if (params.active !== undefined) query.set("active", String(params.active))
    return request<PersonnelPage>(`/admin/personnel?${query.toString()}`)
  },
  get: (accountId: string) => requestWithMeta<Personnel>(`/admin/personnel/${accountId}`),
  provision: (payload: PersonnelProvisionRequest) => requestWithMeta<Personnel>("/admin/personnel", { method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(payload) }),
  update: (accountId: string, payload: PersonnelUpdateRequest, etag: string) => requestWithMeta<Personnel>(`/admin/personnel/${accountId}`, { method: "PATCH", headers: { "If-Match": etag }, body: JSON.stringify(payload) }),
  deactivate: (accountId: string, reason: string, etag: string) => requestWithMeta<Personnel>(`/admin/personnel/${accountId}/actions/deactivate`, { method: "POST", headers: { "If-Match": etag, "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({ reason }) }),
}

export interface PractitionerView { id: string; version: number; userAccountId?: string | null; staffCode: string; fullName: string; active: boolean; createdAt?: string; updatedAt?: string }
export interface PractitionerRoleView { id: string; version: number; practitionerId: string; departmentId: string; roleCode: string; effectiveFrom?: string; effectiveTo?: string | null; status: string; createdAt?: string; updatedAt?: string }

export const practitionersApi = {
  list: (active?: boolean) => { const query = new URLSearchParams({ limit: "100" }); if (active !== undefined) query.set("active", String(active)); return request<{ items: PractitionerView[]; nextCursor?: string | null; hasMore: boolean }>(`/practitioners?${query.toString()}`) },
  get: (id: string) => requestWithMeta<PractitionerView>(`/practitioners/${id}`),
  listRoles: (practitionerId: string) => request<{ items: PractitionerRoleView[]; nextCursor?: string | null; hasMore: boolean }>(`/practitioners/${practitionerId}/roles?limit=100`),
}

export type AppointmentSlotSession = "MORNING" | "AFTERNOON"
export interface WorkScheduleCatalog {
  departments: Pick<Department, "id" | "name">[]
  rooms: Array<{ id: string; departmentIds: string[]; serviceIds: string[]; name: string }>
  services: Array<{ id: string; departmentId?: string | null; name: string; priceAmount?: number | null; priceCurrency?: string | null }>
}
export interface WorkSchedule { id: string; bookingSessionId: string; practitionerRoleId: string; departmentId: string; roomId: string; serviceId: string; localDate: string; session: AppointmentSlotSession; capacity: number; status: "ACTIVE" | "CANCELLED"; version: number; createdAt: string; updatedAt: string; slotId: string; reservedCapacity: number; remainingCapacity: number }
export interface WorkSchedulePage { items: WorkSchedule[]; nextCursor?: string | null; hasMore: boolean }
export interface CreateWorkScheduleRequest { practitionerRoleId: string; departmentId: string; roomId: string; serviceId: string; localDate: string; session: AppointmentSlotSession; capacity: number }
export interface UpdateWorkScheduleRequest { practitionerRoleId?: string; departmentId?: string; roomId?: string; serviceId?: string; localDate?: string; session?: AppointmentSlotSession; capacity?: number }

export const workSchedulesApi = {
  catalog: () => request<WorkScheduleCatalog>("/admin/work-schedules/catalog"),
  list: (params: { fromDate?: string; toDate?: string } = {}) => { const query = new URLSearchParams({ limit: "100" }); if (params.fromDate) query.set("fromDate", params.fromDate); if (params.toDate) query.set("toDate", params.toDate); return request<WorkSchedulePage>(`/admin/work-schedules?${query.toString()}`) },
  create: (payload: CreateWorkScheduleRequest, key = idempotencyKey()) => requestWithMeta<WorkSchedule>("/admin/work-schedules", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(payload) }),
  update: (id: string, payload: number | UpdateWorkScheduleRequest, etag: string) => requestWithMeta<WorkSchedule>(`/admin/work-schedules/${id}`, { method: "PATCH", headers: { "If-Match": etag }, body: JSON.stringify(typeof payload === "number" ? { capacity: payload } : payload) }),
  cancel: (id: string, etag: string, key = idempotencyKey()) => requestWithMeta<WorkSchedule>(`/admin/work-schedules/${id}/actions/cancel`, { method: "POST", headers: { "If-Match": etag, "Idempotency-Key": key }, body: JSON.stringify({}) }),
}

export const specialtiesApi = {
  list: async (includeInactive = false) => (await departmentsApi.list(includeInactive ? undefined : true)).items,
  get: async (id: string | number) => (await departmentsApi.get(String(id))).data,
  create: async (data: { name: string; code?: string; examTemplate?: any }) => (await departmentsApi.create({ code: data.code?.trim() || `DEP-${Date.now().toString(36).toUpperCase()}`, name: data.name })).data,
  update: async (id: string | number, data: { name: string; code?: string; examTemplate?: any }, etag?: string) => (await departmentsApi.update(String(id), { code: data.code?.trim() || "", name: data.name }, etag || '"0"')).data,
  updateStatus: async (id: string | number, active: boolean, etag?: string) => (active ? await departmentsApi.activate(String(id), etag || '"0"') : await departmentsApi.deactivate(String(id), etag || '"0"')).data,
  delete: async (id: string | number, etag?: string) => { await departmentsApi.delete(String(id), etag || '"0"') },
}

export const doctorsApi = {
  list: () => request<any[]>("/doctors"), get: (id: string | number) => request<any>(`/doctors/${id}`), getProfile: () => request<any>("/doctors/profile"), updateProfile: (data: any) => request<any>("/doctors/profile", { method: "PUT", body: JSON.stringify(data) }), create: (data: any) => request<any>("/doctors", { method: "POST", body: JSON.stringify(data) }), update: (id: string | number, data: any) => request<any>(`/doctors/${id}`, { method: "PUT", body: JSON.stringify(data) }), delete: (id: string | number) => requestFull<void>(`/doctors/${id}`, { method: "DELETE" }),
}
export const medicinesApi = {
  list: () => request<any[]>("/medicines"), get: (id: string | number) => request<any>(`/medicines/${id}`), create: (data: any) => request<any>("/medicines", { method: "POST", body: JSON.stringify(data) }), update: (id: string | number, data: any) => request<any>(`/medicines/${id}`, { method: "PUT", body: JSON.stringify(data) }), delete: (id: string | number) => request<void>(`/medicines/${id}`, { method: "DELETE" }),
}
export const diseasesApi = {
  list: () => request<any[]>("/diseases"), get: (code: string) => request<any>(`/diseases/${code}`), create: (data: any) => request<any>("/diseases", { method: "POST", body: JSON.stringify(data) }), update: (code: string, data: any) => request<any>(`/diseases/${code}`, { method: "PUT", body: JSON.stringify(data) }), delete: (code: string) => request<void>(`/diseases/${code}`, { method: "DELETE" }),
}
export const treatmentTemplatesApi = {
  list: (params?: { icd10Code?: string }) => { const query = params?.icd10Code ? `?icd10Code=${encodeURIComponent(params.icd10Code)}` : ""; return request<any[]>(`/admin/treatment-templates${query}`) }, get: (id: string | number) => request<any>(`/admin/treatment-templates/${id}`), create: (data: any) => request<any>("/admin/treatment-templates", { method: "POST", body: JSON.stringify(data) }), update: (id: string | number, data: any) => request<any>(`/admin/treatment-templates/${id}`, { method: "PUT", body: JSON.stringify(data) }), delete: (id: string | number) => request<void>(`/admin/treatment-templates/${id}`, { method: "DELETE" }),
}
export const patientsApi = {
  list: () => request<any[]>("/patients"), get: (id: string | number) => request<any>(`/patients/${id}`), create: (data: any) => request<any>("/patients", { method: "POST", body: JSON.stringify(data) }), update: (id: string | number, data: any, etag?: string) => request<any>(`/patients/${id}`, { method: "PATCH", headers: etag ? { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` } : {}, body: JSON.stringify(data) }), delete: (id: string | number) => request<void>(`/patients/${id}`, { method: "DELETE" }),
}
export interface EncounterParticipant {
  id: string
  encounterId: string
  practitionerRoleId: string
  practitionerName?: string
  practitionerRoleCode?: string
  roleType: "PRIMARY_PERFORMER" | "SECONDARY_PERFORMER" | "CONSULTANT"
  status: "ACTIVE" | "COMPLETED" | "WITHDRAWN"
  createdAt: string
}

export interface Encounter {
  id: string
  version: number
  visitId: string
  patientId: string
  departmentId: string
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  startAt?: string | null
  endAt?: string | null
  participants: EncounterParticipant[]
  createdAt: string
  updatedAt: string
}

export interface EncounterPage {
  items: Encounter[]
  nextCursor?: string | null
  hasMore: boolean
}

export interface ClinicalNoteVersion {
  id: string
  version: number
  clinicalNoteId: string
  versionNumber: number
  status: "DRAFT" | "FINALIZED" | "AMENDED" | "ENTERED_IN_ERROR"
  contentSchemaVersion: string
  content: any
  digest: string
  authorPractitionerRoleId: string
  authorPractitionerName?: string
  finalizedByPractitionerRoleId?: string | null
  finalizedByPractitionerName?: string | null
  finalizedAt?: string | null
  amendedFromVersionId?: string | null
  amendmentReason?: string | null
  errorReason?: string | null
  createdAt: string
  updatedAt: string
}

export interface ClinicalNote {
  id: string
  version: number
  encounterId: string
  patientId: string
  noteType: "EXAMINATION" | "CONSULTATION" | "PROGRESS" | "DISCHARGE"
  status: "DRAFT" | "FINALIZED" | "AMENDED" | "ENTERED_IN_ERROR"
  currentVersionId?: string | null
  currentVersion?: ClinicalNoteVersion | null
  createdAt: string
  updatedAt: string
}

export interface ClinicalNotePage {
  items: ClinicalNote[]
  nextCursor?: string | null
  hasMore: boolean
}

export interface CheckInResponse {
  visit: any
  encounter: Encounter
}

function makeIdempotencyKey(prefix = "idemp"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const receptionApi = {
  checkIn: (appointmentId: string, notes?: string) =>
    request<CheckInResponse>(`/appointments/${appointmentId}/check-ins`, {
      method: "POST",
      headers: { "Idempotency-Key": makeIdempotencyKey("checkin") },
      body: JSON.stringify({ notes }),
    }),

  getEncounter: (encounterId: string) =>
    requestWithMeta<Encounter>(`/encounters/${encounterId}`),

  startEncounter: (encounterId: string, etag: string) =>
    requestWithMeta<Encounter>(`/encounters/${encounterId}/actions/start`, {
      method: "POST",
      headers: {
        "If-Match": etag.startsWith('"') ? etag : `"${etag}"`,
        "Idempotency-Key": makeIdempotencyKey("start"),
      },
    }),

  completeEncounter: (encounterId: string, etag: string) =>
    requestWithMeta<Encounter>(`/encounters/${encounterId}/actions/complete`, {
      method: "POST",
      headers: {
        "If-Match": etag.startsWith('"') ? etag : `"${etag}"`,
        "Idempotency-Key": makeIdempotencyKey("comp"),
      },
    }),

  listEncounters: (params?: { practitionerRoleId?: string; date?: string; patientId?: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.practitionerRoleId) query.set("practitionerRoleId", params.practitionerRoleId)
    if (params?.date) query.set("date", params.date)
    if (params?.patientId) query.set("patientId", params.patientId)
    if (params?.status) query.set("status", params.status)
    if (params?.limit) query.set("limit", String(params.limit))
    return request<EncounterPage>(`/encounters?${query.toString()}`)
  },
}

export const clinicalCareApi = {
  listEncounterNotes: (encounterId: string) =>
    request<ClinicalNotePage>(`/encounters/${encounterId}/clinical-notes`),

  createNote: (encounterId: string, payload: { noteType: string; contentSchemaVersion?: string; content: any }) =>
    requestWithMeta<ClinicalNote>(`/encounters/${encounterId}/clinical-notes`, {
      method: "POST",
      headers: { "Idempotency-Key": makeIdempotencyKey("note") },
      body: JSON.stringify(payload),
    }),

  getNote: (noteId: string) =>
    requestWithMeta<ClinicalNote>(`/clinical-notes/${noteId}`),

  getNoteVersion: (versionId: string) =>
    requestWithMeta<ClinicalNoteVersion>(`/clinical-note-versions/${versionId}`),

  updateDraft: (versionId: string, etag: string, payload: { contentSchemaVersion?: string; content: any }) =>
    requestWithMeta<ClinicalNoteVersion>(`/clinical-note-versions/${versionId}`, {
      method: "PATCH",
      headers: { "If-Match": etag.startsWith('"') ? etag : `"${etag}"` },
      body: JSON.stringify(payload),
    }),

  finalizeNote: (versionId: string, etag: string) =>
    requestWithMeta<ClinicalNoteVersion>(`/clinical-note-versions/${versionId}/actions/finalize`, {
      method: "POST",
      headers: {
        "If-Match": etag.startsWith('"') ? etag : `"${etag}"`,
        "Idempotency-Key": makeIdempotencyKey("fin"),
      },
    }),

  amendNote: (versionId: string, etag: string, payload: { amendmentReason: string; contentSchemaVersion?: string; content: any }) =>
    requestWithMeta<ClinicalNoteVersion>(`/clinical-note-versions/${versionId}/actions/amend`, {
      method: "POST",
      headers: {
        "If-Match": etag.startsWith('"') ? etag : `"${etag}"`,
        "Idempotency-Key": makeIdempotencyKey("amend"),
      },
      body: JSON.stringify(payload),
    }),

  listPatientNotes: (patientId: string, limit = 50, cursor?: string) => {
    const query = new URLSearchParams({ limit: String(limit) })
    if (cursor) query.set("cursor", cursor)
    return request<ClinicalNotePage>(`/patients/${patientId}/clinical-notes?${query.toString()}`)
  },
}

export interface PatientAppointment { id: string; version: number; patientId: string; slotId: string; status: string; departmentName: string; roomName: string; serviceName: string; practitionerName: string; practitionerRoleCode: string; startAt: string; endAt: string; session: "MORNING" | "AFTERNOON"; requiredDepositAmount?: string; paidDepositAmount?: string; currency?: string; depositState?: string; canCancel?: boolean; canReschedule?: boolean; createdAt?: string; updatedAt?: string; patientDbId?: string | number; patientName?: string; patientDateOfBirth?: string; specialtyId?: string | number; appointmentDate?: string; timeSlot?: string; symptomsInitial?: string; icdCode?: string; mainDiagnosis?: string; doctorId?: string | number }
export interface PatientAppointmentPage { items: PatientAppointment[]; nextCursor?: string | null; hasMore: boolean }
export const appointmentsApi = {
  list: async (limit = 100): Promise<any[]> => { const res = await request<any>(`/appointments?limit=${limit}`); return Array.isArray(res) ? res : (res?.items ?? []) }, listAppointments: async (limit = 100): Promise<PatientAppointment[]> => { const res = await request<any>(`/appointments?limit=${limit}`); return Array.isArray(res) ? res : (res?.items ?? []) }, listPage: (params?: { patientId?: string; cursor?: string; limit?: number }) => { const query = new URLSearchParams(); if (params?.patientId) query.set("patientId", params.patientId); if (params?.cursor) query.set("cursor", params.cursor); if (params?.limit) query.set("limit", String(params.limit)); return request<PatientAppointmentPage>(`/appointments?${query.toString()}`) }, listByDoctor: (doctorId: string | number) => request<any[]>(`/appointments/doctor/${doctorId}`), listDoctorWaiting: (doctorId: string | number, date?: string) => request<any[]>(`/appointments/doctor/${doctorId}/waiting${date ? `?date=${encodeURIComponent(date)}` : ""}`), get: (id: string | number) => request<any>(`/appointments/${id}`), create: (data: any) => request<any>("/appointments", { method: "POST", body: JSON.stringify(data) }), update: (id: string | number, data: any) => request<any>(`/appointments/${id}`, { method: "PUT", body: JSON.stringify(data) }), startExam: (id: string | number) => request<any>(`/appointments/${id}/start-exam`, { method: "PUT" }), delete: (id: string | number) => request<void>(`/appointments/${id}`, { method: "DELETE" }),
}
export const schedulesApi = {
  list: (params?: { doctorId?: string | number; date?: string; fromDate?: string; toDate?: string }) => { const searchParams = new URLSearchParams(); if (params?.doctorId) searchParams.set("doctorId", String(params.doctorId)); if (params?.date) searchParams.set("date", params.date); if (params?.fromDate) searchParams.set("fromDate", params.fromDate); if (params?.toDate) searchParams.set("toDate", params.toDate); const query = searchParams.toString(); return request<any[]>(`/admin/schedules${query ? `?${query}` : ""}`) }, get: (id: string | number) => request<any>(`/admin/schedules/${id}`), create: (data: any) => request<any>("/admin/schedules", { method: "POST", body: JSON.stringify(data) }), update: (id: string | number, data: any) => request<any>(`/admin/schedules/${id}`, { method: "PUT", body: JSON.stringify(data) }), delete: (id: string | number) => request<void>(`/admin/schedules/${id}`, { method: "DELETE" }), bulk: (data: any[]) => request<any[]>("/admin/schedules/bulk", { method: "POST", body: JSON.stringify(data) }),
}
export const aiApi = { doctorChat: (data: { message: string; history?: any[]; appointmentId?: number; patientCode?: string }) => request<any>("/ai/doctor/chat", { method: "POST", body: JSON.stringify(data) }) }
