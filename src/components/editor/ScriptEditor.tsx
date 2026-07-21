'use client';

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
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
  Layers,
  Zap,
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
import { generatePhase, generateScript } from '@/lib/gemini';
import type { Scene, Project } from '@/lib/types';
import { STATUS_LABELS, SCENES_PER_PHASE } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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

function GeneratingState({ project, phaseLabel }: { project: Project; phaseLabel: string }) {
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
      <div className="relative">
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

      <motion.div
        className="space-y-2"
        key={`title-${currentStage}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold tracking-tight">
          Generating {phaseLabel}...
        </h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {GENERATION_STAGES[currentStage]?.label ?? 'Almost done...'}
        </p>
      </motion.div>

      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Elapsed {formatTime(elapsed)}</span>
          <span>Stage {currentStage + 1} of {GENERATION_STAGES.length}</span>
        </div>
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
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <Check className="size-3.5" />
                    </motion.div>
                  ) : (
                    <StageIcon className={`size-3.5 ${isActive ? 'animate-pulse' : ''}`} />
                  )}
                </div>
                <span className={`text-[10px] leading-tight text-center hidden sm:block ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {stage.label.split(' ')[0]}
                </span>
              </motion.div>
            );
          })}
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/80 to-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStage + 1) / GENERATION_STAGES.length) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-20px', '400px'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>

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

// ---- Phase Progress Bar ----
function PhaseProgressBar({
  currentPhase,
  totalPhases,
  scenesGenerated,
  totalScenes,
}: {
  currentPhase: number;
  totalPhases: number;
  scenesGenerated: number;
  totalScenes: number;
}) {
  const pct = totalScenes > 0 ? Math.round((scenesGenerated / totalScenes) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Phase {currentPhase} of {totalPhases}
        </span>
        <span className="font-medium">{scenesGenerated}/{totalScenes} scenes ({pct}%)</span>
      </div>
      <Progress value={pct} className="h-2" />
      {/* Phase dots */}
      <div className="flex items-center gap-1.5 justify-center">
        {Array.from({ length: totalPhases }).map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i + 1 < currentPhase
                ? 'w-6 bg-primary'
                : i + 1 === currentPhase
                  ? 'w-6 bg-primary/60 animate-pulse'
                  : 'w-2 bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Main ScriptEditor ----
export default function ScriptEditor() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const scenes = useAppStore((s) => s.scenes);
  const addScene = useAppStore((s) => s.addScene);
  const addScenes = useAppStore((s) => s.addScenes);
  const loadScenes = useAppStore((s) => s.loadScenes);
  const reorderScenes = useAppStore((s) => s.reorderScenes);
  const updateProject = useAppStore((s) => s.updateProject);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const generatingProjectId = useAppStore((s) => s.generatingProjectId);
  const setGeneratingProjectId = useAppStore((s) => s.setGeneratingProjectId);
  const router = useRouter();

  const listEndRef = useRef<HTMLDivElement>(null);

  // Local generating state for phases
  const [isGeneratingPhase, setIsGeneratingPhase] = useState(false);
  const [generatingPhaseLabel, setGeneratingPhaseLabel] = useState('');

  const project = projects.find((p) => p.id === activeProjectId) ?? null;

  // Computed phase info from project settings
  const totalScenes = project?.settings?.totalScenes || 60;
  const scenesPerPhase = project?.settings?.scenesPerPhase || SCENES_PER_PHASE;
  const totalPhases = Math.ceil(totalScenes / scenesPerPhase);
  const currentPhaseNumber = Math.min(
    Math.ceil(scenes.length / scenesPerPhase) + (scenes.length % scenesPerPhase === 0 ? 0 : 1),
    totalPhases
  );
  // Actually: how many full phases are done?
  const completedPhases = Math.floor(scenes.length / scenesPerPhase);
  const isOnPartialPhase = scenes.length % scenesPerPhase !== 0;
  const activePhaseNum = isOnPartialPhase ? completedPhases + 1 : completedPhases;
  const allPhasesDone = scenes.length >= totalScenes;
  const hasNextPhase = !allPhasesDone && scenes.length > 0;
  const nextPhaseNumber = hasNextPhase
    ? (scenes.length % scenesPerPhase === 0
        ? scenes.length / scenesPerPhase + 1
        : Math.floor(scenes.length / scenesPerPhase) + 1)
    : 0;

  // Group scenes into phases for display
  const phases = useMemo(() => {
    const grouped: { phase: number; scenes: Scene[] }[] = [];
    const sorted = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
    for (let i = 0; i < sorted.length; i++) {
      const phaseNum = Math.floor(sorted[i].sceneNumber / scenesPerPhase) + 1;
      const lastGroup = grouped[grouped.length - 1];
      if (lastGroup && lastGroup.phase === phaseNum) {
        lastGroup.scenes.push(sorted[i]);
      } else {
        grouped.push({ phase: phaseNum, scenes: [sorted[i]] });
      }
    }
    return grouped;
  }, [scenes, scenesPerPhase]);

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
    const sceneLen = project.settings.sceneLength || 8;
    const newScene: Scene = {
      id: uuidv4(),
      projectId: project.id,
      sceneNumber: scenes.length + 1,
      title: 'New Scene',
      estimatedDuration: sceneLen,
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

    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });

    toast.success('Scene added');
  }, [project, scenes.length, addScene]);

  // Generate next phase
  const handleGenerateNextPhase = useCallback(async () => {
    if (!project || isGeneratingPhase) return;

    const phaseNum = nextPhaseNumber;
    const sceneStart = scenes.length + 1;
    const scenesInPhase = Math.min(scenesPerPhase, totalScenes - scenes.length);
    const sceneEnd = sceneStart + scenesInPhase - 1;

    // Get titles of existing scenes for continuity
    const existingTitles = scenes
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
      .map((s) => s.title);

    setIsGeneratingPhase(true);
    setGeneratingPhaseLabel(`Phase ${phaseNum} (Scenes ${sceneStart}-${sceneEnd})`);
    setGeneratingProjectId(project.id);
    await updateProject(project.id, { status: 'generating' });

    try {
      const result = await generatePhase(project, {
        phaseNumber: phaseNum,
        totalPhases,
        sceneStart,
        sceneEnd,
        previousPhaseTitles: existingTitles,
      });

      const scenesWithId = result.scenes.map((s) => ({ ...s, projectId: project.id }));

      // Save metadata if first phase somehow missed it
      if (result.metadata) {
        await updateProject(project.id, {
          description: result.metadata.videoDescription || project.description || '',
          thumbnailPrompt: result.metadata.thumbnailPrompt || '',
          tags: result.metadata.tags || [],
        });
      }

      await addScenes(scenesWithId);
      await updateProject(project.id, { status: 'completed' });
      await loadScenes(project.id);
      toast.success(`Phase ${phaseNum} generated! ${scenesInPhase} scenes added.`);

      // Scroll to the new scenes
      requestAnimationFrame(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    } catch (err) {
      await updateProject(project.id, { status: 'error' });
      toast.error((err as Error).message || `Failed to generate Phase ${phaseNum}`);
    } finally {
      setIsGeneratingPhase(false);
      setGeneratingPhaseLabel('');
      setGeneratingProjectId(null);
    }
  }, [project, scenes, nextPhaseNumber, scenesPerPhase, totalScenes, totalPhases, isGeneratingPhase, addScenes, updateProject, loadScenes, setGeneratingProjectId]);

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

  // Retry generation (regenerate Phase 1)
  const handleRetry = useCallback(async () => {
    if (!project) return;

    setGeneratingProjectId(project.id);
    setIsGeneratingPhase(true);
    setGeneratingPhaseLabel('Phase 1');
    await updateProject(project.id, { status: 'generating' });

    try {
      const { scenes: newScenes, metadata } = await generateScript(project);
      for (const scene of newScenes) {
        await addScene(scene);
      }
      if (metadata) {
        await updateProject(project.id, {
          description: metadata.videoDescription || project.description || '',
          thumbnailPrompt: metadata.thumbnailPrompt || '',
          tags: metadata.tags || [],
        });
      }
      await updateProject(project.id, { status: 'completed' });
      toast.success('Script generated successfully!');
      await loadScenes(project.id);
    } catch (err) {
      await updateProject(project.id, { status: 'error' });
      toast.error((err as Error).message || 'Generation failed');
    } finally {
      setGeneratingProjectId(null);
      setIsGeneratingPhase(false);
      setGeneratingPhaseLabel('');
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleBack}>
                <ArrowLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Dashboard</TooltipContent>
          </Tooltip>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">{project.title}</h1>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{project.topic}</p>
          </div>

          <Badge variant={getStatusVariant(project.status)} className="shrink-0">
            {isGenerating && <Loader2 className="size-3 mr-1 animate-spin" />}
            {STATUS_LABELS[project.status]}
          </Badge>

          {scenes.length > 0 && !isGenerating && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-1">
                <FileVideo className="size-3.5" />
                {scenes.length}/{totalScenes}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatDuration(total)}
              </span>
            </div>
          )}

          {!isGenerating && (
            <div className="flex items-center gap-2 shrink-0">
              {allPhasesDone && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleAddScene} className="gap-1.5">
                      <Plus className="size-3.5" />
                      <span className="hidden sm:inline">Add Scene</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add a new scene</TooltipContent>
                </Tooltip>
              )}
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
        {(isGenerating || isGeneratingPhase) && (
          <GeneratingState project={project} phaseLabel={generatingPhaseLabel || 'Phase 1'} />
        )}

        {/* Error state */}
        {isError && <ErrorState project={project} onRetry={handleRetry} />}

        {/* Scene list */}
        {!isGenerating && !isError && !isGeneratingPhase && (
          <>
            {scenes.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Phase progress overview */}
                <div className="mb-6 rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Layers className="size-4 text-primary" />
                      Generation Progress
                    </div>
                    <Badge variant={allPhasesDone ? 'default' : 'secondary'} className="text-xs">
                      {allPhasesDone ? 'All phases complete' : `${completedPhases}/${totalPhases} phases`}
                    </Badge>
                  </div>
                  <PhaseProgressBar
                    currentPhase={activePhaseNum}
                    totalPhases={totalPhases}
                    scenesGenerated={scenes.length}
                    totalScenes={totalScenes}
                  />
                </div>

                {/* Fixed metadata & score cards */}
                <div className="space-y-4 mb-6">
                  <ProjectMetaCard project={project} />
                  <ProjectScoreCard project={project} />
                </div>

                {/* Scenes grouped by phase */}
                <div className="space-y-6">
                  {phases.map(({ phase, scenes: phaseScenes }) => (
                    <div key={`phase-${phase}`}>
                      {/* Phase header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                          <Layers className="size-3.5 text-primary" />
                          <span className="text-sm font-semibold text-primary">
                            Phase {phase}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Scenes {phaseScenes[0]?.sceneNumber}–{phaseScenes[phaseScenes.length - 1]?.sceneNumber}
                          {' '}({phaseScenes.length} scenes)
                        </span>
                        <div className="flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(phaseScenes.reduce((s, sc) => s + sc.estimatedDuration, 0))}
                        </span>
                      </div>

                      <Separator className="mb-4" />

                      {/* DnD for phase scenes */}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={phaseScenes.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                              {phaseScenes.map((scene) => (
                                <SceneCard
                                  key={scene.id}
                                  scene={scene}
                                  project={project}
                                  totalScenes={totalScenes}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  ))}
                </div>

                {/* ---- Bottom actions ---- */}
                <div className="mt-8">
                  {hasNextPhase && !allPhasesDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-6 text-center w-full max-w-md space-y-4">
                        <div className="flex items-center justify-center gap-2">
                          <Zap className="size-5 text-primary" />
                          <span className="text-sm font-semibold">
                            Generate Next Phase
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Phase {nextPhaseNumber} will generate{' '}
                          {Math.min(scenesPerPhase, totalScenes - scenes.length)} more scenes
                          (Scene {scenes.length + 1}–{Math.min(scenes.length + scenesPerPhase, totalScenes)}).
                          AI will continue the story from where Phase {nextPhaseNumber - 1} ended.
                        </p>
                        <Button
                          onClick={handleGenerateNextPhase}
                          disabled={isGeneratingPhase}
                          size="lg"
                          className="gap-2"
                        >
                          {isGeneratingPhase ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Generating Phase {nextPhaseNumber}...
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-4" />
                              Generate Phase {nextPhaseNumber} of {totalPhases}
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {allPhasesDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center max-w-md">
                        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                          <Check className="size-4" />
                          All {totalPhases} phases complete — {scenes.length} scenes generated
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Your full script is ready. You can add more scenes manually or export the script.
                        </p>
                      </div>
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
                </div>

                <div ref={listEndRef} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}