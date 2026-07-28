'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  Sparkles,
  ArrowRight,
  Crown,
  Flame,
  CalendarClock,
  Coins,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// ── SVG Background Graphs ─────────────────────────────

/** Smooth sparkline from data points — curves upward */
function AreaSparkline({
  points,
  color,
  className,
}: {
  points: number[];
  color: string;
  className?: string;
}) {
  const w = 120;
  const h = 60;
  const max = Math.max(...points, 1);
  const step = w / Math.max(points.length - 1, 1);

  const coords = points.map((v, i) => ({
    x: Math.round(i * step),
    y: Math.round(h - (v / max) * (h - 4) - 2),
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn('pointer-events-none', className)}
    >
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

/** Vertical bar chart */
function BarChart({
  values,
  color,
  className,
}: {
  values: number[];
  color: string;
  className?: string;
}) {
  const max = Math.max(...values, 1);
  const barW = 8;
  const gap = 4;
  const totalW = values.length * (barW + gap) - gap;
  const h = 56;

  return (
    <svg
      viewBox={`0 0 ${totalW + 16} ${h + 8}`}
      preserveAspectRatio="none"
      className={cn('pointer-events-none', className)}
    >
      {values.map((v, i) => {
        const barH = Math.max(2, (v / max) * h);
        const x = i * (barW + gap) + 8;
        const y = h + 8 - barH;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={3}
            fill={color}
            opacity={0.18 + (v / max) * 0.22}
          />
        );
      })}
    </svg>
  );
}

/** Circular gauge arc */
function GaugeArc({
  percent,
  color,
  className,
}: {
  percent: number;
  color: string;
  className?: string;
}) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percent, 1) * 0.75); // max 270°

  return (
    <svg
      viewBox={`0 0 ${r * 2 + 16} ${r * 2 + 16}`}
      className={cn('pointer-events-none', className)}
    >
      <circle
        cx={r + 8}
        cy={r + 8}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        opacity={0.08}
        strokeDasharray={circ}
        strokeLinecap="round"
      />
      <circle
        cx={r + 8}
        cy={r + 8}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        opacity={0.3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${r + 8} ${r + 8})`}
      />
    </svg>
  );
}

/** Horizontal wave / sine pattern */
function WavePattern({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 60"
      preserveAspectRatio="none"
      className={cn('pointer-events-none', className)}
    >
      {[0, 12, 24].map((dy) => (
        <path
          key={dy}
          d={`M0,${30 + dy} C20,${20 + dy} 40,${40 + dy} 60,${30 + dy} S100,${20 + dy} 120,${30 + dy} S160,${40 + dy} 180,${30 + dy}`}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity={0.1 + dy * 0.03}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────

export default function StatsCards() {
  const projects = useAppStore((s) => s.projects);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const isPro = user?.plan === 'pro';
  const planDaysLeft = user?.planDaysLeft ?? 0;

  // Credits state from auth store
  const creditsBalance = user?.credits?.balance ?? 0;
  const creditsTotal = user?.credits?.totalAvailable ?? 0;
  const creditsDailyLimit = user?.credits?.dailyLimit ?? 30;
  const creditsLifetimeUsed = user?.credits?.lifetimeUsed ?? 0;
  const isStaff = user?.credits?.isStaff ?? false;

  const completed = projects.filter((p) => p.status === 'completed').length;
  const drafts = projects.filter((p) => p.status === 'draft').length;
  const createdToday = user?.dailyUsage?.projectsCreated ?? 0;

  // Credits remaining (handle -1 sentinel for staff)
  const displayBalance = isStaff ? Infinity : creditsBalance;
  const displayLimit = isStaff ? Infinity : (isPro ? 8000 : creditsDailyLimit);
  const creditPercent = isStaff ? 100 : (displayLimit > 0 ? Math.min(100, (creditsBalance / displayLimit) * 100) : 0);
  const creditRemaining = isStaff ? 'Unlimited' : String(creditsBalance);

  // Generate deterministic fake "trend" data for the SVG backgrounds
  const projectTrend = useMemo(() => {
    if (projects.length === 0) return [1, 2, 3, 4, 5];
    return Array.from({ length: 7 }, (_, i) =>
      Math.max(1, projects.length - 6 + i + Math.floor(Math.random() * 3))
    );
  }, [projects.length]);

  const barData = useMemo(
    () =>
      Array.from({ length: 8 }, () =>
        Math.max(2, Math.floor(Math.random() * 10 + createdToday))
      ),
    [createdToday],
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* ── Card 1: Total Projects ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
      >
        <Card className="relative h-full overflow-hidden">
          {/* Background graph */}
          <div className="absolute bottom-0 right-0 w-[140px] h-[70px]">
            <AreaSparkline points={projectTrend} color="#3b82f6" className="w-full h-full" />
          </div>
          <CardContent className="relative flex items-center gap-4 p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <FolderOpen className="size-5 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold leading-tight tracking-tight">{projects.length}</p>
                <span className="text-xs text-muted-foreground">projects</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-emerald-500 font-medium">{completed} done</span>
                <span className="mx-1">&middot;</span>
                <span className="text-amber-500 font-medium">{drafts} drafts</span>
                <span className="mx-1">&middot;</span>
                <span className="text-blue-500 font-medium flex items-center gap-0.5">
                  <Flame className="size-3" />
                  {createdToday} today
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Card 2: Created Today ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <Card className="relative h-full overflow-hidden">
          {/* Background graph */}
          <div className="absolute bottom-0 right-0 w-[110px] h-[64px]">
            <BarChart values={barData} color="#8b5cf6" className="w-full h-full" />
          </div>
          <CardContent className="relative p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                  <Flame className="size-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Created Today
                  </p>
                  <p className="text-lg font-bold leading-tight">
                    {createdToday}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Card 3: Credits Balance ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <Card className="relative h-full overflow-hidden">
          {/* Background graph */}
          <div className="absolute bottom-0 right-0 w-[130px] h-[64px]">
            <AreaSparkline
              points={Array.from({ length: 6 }, (_, i) =>
                Math.max(1, Math.floor(displayBalance * (1 - (i / 5) * 0.8) + Math.random() * 3))
              )}
              color="#10b981"
              className="w-full h-full"
            />
          </div>
          <CardContent className="relative p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Coins className="size-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Credits
                  </p>
                  <p className="text-lg font-bold leading-tight">
                    {isStaff ? (
                      <span className="text-emerald-500">Unlimited</span>
                    ) : (
                      <>
                        {creditRemaining}
                        {!isPro && (
                          <span className="text-sm font-normal text-muted-foreground"> / {displayLimit}</span>
                        )}
                      </>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isStaff ? 'Staff bypass' : isPro ? `${creditsLifetimeUsed} used total` : `${creditsBalance} remaining today`}
                  </p>
                </div>
              </div>
              {!isStaff && creditsBalance <= 3 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => router.push('/plans')}
                >
                  Upgrade
                  <ArrowRight className="size-3" />
                </Button>
              )}
            </div>
            {!isStaff && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    creditPercent >= 100
                      ? 'bg-emerald-500'
                      : creditPercent >= 70
                        ? 'bg-emerald-500'
                        : creditPercent >= 30
                          ? 'bg-amber-500'
                          : 'bg-red-500',
                  )}
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Card 4: Current Plan ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
      >
        <Card className="relative h-full overflow-hidden">
          {/* Background graph */}
          <div className="absolute bottom-0 right-0 w-[76px] h-[76px]">
            <GaugeArc
              percent={isPro ? (planDaysLeft > 0 ? Math.min(planDaysLeft / 30, 1) : 1) : 0}
              color="#f59e0b"
              className="w-full h-full"
            />
          </div>
          <div className="absolute bottom-0 left-0 w-[130px] h-[50px]">
            <WavePattern color="#f59e0b" className="w-full h-full" />
          </div>
          <CardContent className="relative flex items-center gap-4 p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Crown className="size-5 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Current Plan
              </p>
              <p className="text-lg font-bold leading-tight capitalize">
                {isPro ? 'Pro' : 'Free'}
              </p>
              {isPro && planDaysLeft > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <CalendarClock className="size-3" />
                  <span className="font-medium text-amber-500">{planDaysLeft}</span> days left
                </p>
              )}
            </div>
            {!isPro && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1 shrink-0"
                onClick={() => router.push('/plans')}
              >
                Upgrade
                <ArrowRight className="size-3" />
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
