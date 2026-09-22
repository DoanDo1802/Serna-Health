import { Metadata } from 'next';
import { SidebarNavPreview } from '@/components/layout/sidebar-nav';

export const metadata: Metadata = {
  title: 'Hồ Sơ Bệnh Nhân | MediCore Patient Portal',
  description: 'Quản lý thông tin cá nhân, hồ sơ bệnh nhân và giấy tờ tùy thân CCCD / Hộ chiếu.',
};

export default function ProfilePage() {
  return <SidebarNavPreview initialActiveId="profile" />;
}
