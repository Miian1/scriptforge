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
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Project, Scene } from '@/lib/types';
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
  const scenes = useAppStore((s) => s.scenes);

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

  // ── AI Generation Functions ──

  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);

  // AI generate thumbnail prompt
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

  // AI generate description
  const handleGenerateDescription = async () => {
    if (generatingDesc) return;
    setGeneratingDesc(true);
    try {
      // Build scene summaries for context
      const sceneSummaries = scenes.slice(0, 5).map((s: Scene) =>
        `- Scene ${s.sceneNumber}: ${s.title} — ${s.goal || s.narration.slice(0, 80)}...`
      ).join('\n');
      const sceneContext = scenes.length > 0
        ? `\n\nThe video has ${scenes.length} scenes:\n${sceneSummaries}`
        : '';

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a YouTube SEO expert. Write a compelling, SEO-optimized YouTube video description for this video:

Title: ${project.title}
Topic: ${project.topic}
Current Description: ${project.description || 'None yet'}
Target Audience: ${project.settings.targetAudience}
Writing Style: ${project.settings.writingStyle}
Language: ${project.settings.language}
${sceneContext}

Requirements:
- First line: compelling hook with the main keyword
- 3-5 sentences total, engaging and informative
- Include a call-to-action (subscribe, like, comment)
- End with 3-5 relevant hashtags
- Optimize for YouTube search discovery
- Write in ${project.settings.language}

Return ONLY the description text. No quotes, no explanation, no markdown.`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const desc = data.text || data.response || '';
        if (desc) {
          setDescription(desc);
          await updateProject(project.id, { description: desc });
          showSaved('description');
          toast.success('Description generated');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to generate');
      }
    } catch {
      toast.error('Failed to generate description');
    } finally {
      setGeneratingDesc(false);
    }
  };

  // AI generate tags
  const handleGenerateTags = async () => {
    if (generatingTags) return;
    setGeneratingTags(true);
    try {
      const existingTags = currentTags.join(', ');
      const sceneTitles = scenes.map((s: Scene) => s.title).join(', ');

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a YouTube SEO tag expert. Generate 10-12 highly relevant YouTube tags for this video:

Title: ${project.title}
Topic: ${project.topic}
Description: ${project.description || 'N/A'}
Scene Titles: ${sceneTitles || 'N/A'}
Target Audience: ${project.settings.targetAudience}
${existingTags ? `Existing Tags (avoid duplicates): ${existingTags}` : ''}

Requirements:
- Mix of broad tags and specific long-tail keywords
- All lowercase
- Include the main topic keyword
- Include trending/related niche tags
- No duplicates with existing tags

Return ONLY a JSON array of tag strings. Example: ["tag1", "tag2", "tag3"]
No markdown fences, no explanation, just the JSON array.`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        let text = data.text || data.response || '';
        // Parse array from response
        let tags: string[] = [];
        try {
          tags = JSON.parse(text);
        } catch {
          const arrMatch = text.match(/\[[\s\S]*?\]/);
          if (arrMatch) {
            try { tags = JSON.parse(arrMatch[0]); } catch { /* empty */ }
          }
        }
        if (Array.isArray(tags) && tags.length > 0) {
          const cleanTags = tags
            .map((t) => String(t).toLowerCase().trim())
            .filter((t) => t.length > 0 && t.length <= 30 && !currentTags.includes(t))
            .slice(0, 15 - currentTags.length);

          if (cleanTags.length > 0) {
            const newTags = [...currentTags, ...cleanTags];
            await updateProject(project.id, { tags: newTags });
            toast.success(`${cleanTags.length} tags generated`);
          } else {
            toast.info('No new unique tags to add');
          }
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to generate tags');
      }
    } catch {
      toast.error('Failed to generate tags');
    } finally {
      setGeneratingTags(false);
    }
  };

  // Reusable AI button spinner
  const AiSpinner = ({ active }: { active: boolean }) =>
    active ? (
      <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
    ) : (
      <Sparkles className="size-3.5" />
    );

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
                    <AiSpinner active={generatingThumb} />
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
            placeholder="Describe the ideal thumbnail for this video... or click sparkle to AI-generate"
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
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={handleGenerateDescription}
                    disabled={generatingDesc}
                  >
                    <AiSpinner active={generatingDesc} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>AI generate SEO description</TooltipContent>
              </Tooltip>
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
          </div>
          <Textarea
            value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            className="min-h-[80px] resize-y text-sm leading-relaxed"
            placeholder="Write the YouTube video description... or click sparkle to AI-generate"
          />
        </div>

        <Separator />

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Tag className="size-3.5" />
              Tags
              <span className="text-muted-foreground/60">({currentTags.length}/15)</span>
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handleGenerateTags}
                  disabled={generatingTags || currentTags.length >= 15}
                >
                  <AiSpinner active={generatingTags} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI generate SEO tags</TooltipContent>
            </Tooltip>
          </div>

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