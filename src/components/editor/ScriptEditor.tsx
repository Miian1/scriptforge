'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Download,
  Film,
  AlertCircle,
  RefreshCw,
  FileVideo,
  Clock,
  Loader2,
  Search,
  Users,
  BookOpen,
  Sparkles,
  Image,
  Video,
  Check,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { generateScript } from '@/lib/gemini';
import type { Scene, Project } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import SceneCard from '@/components/editor/SceneCard';
import ProjectMetaCard from '@/components/editor/ProjectMetaCard';
import ProjectScoreCard from '@/components/editor/ProjectScoreCard';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function totalDuration(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + s.estimatedDuration, 0);
}

// ---- Loading State with Stages ----
const GENERATION_STAGES = [
  { label: 'Researching topic', icon: Search, duration: 4000 },
  { label: 'Understanding audience', icon: Users, duration: 4000 },
  { label: 'Building story structure', icon: BookOpen, duration: 5000 },
  { label: 'Generating scenes', icon: Sparkles, duration: 6000 },
  { label: 'Creating production assets', icon: Image, duration: 5000 },
  { label: 'Finalizing script', icon: Video, duration: 3000 },
];

function GeneratingState({ project }: { project: Project }) {
  const [currentStage, setCurrentStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let stageIndex = 0;
    const advance = () => {
      const delay = GENERATION_STAGES[stageIndex]?.duration ?? 3000;
      const timer = setTimeout(() => {
        stageIndex++;
        if (stageIndex < GENERATION_STAGES.length) {
          setCurrentStage(stageIndex);
          advance();
        }
      }, delay);
      return () => clearTimeout(timer);
    };
    const cleanup = advance();
    return cleanup;
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4 text-center">
      {/* Central animated icon composition */}
      <div className="relative">
        {/* Orbiting rings */}
        <motion.div
          className="absolute -inset-8 rounded-full border border-primary/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -inset-14 rounded-full border border-primary/5"
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />

        {/* Orbiting dots */}
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute size-2 rounded-full bg-primary/40"
            style={{ top: '50%', left: '50%' }}
            animate={{
              x: Math.cos((i * Math.PI) / 2 + (elapsed * 0.5)) * 52,
              y: Math.sin((i * Math.PI) / 2 + (elapsed * 0.5)) * 52,
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{ duration: 6, repeat: Infinity, delay: i * 0.8 }}
          />
        ))}

        {/* Main icon with morph */}
        <motion.div
          key={currentStage}
          initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.8, opacity: 0, rotate: 20 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="relative z-10 rounded-2xl bg-primary/10 p-6"
        >
          {(() => {
            const StageIcon = GENERATION_STAGES[currentStage]?.icon ?? Sparkles;
            return (
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <StageIcon className="size-12 text-primary" />
              </motion.div>
            );
          })()}
        </motion.div>
      </div>

      {/* Title */}
      <motion.div
        className="space-y-2"
        key={`title-${currentStage}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold tracking-tight">
          Generating your script...
        </h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {GENERATION_STAGES[currentStage]?.label ?? 'Almost done...'}
        </p>
      </motion.div>

      {/* Stage progress */}
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Elapsed {formatTime(elapsed)}</span>
          <span>
            Stage {currentStage + 1} of {GENERATION_STAGES.length}
          </span>
        </div>

        {/* Stage indicators */}
        <div className="flex items-center gap-1">
          {GENERATION_STAGES.map((stage, i) => {
            const StageIcon = stage.icon;
            const isDone = i < currentStage;
            const isActive = i === currentStage;
            return (
              <motion.div
                key={i}
                className="flex-1 flex flex-col items-center gap-1.5"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: isDone || isActive ? 1 : 0.3 }}
                transition={{ duration: 0.4 }}
              >
                <div
                  className={`flex items-center justify-center rounded-full transition-colors duration-500 ${
                    isDone
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'bg-primary/15 text-primary ring-2 ring-primary/30'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <Check className="size-3.5" />
                    </motion.div>
                  ) : (
                    <StageIcon
                      className={`size-3.5 ${isActive ? 'animate-pulse' : ''}`}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] leading-tight text-center hidden sm:block ${
                    isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {stage.label.split(' ')[0]}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Animated progress bar */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/80 to-primary"
            initial={{ width: '0%' }}
            animate={{
              width: `${((currentStage + 1) / GENERATION_STAGES.length) * 100}%`,
            }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-20px', '400px'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Typing animation hint */}
      <motion.p
        className="text-xs text-muted-foreground/60 max-w-xs"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Crafting scenes with narration, image prompts &amp; animation prompts
        for &ldquo;{project.title}&rdquo;
      </motion.p>
    </div>
  );
}

// ---- Error State ----
function ErrorState({ project, onRetry }: { project: Project; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-lg mt-12"
    >
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6 text-center space-y-4">
        <AlertCircle className="size-10 text-destructive mx-auto" />
        <div>
          <h3 className="font-semibold text-lg">Generation Failed</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Something went wrong while generating the script for &ldquo;{project.title}&rdquo;.
            Please check your API key and try again.
          </p>
        </div>
        <Button variant="destructive" onClick={onRetry} className="gap-2">
          <RefreshCw className="size-4" />
          Retry Generation
        </Button>
      </div>
    </motion.div>
  );
}

// ---- Empty State ----
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4"
    >
      <FileVideo className="size-12 text-muted-foreground/40" />
      <div className="space-y-1">
        <h3 className="font-semibold text-lg text-muted-foreground">
          No scenes yet
        </h3>
        <p className="text-sm text-muted-foreground/70 max-w-sm">
          Generate a script using AI or add scenes manually to get started.
        </p>
      </div>
    </motion.div>
  );
}

// ---- Status badge variant ----
function getStatusVariant(status: Project['status']) {
  switch (status) {
    case 'generating':
      return 'default' as const;
    case 'completed':
      return 'default' as const;
    case 'error':
      return 'destructive' as const;
    case 'draft':
    default:
      return 'secondary' as const;
  }
}

// ---- Main ScriptEditor ----
export default function ScriptEditor() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const scenes = useAppStore((s) => s.scenes);
  const loadScenes = useAppStore((s) => s.loadScenes);
  const addScene = useAppStore((s) => s.addScene);
  const reorderScenes = useAppStore((s) => s.reorderScenes);
  const updateProject = useAppStore((s) => s.updateProject);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const generatingProjectId = useAppStore((s) => s.generatingProjectId);
  const setGeneratingProjectId = useAppStore((s) => s.setGeneratingProjectId);
  const router = useRouter();

  const listEndRef = useRef<HTMLDivElement>(null);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;

  // Load scenes on mount
  useEffect(() => {
    if (activeProjectId) {
      loadScenes(activeProjectId);
    }
  }, [activeProjectId, loadScenes]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(scenes, oldIndex, newIndex);
      reorderScenes(reordered);
    },
    [scenes, reorderScenes]
  );

  // Add new scene
  const handleAddScene = useCallback(async () => {
    if (!project) return;
    const now = Date.now();
    const newScene: Scene = {
      id: uuidv4(),
      projectId: project.id,
      sceneNumber: scenes.length + 1,
      title: 'New Scene',
      estimatedDuration: 30,
      goal: '',
      narration: '',
      imagePrompt: '',
      animationPrompt: '',
      notes: {
        emotion: '',
        visualFocus: '',
        transitionSuggestion: '',
        importantDetails: '',
      },
      createdAt: now,
      updatedAt: now,
    };
    await addScene(newScene);

    // Scroll to new scene
    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });

    toast.success('Scene added');
  }, [project, scenes.length, addScene]);

  // Export all as JSON
  const handleExport = useCallback(() => {
    if (!project || scenes.length === 0) return;
    const exportData = {
      project: {
        title: project.title,
        topic: project.topic,
        description: project.description,
        settings: project.settings,
        exportedAt: new Date().toISOString(),
      },
      scenes: scenes
        .sort((a, b) => a.sceneNumber - b.sceneNumber)
        .map((s) => ({
          sceneNumber: s.sceneNumber,
          title: s.title,
          estimatedDuration: s.estimatedDuration,
          goal: s.goal,
          narration: s.narration,
          imagePrompt: s.imagePrompt,
          animationPrompt: s.animationPrompt,
          notes: s.notes,
        })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_script.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Script exported');
  }, [project, scenes]);

  // Retry generation
  const handleRetry = useCallback(async () => {
    if (!project) return;

    setGeneratingProjectId(project.id);
    await updateProject(project.id, { status: 'generating' });

    try {
      const { scenes: newScenes, metadata } = await generateScript(project);
      // Replace scenes
      for (const scene of newScenes) {
        await addScene(scene);
      }
      // Save AI-generated metadata
      await updateProject(project.id, {
        description: metadata.videoDescription || project.description || '',
        thumbnailPrompt: metadata.thumbnailPrompt || '',
        tags: metadata.tags || [],
      });
      await updateProject(project.id, { status: 'completed' });
      toast.success('Script generated successfully!');
      // Reload scenes
      await loadScenes(project.id);
    } catch (err) {
      await updateProject(project.id, { status: 'error' });
      toast.error((err as Error).message || 'Generation failed');
    } finally {
      setGeneratingProjectId(null);
    }
  }, [project, addScene, updateProject, loadScenes, setGeneratingProjectId]);

  // Back to dashboard
  const handleBack = useCallback(() => {
    setActiveProjectId(null);
    router.push('/dashboard');
  }, [setActiveProjectId, router]);

  // ---- Render ----
  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const isGenerating = project.status === 'generating' || generatingProjectId === project.id;
  const isError = project.status === 'error' && !isGenerating;
  const total = totalDuration(scenes);

  return (
    <div className="flex flex-col min-h-full">
      {/* ---- HEADER ---- */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Back button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={handleBack}
              >
                <ArrowLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Dashboard</TooltipContent>
          </Tooltip>

          {/* Project title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">
              {project.title}
            </h1>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              {project.topic}
            </p>
          </div>

          {/* Status badge */}
          <Badge variant={getStatusVariant(project.status)} className="shrink-0">
            {isGenerating && <Loader2 className="size-3 mr-1 animate-spin" />}
            {STATUS_LABELS[project.status]}
          </Badge>

          {/* Stats */}
          {scenes.length > 0 && !isGenerating && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-1">
                <FileVideo className="size-3.5" />
                {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatDuration(total)}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {!isGenerating && (
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddScene}
                    className="gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span className="hidden sm:inline">Add Scene</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add a new scene</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={scenes.length === 0}
                    className="gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export script as JSON</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </header>

      {/* ---- CONTENT ---- */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Generating state */}
        {isGenerating && <GeneratingState project={project} />}

        {/* Error state */}
        {isError && <ErrorState project={project} onRetry={handleRetry} />}

        {/* Scene list */}
        {!isGenerating && !isError && (
          <>
            {scenes.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Fixed metadata & score cards — not part of DnD */}
                <div className="space-y-4 mb-6">
                  <ProjectMetaCard project={project} />
                  <ProjectScoreCard project={project} />
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={scenes.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      <AnimatePresence mode="popLayout">
                        {scenes.map((scene) => (
                          <SceneCard
                            key={scene.id}
                            scene={scene}
                            project={project}
                            totalScenes={scenes.length}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}

            {/* Add scene button at bottom */}
            {scenes.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-6 flex justify-center"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddScene}
                  className="gap-1.5 text-muted-foreground"
                >
                  <Plus className="size-3.5" />
                  Add Scene
                </Button>
              </motion.div>
            )}

            {/* Scroll anchor */}
            <div ref={listEndRef} />
          </>
        )}
      </main>
    </div>
  );
}