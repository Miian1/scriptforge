'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import LandingPage from '@/components/auth/LandingPage';
import VerifyEmailPending from '@/components/auth/VerifyEmailPending';

export default function Home() {
  const router = useRouter();
  const { user, checked, pendingVerificationEmail, checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (checked && user) {
      router.push('/dashboard');
    }
  }, [checked, user, router]);

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

  // Authenticated — redirecting to /dashboard (handled by useEffect above)
  return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading...</div>;
}