export type UserRole = 'admin' | 'doctor' | 'nurse' | 'patient' | 'receptionist';

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  department?: string;
}

export interface Patient {
  id: string;
  code: string; // e.g. BN-2026-0891
  fullName: string;
  dob: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  phone: string;
  bloodType: string;
  lastVisit: string;
  status: 'Đang điều trị' | 'Xuất viện' | 'Theo dõi' | 'Chờ khám';
  department: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  department: string;
  dateTime: string;
  type: 'Khám định kỳ' | 'Tái khám' | 'Cấp cứu' | 'Tư vấn chuyên sâu';
  status: 'Đã xác nhận' | 'Đang khám' | 'Hoàn thành' | 'Đã hủy';
}

export interface BedOccupancy {
  department: string;
  totalBeds: number;
  occupiedBeds: number;
  icuBeds: number;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: string;
}
