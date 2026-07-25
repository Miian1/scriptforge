'use client';

import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

import StatsCards from '@/components/dashboard/StatsCards';

export default function Dashboard() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your ScriptForge overview at a glance
          </p>
        </div>
        <Button
          onClick={() => router.push('/create-project')}
          className="shrink-0 gap-2"
        >
          <Sparkles className="size-4" />
          Create Project
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Stats Cards — full width */}
      <StatsCards />
    </div>
  );
}
