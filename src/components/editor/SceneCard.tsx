'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  GripVertical,
  ChevronDown,
  MoreHorizontal,
  Copy,
  RefreshCw,
  Camera,
  Video,
  FileText,
  Sparkles,
  Trash2,
  Loader2,
  Check,
  StickyNote,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { regenerateScene } from '@/lib/gemini';
import { PLAN_LIMITS } from '@/lib/usage';
import { v4 as uuidv4 } from 'uuid';
import type { Scene, Project } from '@/lib/types';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

// ---- Color palette for scene border cycling ----
const SCENE_COLORS = [
  'border-l-rose-500',
  'border-l-amber-500',
  'border-l-emerald-500',
  'border-l-cyan-500',
  'border-l-violet-500',
  'border-l-pink-500',
  'border-l-orange-500',
  'border-l-teal-500',
  'border-l-fuchsia-500',
  'border-l-lime-500',
];

const SCENE_BADGE_COLORS = [
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  'bg-lime-500/15 text-lime-600 dark:text-lime-400',
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---- Editable auto-save field ----
function useAutoSave(
  value: string,
  sceneId: string,
  field: string,
  delay = 500
) {
  const [localValue, setLocalValue] = useState(value);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateScene = useAppStore((s) => s.updateScene);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const save = useCallback(
    (newValue: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await updateScene(sceneId, { [field]: newValue });
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      }, delay);
    },
    [sceneId, field, delay, updateScene]
  );

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      save(newValue);
    },
    [save]
  );

  const handleBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    updateScene(sceneId, { [field]: localValue });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }, [sceneId, field, localValue, updateScene]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { localValue, setLocalValue: handleChange, handleBlur, saved };
}

// ---- Prompt Section ----
function PromptSection({
  icon: Icon,
  label,
  value,
  sceneId,
  field,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sceneId: string;
  field: string;
}) {
  const { localValue, setLocalValue, handleBlur, saved } = useAutoSave(
    value,
    sceneId,
    field
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(localValue);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {saved && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-emerald-500 flex items-center gap-0.5"
            >
              <Check className="size-3" /> Saved
            </motion.span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleCopy}
                disabled={!localValue.trim()}
              >
                <Copy className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className="min-h-[80px] resize-y text-sm leading-relaxed"
        placeholder={`Write the ${label.toLowerCase()}...`}
      />
    </div>
  );
}

// ---- Notes Section ----
function NotesSection({
  notes,
  sceneId,
}: {
  notes: Scene['notes'];
  sceneId: string;
}) {
  const emotion = useAutoSave(notes.emotion, sceneId, 'notes.emotion');
  const visualFocus = useAutoSave(notes.visualFocus, sceneId, 'notes.visualFocus');
  const transition = useAutoSave(
    notes.transitionSuggestion,
    sceneId,
    'notes.transitionSuggestion'
  );
  const details = useAutoSave(
    notes.importantDetails,
    sceneId,
    'notes.importantDetails'
  );
  const updateScene = useAppStore((s) => s.updateScene);

  // Override handleBlur for nested notes fields
  const saveNote = useCallback(
    async (field: string, value: string) => {
      await updateScene(sceneId, {
        notes: { ...notes, [field]: value },
      } as unknown as Partial<Scene>);
    },
    [sceneId, notes, updateScene]
  );

  return (
    <div className="space-y-3 pl-1">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <StickyNote className="size-3.5" />
        Scene Notes
      </Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            Emotion
          </span>
          <Input
            value={emotion.localValue}
            onChange={(e) => emotion.setLocalValue(e.target.value)}
            onBlur={() => saveNote('emotion', emotion.localValue)}
            className="h-8 text-sm"
            placeholder="e.g. Tense, hopeful..."
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            Visual Focus
          </span>
          <Input
            value={visualFocus.localValue}
            onChange={(e) => visualFocus.setLocalValue(e.target.value)}
            onBlur={() => saveNote('visualFocus', visualFocus.localValue)}
            className="h-8 text-sm"
            placeholder="e.g. Character's face..."
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            Transition
          </span>
          <Input
            value={transition.localValue}
            onChange={(e) => transition.setLocalValue(e.target.value)}
            onBlur={() => saveNote('transitionSuggestion', transition.localValue)}
            className="h-8 text-sm"
            placeholder="e.g. Fade to black..."
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            Important Details
          </span>
          <Textarea
            value={details.localValue}
            onChange={(e) => details.setLocalValue(e.target.value)}
            onBlur={() => saveNote('importantDetails', details.localValue)}
            className="min-h-[60px] resize-y text-sm"
            placeholder="Any critical notes..."
          />
        </div>
      </div>
    </div>
  );
}

// ---- Main SceneCard ----
interface SceneCardProps {
  scene: Scene;
  project: Project;
  totalScenes: number;
}

export default function SceneCard({ scene, project, totalScenes }: SceneCardProps) {
  const [open, setOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(scene.title);
  const [regenerating, setRegenerating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const updateScene = useAppStore((s) => s.updateScene);
  const removeScene = useAppStore((s) => s.removeScene);
  const addScene = useAppStore((s) => s.addScene);

  const colorIndex = (scene.sceneNumber - 1) % SCENE_COLORS.length;
  const borderColor = SCENE_COLORS[colorIndex];
  const badgeColor = SCENE_BADGE_COLORS[colorIndex];

  // Sync title from props
  useEffect(() => {
    setTitleDraft(scene.title);
  }, [scene.title]);

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const handleTitleSave = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== scene.title) {
      updateScene(scene.id, { title: trimmed });
    } else {
      setTitleDraft(scene.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitleDraft(scene.title);
      setEditingTitle(false);
    }
  };

  const handleRegenerate = async (field?: 'narration' | 'imagePrompt' | 'animationPrompt') => {
    if (regenerating) return;

    // Check plan — free users cannot regenerate
    const user = useAuthStore.getState().user;
    const plan = user?.plan || 'free';
    if (!PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS].canRegenerate) {
      toast.error('Regeneration is a Pro feature. Upgrade your plan to regenerate scenes.');
      return;
    }

    setRegenerating(true);
    try {
      const updates = await regenerateScene(project, scene, totalScenes, field);
      await updateScene(scene.id, updates);
      toast.success(
        field
          ? `${field === 'narration' ? 'Narration' : field === 'imagePrompt' ? 'Image Prompt' : 'Animation Prompt'} regenerated`
          : 'Scene regenerated successfully'
      );
    } catch (err) {
      toast.error((err as Error).message || 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDuplicate = async () => {
    const now = Date.now();
    const newScene: Scene = {
      ...scene,
      id: uuidv4(),
      sceneNumber: scene.sceneNumber + 1,
      title: `${scene.title} (copy)`,
      createdAt: now,
      updatedAt: now,
    };
    await addScene(newScene);
    toast.success('Scene duplicated');
  };

  const handleDelete = async () => {
    setDeleteOpen(false);
    await removeScene(scene.id);
    toast.success('Scene deleted');
  };

  // Goal field
  const goal = useAutoSave(scene.goal, scene.id, 'goal');

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        layout
      >
        <Card
          ref={setNodeRef}
          style={style}
          className={`border-l-4 ${borderColor} transition-shadow duration-200 hover:shadow-md bg-card`}
        >
          <Collapsible open={open} onOpenChange={setOpen}>
            {/* ---- HEADER ---- */}
            <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
              {/* Drag handle */}
              <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0 touch-none"
                {...attributes}
                {...listeners}
                aria-label="Drag to reorder"
              >
                <GripVertical className="size-4" />
              </button>

              {/* Scene number badge */}
              <Badge
                variant="secondary"
                className={`shrink-0 h-7 min-w-7 px-1.5 justify-center font-mono text-xs font-bold rounded-full ${badgeColor}`}
              >
                {scene.sceneNumber.toString().padStart(2, '0')}
              </Badge>

              {/* Title */}
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <Input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={handleTitleKeyDown}
                    className="h-7 text-sm font-semibold px-2"
                  />
                ) : (
                  <span
                    className="text-sm font-semibold truncate block cursor-text hover:text-primary/80 transition-colors"
                    onDoubleClick={() => setEditingTitle(true)}
                    title="Double-click to edit"
                  >
                    {scene.title}
                  </span>
                )}
              </div>

              {/* Duration */}
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
                {formatDuration(scene.estimatedDuration)}
              </span>

              {/* Regenerating indicator */}
              {regenerating && (
                <Loader2 className="size-4 text-primary animate-spin shrink-0" />
              )}

              {/* More dropdown */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        disabled={regenerating}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Scene options</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onClick={() => handleRegenerate()}
                    disabled={regenerating}
                  >
                    <RefreshCw className="size-4" />
                    Regenerate Scene
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRegenerate('narration')}
                    disabled={regenerating}
                  >
                    <FileText className="size-4" />
                    Regenerate Narration
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRegenerate('imagePrompt')}
                    disabled={regenerating}
                  >
                    <Camera className="size-4" />
                    Regenerate Image Prompt
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRegenerate('animationPrompt')}
                    disabled={regenerating}
                  >
                    <Video className="size-4" />
                    Regenerate Animation Prompt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Sparkles className="size-4" />
                    Duplicate Scene
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete Scene
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Collapsible trigger */}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 shrink-0">
                  <motion.div
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </motion.div>
                </Button>
              </CollapsibleTrigger>
            </div>

            {/* ---- BODY ---- */}
            <CollapsibleContent>
              <div className="px-3 pb-4 sm:px-4 space-y-4">
                <Separator />

                {/* Scene Goal */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Scene Goal
                    </Label>
                    {goal.saved && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-emerald-500 flex items-center gap-0.5"
                      >
                        <Check className="size-3" /> Saved
                      </motion.span>
                    )}
                  </div>
                  <Textarea
                    value={goal.localValue}
                    onChange={(e) => goal.setLocalValue(e.target.value)}
                    onBlur={goal.handleBlur}
                    className="min-h-[60px] resize-y text-sm"
                    placeholder="What does this scene accomplish?"
                  />
                </div>

                <Separator />

                {/* Narration */}
                <PromptSection
                  icon={FileText}
                  label="Narration"
                  value={scene.narration}
                  sceneId={scene.id}
                  field="narration"
                />

                <Separator />

                {/* Image Prompt */}
                <PromptSection
                  icon={Camera}
                  label="Image Prompt"
                  value={scene.imagePrompt}
                  sceneId={scene.id}
                  field="imagePrompt"
                />

                <Separator />

                {/* Animation Prompt */}
                <PromptSection
                  icon={Video}
                  label="Animation Prompt"
                  value={scene.animationPrompt}
                  sceneId={scene.id}
                  field="animationPrompt"
                />

                <Separator />

                {/* Scene Notes (collapsible sub-section) */}
                <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground -ml-2"
                      >
                        <motion.div
                          animate={{ rotate: notesOpen ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="mr-1"
                        >
                          <ChevronDown className="size-3" />
                        </motion.div>
                        Scene Notes
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="mt-3">
                    <NotesSection notes={scene.notes} sceneId={scene.id} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </motion.div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Scene"
        description={`Are you sure you want to delete "${scene.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}