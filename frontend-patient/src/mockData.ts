import { Doctor, Slot, Dependent, Appointment, NotificationItem } from './types'

export const MOCK_USER = {
  id: 'usr-101',
  fullName: 'Nguyễn Văn An',
  email: 'nguyenvanan@gmail.com',
  phone: '0912 345 678',
  dateOfBirth: '1990-05-15',
  gender: 'Nam',
  address: '123 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  nationalId: '079090012345',
  nationalIdStatus: 'MANUALLY_VERIFIED' as const,
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'
}

export const MOCK_DOCTORS: Doctor[] = [
  {
    id: 'doc-01',
    name: 'BS. CKII. Trần Thị Bình',
    title: 'Phó Trưởng Khoa Tim Mạch',
    specialty: 'Tim Mạch Can Thiệp',
    department: 'Khoa Tim Mạch',
    rating: 4.9,
    reviewCount: 142,
    experienceYears: 18,
    price: 200000,
    avatar: 'https://images.unsplash.com/photo-1594824813566-82823d5afe4a?auto=format&fit=crop&q=80&w=256',
    bio: 'Chuyên gia hơn 18 năm kinh nghiệm trong chẩn đoán và điều trị bệnh lý mạch vành, huyết áp cao và suy tim cấp/mạn tính.',
    availableToday: true
  },
  {
    id: 'doc-02',
    name: 'ThS. BS. Lê Văn Cường',
    title: 'Bác sĩ Điều trị Hàng đầu',
    specialty: 'Nội Tĩnh Mạch & Tiêu Hóa',
    department: 'Khoa Nội Tổng Hợp',
    rating: 4.8,
    reviewCount: 98,
    experienceYears: 12,
    price: 150000,
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=256',
    bio: 'Chuyên sâu chẩn đoán điều trị dạ dày, đại tràng, rối loạn chuyển hóa và thăm khám nội khoa tổng quát cho người lớn.',
    availableToday: true
  },
  {
    id: 'doc-03',
    name: 'TS. BS. Phạm Thị Dung',
    title: 'Trưởng Khoa Nhi',
    specialty: 'Nội Nhi & Hô Hấp Trẻ Em',
    department: 'Khoa Nhi',
    rating: 4.95,
    reviewCount: 210,
    experienceYears: 22,
    price: 180000,
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256',
    bio: 'Tốt nghiệp Tiến sĩ Y Khoa Đại học Y Dược, chuyên gia hàng đầu về hô hấp trẻ em, hen phế quản và các bệnh nhiễm trùng đường thở.',
    availableToday: true
  }
]
