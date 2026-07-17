'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Image,
  Tag,
  FileText,
  Plus,
  X,
  Check,
  Copy,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '@/lib/types';
import { useAppStore } from '@/lib/store';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface ProjectMetaCardProps {
  project: Project;
}

export default function ProjectMetaCard({ project }: ProjectMetaCardProps) {
  const updateProject = useAppStore((s) => s.updateProject);

  // Local state for fields
  const [thumbnailPrompt, setThumbnailPrompt] = useState(project.thumbnailPrompt || '');
  const [description, setDescription] = useState(project.description || '');
  const [tagInput, setTagInput] = useState('');
  const [savedField, setSavedField] = useState<string | null>(null);

  const thumbnailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from props
  useEffect(() => { setThumbnailPrompt(project.thumbnailPrompt || ''); }, [project.thumbnailPrompt]);
  useEffect(() => { setDescription(project.description || ''); }, [project.description]);

  const showSaved = useCallback((field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  }, []);

  // Auto-save thumbnail prompt
  const handleThumbnailChange = (val: string) => {
    setThumbnailPrompt(val);
    if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current);
    thumbnailTimer.current = setTimeout(async () => {
      await updateProject(project.id, { thumbnailPrompt: val });
      showSaved('thumbnail');
    }, 800);
  };

  // Auto-save description
  const handleDescChange = (val: string) => {
    setDescription(val);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(async () => {
      await updateProject(project.id, { description: val });
      showSaved('description');
    }, 800);
  };

  // Tags
  const currentTags = project.tags || [];

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    if (currentTags.includes(tag)) {
      toast.error('Tag already exists');
      return;
    }
    if (currentTags.length >= 15) {
      toast.error('Maximum 15 tags allowed');
      return;
    }
    const newTags = [...currentTags, tag];
    updateProject(project.id, { tags: newTags });
    setTagInput('');
    toast.success('Tag added');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = currentTags.filter((t) => t !== tag);
    updateProject(project.id, { tags: newTags });
  };

  const handleCopy = (text: string, label: string) => {
    if (!text.trim()) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // AI generate thumbnail prompt
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const handleGenerateThumbnail = async () => {
    if (generatingThumb) return;
    setGeneratingThumb(true);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a single, highly detailed AI image generation prompt for a YouTube video thumbnail based on this project:

Title: ${project.title}
Topic: ${project.topic}
Description: ${project.description || 'N/A'}
Visual Theme: ${project.settings.theme}
Target Audience: ${project.settings.targetAudience}

The thumbnail should be eye-catching, use bold colors, have clear text overlay space, and convey the video's main idea at a glance. Style: ${project.settings.theme}.

Return ONLY the image prompt text, nothing else. No quotes, no explanation. Max 200 words.`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const prompt = data.text || data.response || '';
        if (prompt) {
          setThumbnailPrompt(prompt);
          await updateProject(project.id, { thumbnailPrompt: prompt });
          showSaved('thumbnail');
          toast.success('Thumbnail prompt generated');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to generate');
      }
    } catch {
      toast.error('Failed to generate thumbnail prompt');
    } finally {
      setGeneratingThumb(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          Project Metadata
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thumbnail Prompt */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Image className="size-3.5" />
              Thumbnail Prompt
              {savedField === 'thumbnail' && (
                <span className="text-emerald-500 flex items-center gap-0.5 ml-1">
                  <Check className="size-3" /> Saved
                </span>
              )}
            </Label>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={handleGenerateThumbnail}
                    disabled={generatingThumb}
                  >
                    {generatingThumb ? (
                      <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>AI generate thumbnail prompt</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleCopy(thumbnailPrompt, 'Thumbnail prompt')}
                    disabled={!thumbnailPrompt.trim()}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Textarea
            value={thumbnailPrompt}
            onChange={(e) => handleThumbnailChange(e.target.value)}
            className="min-h-[80px] resize-y text-sm leading-relaxed"
            placeholder="Describe the ideal thumbnail for this video... or click the sparkle icon to AI-generate one"
          />
        </div>

        <Separator />

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Video Description
              {savedField === 'description' && (
                <span className="text-emerald-500 flex items-center gap-0.5 ml-1">
                  <Check className="size-3" /> Saved
                </span>
              )}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleCopy(description, 'Description')}
                  disabled={!description.trim()}
                >
                  <Copy className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          </div>
          <Textarea
            value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            className="min-h-[80px] resize-y text-sm leading-relaxed"
            placeholder="Write the YouTube video description — include keywords for SEO..."
          />
        </div>

        <Separator />

        {/* Tags */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Tag className="size-3.5" />
            Tags
            <span className="text-muted-foreground/60">({currentTags.length}/15)</span>
          </Label>

          {/* Tag display */}
          {currentTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {currentTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1 text-xs"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Tag input */}
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add a tag and press Enter"
              className="h-8 text-sm flex-1"
              maxLength={30}
              disabled={currentTags.length >= 15}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || currentTags.length >= 15}
              className="h-8 gap-1 shrink-0"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}