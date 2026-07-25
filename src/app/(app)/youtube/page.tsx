'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';

const YouTubeManager = dynamic(() => import('@/components/youtube/YouTubeManager'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading YouTube management...</div>,
});

export default function YouTubePage() {
  const router = useRouter();
  const { tools, loadTools, toolsLoaded } = useAppStore();

  // Fetch tools config
  useEffect(() => { loadTools(); }, [loadTools]);

  // Redirect to dashboard if YouTube tool is disabled
  useEffect(() => {
    if (toolsLoaded && !tools.youtube) {
      router.replace('/dashboard');
    }
  }, [toolsLoaded, tools.youtube, router]);

  // Show loading while checking
  if (!toolsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render if disabled
  if (!tools.youtube) return null;

  return <YouTubeManager />;
}
