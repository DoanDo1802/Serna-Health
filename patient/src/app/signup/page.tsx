import { Metadata } from 'next';
import { AuthPage } from '@/components/features/auth/auth-page';

export const metadata: Metadata = {
  title: 'Đăng Ký Tài Khoản | Bệnh Viện Quốc Tế',
  description: 'Đăng ký tài khoản bệnh nhân để đặt lịch khám và tra cứu kết quả xét nghiệm.',
};

export default function Page() {
  return <AuthPage />;
}
