'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeProvider, useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { useIsMobile } from '@/hooks/use-mobile';
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';
import { Toaster } from '@/components/ui/sonner';

// Sync saved theme from localStorage to next-themes on mount
function ThemeSync() {
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      const raw = localStorage.getItem('scriptforge_settings');
      if (raw) {
        const { theme } = JSON.parse(raw);
        if (theme && ['light', 'dark', 'system'].includes(theme)) {
          setTheme(theme);
        }
      }
    } catch {}
  }, [setTheme]);
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, checked, checkSession } = useAuthStore();
  const loadProjects = useAppStore((s) => s.loadProjects);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const isMobile = useIsMobile();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (checked && !user) {
      router.push('/');
    }
  }, [checked, user, router]);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user, loadProjects]);

  // Hide header on editor pages
  const isEditor = pathname.startsWith('/project/');

  if (!checked) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="relative min-h-screen">
        <ThemeSync />
        <AppSidebar />

        <div
          className={cn(
            'flex min-h-screen flex-col',
            'transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            isMobile && 'pb-20',
            !isMobile && (sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-[256px]')
          )}
        >
          {!isEditor && <AppHeader />}
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>

        <Toaster position="bottom-right" richColors />
      </div>
    </ThemeProvider>
  );
}