'use client';

import { useEffect } from 'react';
import useAuth from '@/hooks/useAuth';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const loadUser = useAuth((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return <>{children}</>;
}
