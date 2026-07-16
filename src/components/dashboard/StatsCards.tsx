'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, CheckCircle2, Sparkles, Infinity, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { PLAN_LIMITS } from '@/lib/usage';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function StatsCards() {
  const projects = useAppStore((s) => s.projects);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const isPro = user?.plan === 'pro';
  const plan = user?.plan || 'free';
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  const usage = user?.dailyUsage;

  const completed = projects.filter((p) => p.status === 'completed').length;
  const drafts = projects.filter((p) => p.status === 'draft').length;

  const projectsLeft = isPro
    ? null
    : Math.max(0, limits.projectsPerDay - (usage?.projectsCreated ?? 0));
  const aiLeft = Math.max(0, limits.aiGenerationsPerDay - (usage?.aiGenerations ?? 0));
  const projectPercent = isPro ? 100 : Math.min(100, ((usage?.projectsCreated ?? 0) / limits.projectsPerDay) * 100);
  const aiPercent = Math.min(100, ((usage?.aiGenerations ?? 0) / limits.aiGenerationsPerDay) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Left: Project Stats ── */}
      <Card className="h-full">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
            <FolderOpen className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold leading-tight tracking-tight">{projects.length}</p>
              <span className="text-xs text-muted-foreground">total</span>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-500 font-medium">{completed} done</span>
              <span className="mx-1">·</span>
              <span className="text-amber-500 font-medium">{drafts} drafts</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Center: Daily Projects Left ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <Card className="h-full">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950">
                  {isPro ? (
                    <Infinity className="size-4 text-violet-600 dark:text-violet-400" />
                  ) : (
                    <FolderOpen className="size-4 text-violet-600 dark:text-violet-400" />
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Projects Today
                  </p>
                  <p className="text-lg font-bold leading-tight">
                    {isPro ? (
                      <span className="text-violet-600 dark:text-violet-400">Unlimited</span>
                    ) : (
                      <>
                        {projectsLeft}{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          / {limits.projectsPerDay}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              {!isPro && projectsLeft === 0 && (
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
            {!isPro && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    projectPercent >= 100 ? 'bg-red-500' : projectPercent >= 70 ? 'bg-amber-500' : 'bg-violet-500'
                  )}
                  style={{ width: `${projectPercent}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Right: AI Generations Left ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
      >
        <Card className="h-full">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    AI Generations Today
                  </p>
                  <p className="text-lg font-bold leading-tight">
                    {isPro ? (
                      <>
                        {aiLeft}{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          / {limits.aiGenerationsPerDay}
                        </span>
                      </>
                    ) : (
                      <>
                        {aiLeft}{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          / {limits.aiGenerationsPerDay}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              {!isPro && aiLeft === 0 && (
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
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  aiPercent >= 100 ? 'bg-red-500' : aiPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${aiPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}