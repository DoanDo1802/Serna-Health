import { Metadata } from 'next';
import { AuthPage } from '@/components/features/auth/auth-page';

export const metadata: Metadata = {
  title: 'Đăng Ký & Đăng Nhập | Bệnh Viện Quốc Tế',
  description: 'Cổng đăng nhập và đăng ký tài khoản bệnh nhân để quản lý hồ sơ bệnh án và lịch khám trực tuyến.',
};

export default function Page() {
  return <AuthPage />;
}
