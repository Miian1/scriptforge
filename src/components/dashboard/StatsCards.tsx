'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, CheckCircle2, FileEdit, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';

interface Stats {
  total: number;
  completed: number;
  draft: number;
  error: number;
}

const statCards = [
  {
    key: 'total' as const,
    label: 'Total Projects',
    icon: FolderOpen,
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'completed' as const,
    label: 'Completed',
    icon: CheckCircle2,
    bgColor: 'bg-emerald-100 dark:bg-emerald-950',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'draft' as const,
    label: 'Drafts',
    icon: FileEdit,
    bgColor: 'bg-amber-100 dark:bg-amber-950',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'error' as const,
    label: 'Errors',
    icon: AlertCircle,
    bgColor: 'bg-red-100 dark:bg-red-950',
    iconColor: 'text-red-600 dark:text-red-400',
  },
];

export default function StatsCards() {
  const projects = useAppStore((s) => s.projects);

  const stats: Stats = {
    total: projects.length,
    completed: projects.filter((p) => p.status === 'completed').length,
    draft: projects.filter((p) => p.status === 'draft').length,
    error: projects.filter((p) => p.status === 'error').length,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card, index) => {
        const Icon = card.icon;
        const value = stats?.[card.key] ?? 0;

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            <Card className="h-full">
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full ${card.bgColor}`}
                >
                  <Icon className={`size-5 ${card.iconColor}`} />
                </div>
                <div className="min-w-0">
                    <p className="text-2xl font-bold leading-tight tracking-tight">
                      {value}
                    </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {card.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}