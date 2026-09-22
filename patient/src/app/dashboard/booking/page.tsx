import { Metadata } from 'next';
import { SidebarNavPreview } from '@/components/layout/sidebar-nav';

export const metadata: Metadata = {
  title: 'Tìm Ca Khám & Đặt Lịch | MediCore Patient Portal',
  description: 'Tìm kiếm ca khám bệnh theo chuyên khoa, dịch vụ, bác sĩ và ngày khám linh hoạt.',
};

export default function BookingRoutePage() {
  return <SidebarNavPreview initialActiveId="booking" />;
}
