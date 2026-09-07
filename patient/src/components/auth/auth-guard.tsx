'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/use-auth-store';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const didStart = useRef(false);
  const didRedirect = useRef(false);

  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;

    void useAuthStore
      .getState()
      .initSession()
      .then((isAuthenticated) => {
        if (isAuthenticated) {
          setIsReady(true);
          return;
        }

        if (!didRedirect.current) {
          didRedirect.current = true;
          router.replace('/');
        }
      });
  }, [router]);

  if (!isReady) return null;

  return children;
}
