import { Metadata } from 'next';
import { AuthPage } from '@/components/features/auth/auth-page';

export const metadata: Metadata = {
  title: 'NOVAMED',
};

export default function Page() {
  return <AuthPage />;
}
