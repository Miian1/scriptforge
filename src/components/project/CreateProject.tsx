'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, ArrowLeft, Sparkles, Check, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAppStore } from '@/lib/store';
import { generateScript } from '@/lib/gemini';
import type { Project, VideoTheme, WritingStyle, TargetAudience, VideoLanguage, VideoDuration } from '@/lib/types';
import {
  DURATION_LABELS,
  THEME_LABELS,
  STYLE_LABELS,
  AUDIENCE_LABELS,
  LANGUAGE_LABELS,
} from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  duration: z.enum(['short', 'medium', 'long']),
  theme: z.enum(['realistic', 'anime', 'cinematic', 'cartoon', '3d-render', 'watercolor', 'pixel-art']),
  language: z.enum(['english', 'spanish', 'french', 'german', 'portuguese', 'japanese', 'korean', 'chinese', 'hindi', 'arabic']),
  writingStyle: z.enum(['conversational', 'professional', 'dramatic', 'educational', 'storytelling', 'humorous']),
  targetAudience: z.enum(['beginners', 'general', 'intermediate', 'experts', 'kids', 'teens']),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Generation Stages ────────────────────────────────────────────────────────

const GENERATION_STAGES = [
  { active: 'Researching topic...', completed: 'Research complete' },
  { active: 'Building story structure...', completed: 'Story structured' },
  { active: 'Generating scenes with AI...', completed: 'Scenes generated' },
  { active: 'Saving to database...', completed: 'Saved successfully' },
] as const;

const STAGE_INTERVAL_MS = 5000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateProject() {
  const {
    setCurrentView,
    addProject,
    setActiveProjectId,
    addScenes,
    updateProject,
    loadScenes,
  } = useAppStore();

  // Phase: 'form' | 'generating' | 'success' | 'error'
  const [phase, setPhase] = useState<'form' | 'generating' | 'success' | 'error'>('form');
  const [currentStage, setCurrentStage] = useState(-1);
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const formValuesRef = useRef<FormValues | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      topic: '',
      description: '',
      duration: 'medium',
      theme: 'cinematic',
      language: 'english',
      writingStyle: 'conversational',
      targetAudience: 'general',
    },
  });

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
    const now = Date.now();

    const project: Project = {
      id: '',
      title: values.title,
      topic: values.topic,
      description: values.description ?? '',
      settings: {
        duration: values.duration as VideoDuration,
        theme: values.theme as VideoTheme,
        language: values.language as VideoLanguage,
        writingStyle: values.writingStyle as WritingStyle,
        targetAudience: values.targetAudience as TargetAudience,
      },
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    };

    // Save project to MongoDB and get the real ID back
    const mongoId = await addProject(project);
    setActiveProjectId(mongoId);
    projectIdRef.current = mongoId;

    // Switch to generating phase (stays on this page)
    setPhase('generating');
    setCurrentStage(0);
    setElapsed(0);
    stageTimerRef.current = setInterval(advanceStage, STAGE_INTERVAL_MS);
    elapsedTimerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);

    try {
      // Use the real MongoDB project from store for generation
      const realProject = useAppStore.getState().projects.find((p) => p.id === mongoId);
      const projectToGenerate = realProject || { ...project, id: mongoId };
      const scenes = await generateScript(projectToGenerate);
      const scenesWithCorrectId = scenes.map((s) => ({ ...s, projectId: mongoId }));

      // Advance to "saving" stage
      setCurrentStage(GENERATION_STAGES.length - 1);

      // Save scenes to DB
      await addScenes(scenesWithCorrectId);
      await updateProject(mongoId, { status: 'completed' });

      // Brief pause to show "Saved successfully" stage
      await new Promise((r) => setTimeout(r, 800));

      // Clean up timers
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      // Switch to success phase
      setPhase('success');
    } catch (error) {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      setErrorMessage(message);
      await updateProject(mongoId, { status: 'error' });
      setPhase('error');
    }
  }, [addProject, setActiveProjectId, advanceStage, addScenes, updateProject]);

  const onRetry = useCallback(() => {
    if (formValuesRef.current) {
      setPhase('form');
      setCurrentStage(-1);
      setElapsed(0);
      setErrorMessage('');
    }
  }, []);

  const onGoToProject = useCallback(async () => {
    const mongoId = projectIdRef.current;
    if (!mongoId) return;
    await loadScenes(mongoId);
    setCurrentView('editor');
  }, [loadScenes, setCurrentView]);

  const onSubmit = useCallback((values: FormValues) => {
    formValuesRef.current = values;
    startGeneration(values);
  }, [startGeneration]);

  const onBackToDashboard = useCallback(() => {
    setCurrentView('dashboard');
  }, [setCurrentView]);

  const descriptionValue = form.watch('description') ?? '';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ─── SUCCESS VIEW ─────────────────────────────────────────────────────────
  if (phase === 'success') {
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
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10"
          >
            <Check className="h-8 w-8 text-emerald-500" />
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Script Generated!</h2>
            <p className="text-muted-foreground">
              Your production script is ready with narration, image prompts, and animation prompts.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              onClick={onGoToProject}
              className="w-full text-base font-semibold gap-2"
            >
              View Project
              <ArrowRight className="h-4 w-4" />
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
            <h2 className="text-2xl font-bold tracking-tight">Generating Your Script</h2>
            <p className="text-sm text-muted-foreground">
              {formValuesRef.current?.title && `Crafting scenes for "${formValuesRef.current.title}"`}
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
            AI is generating narration, image prompts, and animation prompts for each scene. This may take a moment for complex topics.
          </p>
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
              onClick={() => setCurrentView('dashboard')}
              className="shrink-0"
              aria-label="Back to dashboard"
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

              {/* ── Production Settings ──────────────────────────────── */}
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Production Settings
                </h2>

                <div className="rounded-lg border bg-muted/30 p-4">
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
                        <FormItem className="sm:col-span-2">
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
                </div>
              </section>

              {/* ── Generate Button ──────────────────────────────────── */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Script
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}