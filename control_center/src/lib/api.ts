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
  return new ApiError(
    problem?.detail || problem?.message || problem?.title || `Yêu cầu thất bại với mã lỗi ${response.status}`,
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
  departmentId?: string
  doctorProfile?: DoctorProfessionalProfileInput
}

export interface PersonnelUpdateRequest {
  type: PersonnelType
  staffCode: string
  fullName: string
  departmentId?: string
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
export interface WorkScheduleCatalog { departments: Pick<Department, "id" | "name">[]; rooms: Array<{ id: string; departmentId: string; name: string }>; services: Array<{ id: string; name: string; priceAmount: number; priceCurrency: string }> }
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
  list: () => request<any[]>("/patients"), get: (id: string | number) => request<any>(`/patients/${id}`), create: (data: any) => request<any>("/patients", { method: "POST", body: JSON.stringify(data) }), update: (id: string | number, data: any) => request<any>(`/patients/${id}`, { method: "PUT", body: JSON.stringify(data) }), delete: (id: string | number) => request<void>(`/patients/${id}`, { method: "DELETE" }),
}
export const medicalRecordsApi = {
  create: (data: any) => request<any>("/clinical/medical-records", { method: "POST", body: JSON.stringify(data) }), getByAppointment: (appointmentId: string | number) => request<any>(`/clinical/medical-records/appointment/${appointmentId}`), listDoctorRecords: () => request<any[]>("/clinical/medical-records/doctor-records"), uploadPdf: (appointmentId: string | number, pdfBlob: Blob) => { const formData = new FormData(); formData.append("file", pdfBlob, `record-${appointmentId}.pdf`); return request<any>(`/clinical/medical-records/appointment/${appointmentId}/upload-pdf`, { method: "POST", body: formData }) },
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
