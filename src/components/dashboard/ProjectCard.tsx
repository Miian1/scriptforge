'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { MoreHorizontal, Pencil, Copy, Trash2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useAppStore } from '@/lib/store';
import { STATUS_LABELS, THEME_LABELS, DURATION_LABELS } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import type { Project, GenerationStatus } from '@/lib/types';

const statusBadge: Record<
  GenerationStatus,
  { variant: 'default' | 'secondary' | 'outline' | 'destructive'; pulse: boolean }
> = {
  completed: { variant: 'default', pulse: false },
  generating: { variant: 'secondary', pulse: true },
  draft: { variant: 'outline', pulse: false },
  error: { variant: 'destructive', pulse: false },
};

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const removeProject = useAppStore((s) => s.removeProject);
  const updateProject = useAppStore((s) => s.updateProject);
  const addProject = useAppStore((s) => s.addProject);

  const badge = statusBadge[project.status];

  function handleOpen() {
    setActiveProjectId(project.id);
    setCurrentView('editor');
  }

  function handleRename() {
    const newTitle = window.prompt('Rename project:', project.title);
    if (newTitle && newTitle.trim()) {
      updateProject(project.id, { title: newTitle.trim() });
    }
  }

  async function handleDuplicate() {
    const now = Date.now();
    const newProject: Project = {
      id: uuidv4(),
      title: `${project.title} (Copy)`,
      topic: project.topic,
      description: project.description,
      settings: { ...project.settings },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await addProject(newProject);
  }

  async function handleDelete() {
    setDeleteOpen(false);
    await removeProject(project.id);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
        className="group"
      >
        <Card className="h-full flex flex-col transition-colors hover:border-foreground/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base font-semibold leading-snug truncate flex-1">
                {project.title}
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Project actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRename}>
                    <Pencil className="size-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="size-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardDescription className="line-clamp-1">
              {project.topic}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 space-y-3 pb-3">
            <Badge
              variant={badge.variant}
              className={badge.pulse ? 'animate-pulse' : ''}
            >
              {STATUS_LABELS[project.status]}
            </Badge>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{THEME_LABELS[project.settings.theme]}</span>
              <span>·</span>
              <span>{DURATION_LABELS[project.settings.duration]}</span>
            </div>
          </CardContent>

          <CardFooter className="pt-3 border-t flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
            </span>
            <Button size="sm" onClick={handleOpen} className="shrink-0">
              Open
            </Button>
          </CardFooter>
        </Card>
      </motion.div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </>
  );
}