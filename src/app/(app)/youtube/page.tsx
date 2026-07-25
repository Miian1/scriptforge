'use client';

import dynamic from 'next/dynamic';

const YouTubeManager = dynamic(() => import('@/components/youtube/YouTubeManager'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading YouTube management...</div>,
});

export default function YouTubePage() {
  return <YouTubeManager />;
}
