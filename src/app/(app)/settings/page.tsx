'use client';

import dynamic from 'next/dynamic';

const Settings = dynamic(() => import('@/components/settings/Settings'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading settings...</div>,
});

export default function SettingsPage() {
  return <Settings />;
}