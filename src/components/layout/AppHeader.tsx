'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/shared/ThemeToggle';
import NotificationBell from '@/components/layout/NotificationBell';

export default function AppHeader() {
  const { setSidebarOpen } = useAppStore();
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      {/* Mobile: hamburger menu */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      )}

      <div className="flex-1" />

      {/* Notification bell */}
      <NotificationBell />

      {/* Theme toggle */}
      <ThemeToggle />
    </header>
  );
}
