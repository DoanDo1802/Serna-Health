import { Metadata } from 'next';
import { SidebarNavPreview } from '@/components/layout/sidebar-nav';

export const metadata: Metadata = {
  title: 'Dashboard | PatientCare',
  description: 'Hospital Management Dashboard',
};

export default function DashboardPage() {
  return <SidebarNavPreview />;
}
