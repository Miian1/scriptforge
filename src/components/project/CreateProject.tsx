'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Film, ArrowLeft, Sparkles, Check, AlertCircle, RefreshCw, Layers, Clock, Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAppStore } from '@/lib/store';
import { generatePhase, generateResearch, type ChannelNiche, type YouTubeResearchInput, type ResearchContext } from '@/lib/gemini';
import type { Project, VideoTheme, WritingStyle, TargetAudience, VideoLanguage, VideoDuration } from '@/lib/types';
import { useAuthStore } from '@/lib/auth-store';
import {
  DURATION_LABELS,
  DURATION_SECONDS,
  SCENES_PER_PHASE,
  THEME_LABELS,
  STYLE_LABELS,
  AUDIENCE_LABELS,
  LANGUAGE_LABELS,
  resolveVideoDurationSeconds,
} from '@/lib/types';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  topic: z.string().min(1, 'Topic is required').max(200),
  description: z.string().max(1000).optional().default(''),
  // 'niche' = inherit from saved channel niche settings; 'custom' = manual override
  productionMode: z.enum(['niche', 'custom']).optional().default('niche'),
  duration: z.enum(['short', 'medium', 'long', 'custom']),
  customDurationMinutes: z.number().min(1).max(180).optional().default(undefined),
  sceneLengthMode: z.enum(['default', 'custom']),
  customSceneLength: z.number().min(3).max(60).optional().default(undefined),
  theme: z.enum(['realistic', 'anime', 'cinematic', 'cartoon', '3d-render', 'watercolor', 'pixel-art']),
  language: z.enum(['english', 'spanish', 'french', 'german', 'portuguese', 'japanese', 'korean', 'chinese', 'hindi', 'arabic']),
  writingStyle: z.enum(['conversational', 'professional', 'dramatic', 'educational', 'storytelling', 'humorous']),
  targetAudience: z.enum(['beginners', 'general', 'intermediate', 'experts', 'kids', 'teens']),
  // Whether to run the pre-generation research step
  runResearch: z.boolean().optional().default(true),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Generation Stages ────────────────────────────────────────────────────────

const GENERATION_STAGES = [
  { active: 'Researching your channel & niche...', completed: 'Research complete' },
  { active: 'Building story structure...', completed: 'Story structured' },
  { active: 'Generating Phase 1 scenes...', completed: 'Phase 1 generated' },
  { active: 'Finalizing...', completed: 'Finalized' },
] as const;

const STAGE_INTERVAL_MS = 5000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateProject() {
  const router = useRouter();
  const {
    addProject,
    setActiveProjectId,
    addScenes,
    updateProject,
    loadScenes,
  } = useAppStore();

  // Phase: 'form' | 'generating' | 'error'
  const [phase, setPhase] = useState<'form' | 'generating' | 'error'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStage, setCurrentStage] = useState(-1);
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [researchSummary, setResearchSummary] = useState<string | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const formValuesRef = useRef<FormValues | null>(null);
  const isSubmittingRef = useRef(false);

  // ── Channel niche from auth store ──
  // Used to:
  //   1) pre-fill the form when productionMode === 'niche'
  //   2) pass to AI scene generation
  //   3) feed into the research step
  const channelNiche = useAuthStore((s) => s.user?.channelNiche) as ChannelNiche | undefined;
  const youtubeConnected = useAuthStore((s) => s.user?.youtubeConnected) === true;

  // Pre-fill theme from saved niche when productionMode is 'niche'
  // and the user has saved visualTheme that contains a known theme keyword
  // (e.g. "cinematic", "anime"). Used only as the default; the user can
  // switch to 'custom' mode to override.
  const nicheThemeMatch: VideoTheme | null = channelNiche?.visualTheme
    ? (Object.keys(THEME_LABELS) as VideoTheme[]).find((t) =>
        channelNiche.visualTheme!.toLowerCase().includes(t) || channelNiche.visualTheme!.toLowerCase().includes(t.split('-')[0]),
      ) ?? null
    : null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      topic: '',
      description: '',
      productionMode: 'niche',
      duration: 'medium',
      customDurationMinutes: undefined,
      sceneLengthMode: 'default',
      customSceneLength: undefined,
      // These will be overridden below if niche mode has matching values
      theme: nicheThemeMatch || 'cinematic',
      language: 'english',
      writingStyle: 'conversational',
      targetAudience: 'general',
      runResearch: true,
    },
  });

  // Watch duration, scene length, and production mode for calculations
  const watchDuration = form.watch('duration');
  const watchCustomDurationMinutes = form.watch('customDurationMinutes');
  const watchSceneLengthMode = form.watch('sceneLengthMode');
  const watchCustomSceneLength = form.watch('customSceneLength');
  const watchProductionMode = form.watch('productionMode');

  // When productionMode is 'niche', show the user a read-only summary of
  // inherited settings (they can still see them but they don't edit).
  const inheritedSettings = watchProductionMode === 'niche' && channelNiche
    ? {
        visualTheme: channelNiche.visualTheme || '',
        writingStyle: channelNiche.writingStyle || '',
        audience: channelNiche.audience || '',
        language: channelNiche.language || '',
        charactersCount: Array.isArray(channelNiche.characters) ? channelNiche.characters.length : 0,
      }
    : null;

  // Computed scene length
  const sceneLength = watchSceneLengthMode === 'custom' && watchCustomSceneLength
    ? watchCustomSceneLength
    : 8;

  // Computed totals — use resolveVideoDurationSeconds so 'custom' duration
  // falls back to the user-supplied customDurationMinutes (converted to seconds).
  const totalSeconds = resolveVideoDurationSeconds({
    duration: watchDuration as VideoDuration,
    customVideoDuration: watchCustomDurationMinutes ? watchCustomDurationMinutes * 60 : undefined,
  });
  const totalScenes = Math.ceil(totalSeconds / sceneLength);
  const totalPhases = Math.ceil(totalScenes / SCENES_PER_PHASE);
  const firstPhaseScenes = Math.min(SCENES_PER_PHASE, totalScenes);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const advanceStage = useCallback(() => {
    setCurrentStage((prev) => {
      if (prev >= GENERATION_STAGES.length - 1) return prev;
      return prev + 1;
    });
  }, []);

  const startGeneration = useCallback(async (values: FormValues) => {
    // Block double submissions
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setResearchSummary(null);

    const now = Date.now();
    const sLen = values.sceneLengthMode === 'custom' && values.customSceneLength
      ? values.customSceneLength
      : 8;

    // Resolve the actual total duration in seconds — supports the new
    // 'custom' duration option where the user supplies a custom length
    // in minutes.
    const totalSec = resolveVideoDurationSeconds({
      duration: values.duration as VideoDuration,
      customVideoDuration: values.customDurationMinutes ? values.customDurationMinutes * 60 : undefined,
    });
    const tScenes = Math.ceil(totalSec / sLen);
    const tPhases = Math.ceil(tScenes / SCENES_PER_PHASE);

    const project: Project = {
      id: '',
      title: values.title,
      topic: values.topic,
      description: values.description ?? '',
      thumbnailPrompt: '',
      tags: [],
      settings: {
        duration: values.duration as VideoDuration,
        customVideoDuration: values.duration === 'custom' && values.customDurationMinutes
          ? values.customDurationMinutes * 60
          : undefined,
        theme: values.theme as VideoTheme,
        language: values.language as VideoLanguage,
        writingStyle: values.writingStyle as WritingStyle,
        targetAudience: values.targetAudience as TargetAudience,
        sceneLength: sLen,
        totalScenes: tScenes,
        scenesPerPhase: SCENES_PER_PHASE,
        productionMode: values.productionMode,
      },
      status: 'generating',
      scoreHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    // Save project to MongoDB and get the real ID back
    const mongoId = await addProject(project);
    setActiveProjectId(mongoId);
    projectIdRef.current = mongoId;

    // Switch to generating phase
    setPhase('generating');
    setCurrentStage(0);
    setElapsed(0);
    stageTimerRef.current = setInterval(advanceStage, STAGE_INTERVAL_MS);
    elapsedTimerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);

    try {
      const realProject = useAppStore.getState().projects.find((p) => p.id === mongoId);
      const projectToGenerate = realProject || { ...project, id: mongoId };

      // Get channel niche from auth store (with channel characters)
      const niche = useAuthStore.getState().user?.channelNiche as ChannelNiche | undefined;

      // ── Research step (real) ──
      // Fetch the user's recent YouTube videos (if connected) and pass
      // everything to generateResearch(). On failure, gracefully continue
      // with scene generation (research is an enhancement, not a blocker).
      let research: ResearchContext | null = null;
      if (values.runResearch) {
        try {
          let ytInput: YouTubeResearchInput | null = null;
          if (youtubeConnected) {
            // Fire both fetches in parallel; tolerate either failing.
            const [channelRes, videosRes] = await Promise.allSettled([
              fetch('/api/youtube/channel').then((r) => r.ok ? r.json() : null),
              fetch('/api/youtube/videos').then((r) => r.ok ? r.json() : null),
            ]);
            const channel = channelRes.status === 'fulfilled' ? channelRes.value?.channel : null;
            const videos = videosRes.status === 'fulfilled' ? videosRes.value?.videos : null;
            if (channel || (videos && videos.length > 0)) {
              ytInput = {
                channelTitle: channel?.title,
                channelDescription: channel?.description,
                subscriberCount: channel?.subscriberCount,
                videoCount: channel?.videoCount,
                recentVideos: (videos || []).map((v: { title: string; views?: number; likes?: number; comments?: number; publishedAt?: string }) => ({
                  title: v.title,
                  views: v.views,
                  likes: v.likes,
                  comments: v.comments,
                  publishedAt: v.publishedAt,
                })),
              };
            }
          }
          research = await generateResearch(projectToGenerate, niche || null, ytInput);
          if (research) {
            setResearchSummary(research.channelSummary);
          }
        } catch (researchErr) {
          console.warn('[CreateProject] research step failed, continuing:', researchErr);
        }
      }

      // Generate Phase 1 only — now with research context injected
      const phase1ScenesCount = Math.min(SCENES_PER_PHASE, tScenes);
      const result = await generatePhase(projectToGenerate, {
        phaseNumber: 1,
        totalPhases: tPhases,
        sceneStart: 1,
        sceneEnd: phase1ScenesCount,
        previousPhaseTitles: [],
      }, niche || null, research);

      const scenesWithCorrectId = result.scenes.map((s) => ({ ...s, projectId: mongoId }));

      // Save AI-generated metadata
      if (result.metadata) {
        await updateProject(mongoId, {
          description: result.metadata.videoDescription || projectToGenerate.description || '',
          thumbnailPrompt: result.metadata.thumbnailPrompt || '',
          tags: result.metadata.tags || [],
        });
      }

      // Advance to "saving" stage
      setCurrentStage(GENERATION_STAGES.length - 1);

      // Save scenes to DB
      await addScenes(scenesWithCorrectId);
      await updateProject(mongoId, { status: 'completed' });

      // Brief pause
      await new Promise((r) => setTimeout(r, 800));

      // Clean up timers
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      // Pre-load scenes into store, then redirect to editor
      await loadScenes(mongoId);
      router.push(`/project/${mongoId}`);
    } catch (error) {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      setErrorMessage(message);
      await updateProject(mongoId, { status: 'error' });
      setPhase('error');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [addProject, setActiveProjectId, advanceStage, addScenes, updateProject, loadScenes, router, youtubeConnected]);

  const onRetry = useCallback(() => {
    if (formValuesRef.current) {
      setPhase('form');
      setCurrentStage(-1);
      setElapsed(0);
      setErrorMessage('');
    }
  }, []);

  const onSubmit = useCallback((values: FormValues) => {
    formValuesRef.current = values;
    startGeneration(values);
  }, [startGeneration]);

  const onBackToProjects = useCallback(() => {
    router.push('/projects');
  }, [router]);

  const descriptionValue = form.watch('description') ?? '';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ─── ERROR VIEW ──────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
          >
            <AlertCircle className="h-8 w-8 text-destructive" />
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Generation Failed</h2>
            <p className="text-sm text-muted-foreground">
              {errorMessage || 'Something went wrong. Please try again.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              onClick={onRetry}
              className="w-full text-base font-semibold gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={onBackToDashboard}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── GENERATING VIEW ─────────────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-lg space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
            >
              <Sparkles className="h-7 w-7 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold tracking-tight">Generating Phase 1</h2>
            <p className="text-sm text-muted-foreground">
              {formValuesRef.current?.title && `Crafting first ${SCENES_PER_PHASE} scenes for "${formValuesRef.current.title}"`}
            </p>
          </div>

          {/* Elapsed time */}
          <div className="text-center">
            <span className="text-xs text-muted-foreground font-mono">
              Elapsed {formatTime(elapsed)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div className="absolute inset-0 animate-indeterminate-progress rounded-full bg-primary" />
          </div>

          {/* Stages */}
          <div className="space-y-3">
            {GENERATION_STAGES.map((stage, index) => {
              const isCompleted = index < currentStage;
              const isActive = index === currentStage;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 text-sm rounded-lg px-3 py-2 transition-colors"
                  style={{
                    backgroundColor: isActive ? 'hsl(var(--primary) / 0.06)' : 'transparent',
                  }}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </motion.div>
                    ) : isActive ? (
                      <motion.div
                        className="h-2.5 w-2.5 rounded-full bg-primary"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                      />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span
                    className={
                      isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isActive
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                    }
                  >
                    {isCompleted ? stage.completed : stage.active}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Tip */}
          <p className="text-center text-xs text-muted-foreground/60">
            Generating Phase 1 of {totalPhases}. Remaining phases can be generated from the editor.
          </p>

          {/* Research summary — shown once the research step completes */}
          {researchSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1.5">
                <Sparkles className="size-3" />
                Research Findings
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {researchSummary}
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Indeterminate progress bar animation */}
        <style jsx global>{`
          @keyframes indeterminate-progress {
            0% { transform: translateX(-100%); width: 40%; }
            50% { transform: translateX(100%); width: 60%; }
            100% { transform: translateX(200%); width: 40%; }
          }
          .animate-indeterminate-progress {
            animation: indeterminate-progress 1.8s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  // ─── FORM VIEW (default) ─────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex min-h-full items-start justify-center px-4 py-8 md:items-center md:py-12"
    >
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/projects')}
              className="shrink-0"
              aria-label="Back to projects"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight">
                  Create New Project
                </CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Transform your video idea into a production script
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* ── Basic Information ────────────────────────────────── */}
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Basic Information
                </h2>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. The Future of Renewable Energy"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video Topic</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. How solar panels are changing the world"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Description</FormLabel>
                          <span className="text-xs text-muted-foreground">
                            {descriptionValue.length}/1000
                          </span>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Add any extra details, context, or specific requirements for the video..."
                            rows={3}
                            maxLength={1000}
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <Separator />

              {/* ── Video Structure ──────────────────────────────────── */}
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Video Structure
                </h2>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video Duration</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(Object.entries(DURATION_LABELS) as [VideoDuration, string][]).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sceneLengthMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scene Length</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select scene length" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="default">8 seconds (default)</SelectItem>
                              <SelectItem value="custom">Custom length...</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Custom video duration input */}
                  {watchDuration === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <FormField
                        control={form.control}
                        name="customDurationMinutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Video Duration (minutes)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={180}
                                placeholder="e.g. 15 (for a 15-minute video)"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1">
                              Total video length in minutes (1–180). The AI will calculate the scene count from this.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}

                  {/* Custom scene length input */}
                  {watchSceneLengthMode === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <FormField
                        control={form.control}
                        name="customSceneLength"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Scene Length (seconds)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={3}
                                max={60}
                                placeholder="e.g. 10"
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1">
                              Each scene&apos;s narration will be tailored to this length.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}

                  {/* Calculation Preview */}
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calculator className="size-4 text-primary" />
                      Script Breakdown
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Scene Length</p>
                        <p className="text-sm font-semibold">{sceneLength}s</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total Scenes</p>
                        <p className="text-sm font-semibold">{totalScenes}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Phases</p>
                        <p className="text-sm font-semibold">{totalPhases}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Scenes/Phase</p>
                        <p className="text-sm font-semibold">{SCENES_PER_PHASE}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Layers className="size-3.5" />
                      <span>
                        Phase 1 generates {firstPhaseScenes} scenes. Remaining {totalPhases - 1 > 0
                          ? `${totalPhases - 1} phase${totalPhases - 1 > 1 ? 's' : ''} can be generated from the editor`
                          : 'no additional phases needed'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* ── Production Settings ──────────────────────────────── */}
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Production Settings
                </h2>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  {/* ── Production Mode Toggle ── */}
                  <FormField
                    control={form.control}
                    name="productionMode"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                          Production Mode
                        </FormLabel>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => field.onChange('niche')}
                            className={`text-left rounded-lg border p-3 transition-colors ${
                              field.value === 'niche'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Sparkles className="size-3.5 text-primary" />
                              Use Saved Niche
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                              Auto-match your saved channel niche settings, characters, and visual style.
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange('custom')}
                            className={`text-left rounded-lg border p-3 transition-colors ${
                              field.value === 'custom'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Film className="size-3.5 text-primary" />
                              Custom Settings
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                              Manually pick theme, language, writing style, and audience for this project.
                            </p>
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* ── Inherited Niche Settings (read-only summary) ── */}
                  {watchProductionMode === 'niche' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <Sparkles className="size-3" />
                        Using Your Saved Channel Niche
                      </div>
                      {inheritedSettings ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {inheritedSettings.visualTheme && (
                            <div>
                              <span className="text-muted-foreground">Visual theme:</span>{' '}
                              <span className="font-medium">{inheritedSettings.visualTheme.slice(0, 60)}</span>
                            </div>
                          )}
                          {inheritedSettings.writingStyle && (
                            <div>
                              <span className="text-muted-foreground">Writing style:</span>{' '}
                              <span className="font-medium">{inheritedSettings.writingStyle.slice(0, 60)}</span>
                            </div>
                          )}
                          {inheritedSettings.audience && (
                            <div>
                              <span className="text-muted-foreground">Audience:</span>{' '}
                              <span className="font-medium">{inheritedSettings.audience.slice(0, 60)}</span>
                            </div>
                          )}
                          {inheritedSettings.language && (
                            <div>
                              <span className="text-muted-foreground">Language:</span>{' '}
                              <span className="font-medium">{inheritedSettings.language}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Channel characters:</span>{' '}
                            <span className="font-medium">{inheritedSettings.charactersCount}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          You haven&apos;t saved a channel niche yet. The AI will use sensible defaults.
                          {' '}
                          <a href="/settings" className="text-primary underline">Set up your niche →</a>
                        </p>
                      )}
                    </motion.div>
                  )}

                  {/* ── Manual Production Settings (only in custom mode) ── */}
                  {watchProductionMode === 'custom' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Visual Theme</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select theme" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(Object.entries(THEME_LABELS) as [VideoTheme, string][]).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="language"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Language</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(Object.entries(LANGUAGE_LABELS) as [VideoLanguage, string][]).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="writingStyle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Writing Style</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(Object.entries(STYLE_LABELS) as [WritingStyle, string][]).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="targetAudience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Audience</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select audience" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(Object.entries(AUDIENCE_LABELS) as [TargetAudience, string][]).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* ── Research Step Toggle ── */}
                  <FormField
                    control={form.control}
                    name="runResearch"
                    render={({ field }) => (
                      <FormItem className="rounded-lg border border-border bg-card/40 p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={!!field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            id="runResearch"
                            className="mt-0.5 size-4 rounded border-border"
                          />
                          <div className="space-y-0.5">
                            <Label htmlFor="runResearch" className="text-sm font-medium cursor-pointer">
                              Run pre-generation research
                            </Label>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {youtubeConnected
                                ? 'Analyzes your channel + recent YouTube videos + niche before generating scenes. Adds ~10s.'
                                : 'Analyzes your niche + topic before generating scenes. Connect YouTube in settings to enable channel-based research.'}
                            </p>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* ── Generate Button ──────────────────────────────────── */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-5 w-5" />
                  )}
                  {isSubmitting ? 'Generating...' : `Generate Script (Phase 1 of ${totalPhases})`}
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-2">
                  <Clock className="inline size-3 mr-1" />
                  Only Phase 1 ({firstPhaseScenes} scenes) is generated now. You can generate remaining phases from the editor.
                </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}