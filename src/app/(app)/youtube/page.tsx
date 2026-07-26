'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { Loader2 } from 'lucide-react';

const YouTubeManager = dynamic(() => import('@/components/youtube/YouTubeManager'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading YouTube management...</div>,
});

export default function YouTubePage() {
  const router = useRouter();
  const { tools, loadTools, toolsLoaded } = useAppStore();
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'admin';

  // Fetch tools config
  useEffect(() => { loadTools(); }, [loadTools]);

  // Redirect to dashboard if YouTube tool is disabled — but admins can always access the page
  useEffect(() => {
    if (toolsLoaded && tools && !tools.youtube && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [toolsLoaded, tools, router, isAdmin]);

  // Show loading while checking
  if (!toolsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render if disabled (non-admins only — admins bypass)
  if (toolsLoaded && tools && !tools.youtube && !isAdmin) return null;

  // Don't render while loading (prevents flash of YouTube page)
  if (!toolsLoaded || !tools) return null;

  return <YouTubeManager />;
}
