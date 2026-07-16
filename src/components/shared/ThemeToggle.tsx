'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const SETTINGS_KEY = 'scriptforge_settings';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Use resolvedTheme to determine actual visual state (handles 'system' correctly)
  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    // Determine the next explicit theme (light or dark)
    const next = isDark ? 'light' : 'dark';
    setTheme(next);

    // Sync to our localStorage so Settings page stays in sync
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.theme = next;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    } catch {}
  };

  // Avoid hydration mismatch — don't render icon until mounted
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative" aria-label="Toggle theme">
        <div className="size-4" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="relative"
        >
          {isDark ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>
        {isDark ? 'Light mode' : 'Dark mode'}
      </TooltipContent>
    </Tooltip>
  );
}