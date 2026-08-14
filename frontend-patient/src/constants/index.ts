export const APP_CONFIG = {
  name: 'MediCore',
  title: 'MediCore — Cổng Bệnh Nhân',
  description: 'Hệ thống quản lý quy trình chăm sóc và khám bệnh tại bệnh viện',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1',
  sessionCookieName: 'MEDICORE_SESSION',
  csrfHeaderName: 'X-CSRF-Token',
  idempotencyHeaderName: 'Idempotency-Key',
  holdTimeoutSeconds: 300, // 5 minutes SlotHold
  depositMinAmount: 100000
} as const

export const DEPARTMENTS = [
  { id: 'dep-all', name: 'Tất cả chuyên khoa' },
  { id: 'dep-cardio', name: 'Khoa Tim Mạch' },
  { id: 'dep-internal', name: 'Khoa Nội Tổng Hợp' },
  { id: 'dep-pediatrics', name: 'Khoa Nhi' },
  { id: 'dep-derma', name: 'Khoa Da Liễu' },
  { id: 'dep-eye', name: 'Khoa Mắt' },
  { id: 'dep-surgery', name: 'Khoa Ngoại' }
] as const

export const SESSIONS_TIMELINE = [
  { name: 'Ca 1', timeRange: '08:00 - 09:30', period: 'MORNING' },
  { name: 'Ca 2', timeRange: '09:30 - 11:00', period: 'MORNING' },
  { name: 'Ca 3', timeRange: '13:30 - 15:00', period: 'AFTERNOON' },
  { name: 'Ca 4', timeRange: '15:00 - 16:30', period: 'AFTERNOON' }
] as const
export * from './messages'
