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

// Sync saved theme from localStorage to next-themes on mount,
// and keep localStorage in sync when theme changes externally (e.g. header toggle)
function ThemeSync() {
  const { setTheme, theme } = useTheme();
  useEffect(() => {
    // On mount: read from localStorage → apply to next-themes
    try {
      const raw = localStorage.getItem('scriptforge_settings');
      if (raw) {
        const { theme: savedTheme } = JSON.parse(raw);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setTheme(savedTheme);
        }
      }
    } catch {}
  }, [setTheme]);

  // Keep localStorage in sync whenever next-themes changes
  useEffect(() => {
    if (!theme) return;
    try {
      const raw = localStorage.getItem('scriptforge_settings');
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed.theme !== theme) {
        parsed.theme = theme;
        localStorage.setItem('scriptforge_settings', JSON.stringify(parsed));
      }
    } catch {}
  }, [theme]);

  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, checked, checkSession } = useAuthStore();
  const loadProjects = useAppStore((s) => s.loadProjects);
  const loadTools = useAppStore((s) => s.loadTools);
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
      loadTools();
    }
  }, [user, loadProjects, loadTools]);

  // Hide header + sidebar on detail/editor pages for full-screen experience
  const isFullscreen = pathname.startsWith('/project/') || pathname.startsWith('/video/');
  const isEditor = isFullscreen;

  if (!checked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-[-8px] rounded-2xl bg-primary/10 animate-ping" />
            <img src="/logo.svg" alt="ScriptForge" className="relative size-16 rounded-xl animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-foreground animate-pulse">ScriptForge</span>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <span className="size-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      </div>
    );
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
        {!isFullscreen && <AppSidebar />}

        <div
          className={cn(
            'flex min-h-screen flex-col',
            'transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            isMobile && 'pb-20',
            isFullscreen && 'pb-0',
            !isMobile && !isFullscreen && (sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-[256px]')
          )}
        >
          {!isEditor && <AppHeader />}
          <main className={cn('flex-1', isFullscreen ? '' : 'p-4 md:p-6')}>
            {children}
          </main>
        </div>

        <Toaster position="bottom-right" richColors />
      </div>
    </ThemeProvider>
  );
}