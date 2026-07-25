'use client';

import React from 'react';

import StatsCards from '@/components/dashboard/StatsCards';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your ScriptForge overview at a glance
        </p>
      </div>

      {/* Stats Cards — full width */}
      <StatsCards />
    </div>
  );
}
