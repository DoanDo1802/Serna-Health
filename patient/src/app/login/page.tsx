import { Metadata } from 'next';
import { AuthPage } from '@/components/features/auth/auth-page';

export const metadata: Metadata = {
  title: 'Đăng Nhập | Bệnh Viện Quốc Tế',
  description: 'Đăng nhập vào cổng thông tin sức khỏe bệnh viện quốc tế.',
};

export default function Page() {
  return <AuthPage />;
}
