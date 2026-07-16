'use client';

import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/dashboard/Dashboard'), {
  ssr: false,
  loading: () => <div className="p-8 text-muted-foreground">Loading dashboard...</div>,
});

export default function DashboardPage() {
  return <Dashboard />;
}