'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Film, ArrowUpDown, FolderOpen, CheckCircle2, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import ProjectCard from '@/components/dashboard/ProjectCard';
import type { Project } from '@/lib/types';

type SortOption = 'recent' | 'oldest' | 'az' | 'za';

function sortProjects(projects: Project[], sort: SortOption): Project[] {
  const sorted = [...projects];
  switch (sort) {
    case 'recent':
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'oldest':
      return sorted.sort((a, b) => a.updatedAt - b.updatedAt);
    case 'az':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'za':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    default:
      return sorted;
  }
}

// ── Project Stats (inline) ────────────────────────────

const projectStats = [
  { key: 'total', label: 'Total Projects', icon: FolderOpen, bg: 'bg-blue-100 dark:bg-blue-950', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, bg: 'bg-emerald-100 dark:bg-emerald-950', color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'draft', label: 'Drafts', icon: FileEdit, bg: 'bg-amber-100 dark:bg-amber-950', color: 'text-amber-600 dark:text-amber-400' },
];

function ProjectStats({ projects }: { projects: Project[] }) {
  const counts = {
    total: projects.length,
    completed: projects.filter((p) => p.status === 'completed').length,
    draft: projects.filter((p) => p.status === 'draft').length,
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {projectStats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
          >
            <Card className="h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${stat.bg}`}>
                  <Icon className={`size-4 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-tight">{counts[stat.key as keyof typeof counts]}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Projects Page ─────────────────────────────────────

export default function ProjectsPage() {
  const projects = useAppStore((s) => s.projects);
  const router = useRouter();
  const [sort, setSort] = useState<SortOption>('recent');

  const sortedProjects = useMemo(
    () => sortProjects(projects, sort),
    [projects, sort]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your video script projects
          </p>
        </div>
        <Button
          onClick={() => router.push('/create-project')}
          className="shrink-0"
        >
          <Plus className="size-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Project Stats */}
      <ProjectStats projects={projects} />

      <Separator />

      {/* Projects Grid */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold">
            All Projects
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({projects.length})
            </span>
          </h2>

          {projects.length > 0 && (
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as SortOption)}
            >
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Edited</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="az">A-Z</SelectItem>
                <SelectItem value="za">Z-A</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No projects yet"
            description="Create your first video script project"
            action={
              <Button onClick={() => router.push('/create-project')}>
                <Plus className="size-4 mr-2" />
                Create Project
              </Button>
            }
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.06 },
              },
            }}
          >
            {sortedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}