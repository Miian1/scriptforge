'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import LandingPage from '@/components/auth/LandingPage';
import VerifyEmailPending from '@/components/auth/VerifyEmailPending';
import dynamic from 'next/dynamic';

const AppShellLazy = dynamic(() => import('@/components/layout/AppShell'), {
  ssr: false,
  loading: () => <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading workspace...</div>,
});

export default function Home() {
  const { user, checked, pendingVerificationEmail, checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Still checking session
  if (!checked) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading...</div>;
  }

  // Pending email verification (after registration, waiting for user to click email link)
  if (pendingVerificationEmail && !user) {
    return <VerifyEmailPending email={pendingVerificationEmail} onBack={() => useAuthStore.getState().setPendingVerificationEmail(null)} />;
  }

  // Not authenticated — show landing page
  if (!user) {
    return <LandingPage />;
  }

  // Authenticated — show the app
  return <AppShellLazy />;
}