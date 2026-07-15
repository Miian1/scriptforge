'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { Menu, Search } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ThemeToggle from '@/components/shared/ThemeToggle';

export default function AppHeader() {
  const { setSidebarOpen, searchAndSetProjects } = useAppStore();

  const isMobile = useIsMobile();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        searchAndSetProjects(query);
      }, 300);
    },
    [searchAndSetProjects]
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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

      {/* Search (non-mobile) */}
      {!isMobile && (
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects..."
            className="pl-9 h-9 bg-muted/50"
            onChange={handleSearchChange}
          />
        </div>
      )}

      <div className="flex-1" />

      {/* Theme toggle */}
      <ThemeToggle />
    </header>
  );
}