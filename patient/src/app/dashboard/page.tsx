import { Metadata } from 'next';
import { GeminiDashboard } from '@/components/layout/gemini-dashboard';

export const metadata: Metadata = {
  title: 'NOVAMED',
  description: 'Cổng thông tin bệnh nhân và trợ lý AI y tế NOVAMED',
};

export default function DashboardPage() {
  return <GeminiDashboard />;
}
