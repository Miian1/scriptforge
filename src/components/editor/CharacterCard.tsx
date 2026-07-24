'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UserCircle,
  Sparkles,
  Loader2,
  Check,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Palette,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type { Character, CharacterDesign, Project } from '@/lib/types';
import { useAppStore } from '@/lib/store';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const CHARACTER_GUIDE_SYSTEM_PROMPT = `You are an expert Character Design Director working for a world-class animation studio.
Your ONLY responsibility is generating extremely detailed image prompts that define a character so consistently that another AI model can recreate the exact same character forever.
Every generated character must be treated like an official mascot.

DESIGN PHILOSOPHY:
Every character must have: Clear silhouette, Recognizable proportions, Consistent anatomy, Unique personality,
Distinctive facial features, Reusable animation style, Simple recognizable shapes, Consistent colors,
Repeatable expressions, Repeatable poses.
The goal is long-term visual consistency.

VISUAL STYLE EXAMPLES: Flat Vector, Pixar, Disney, Anime, Studio Ghibli, Minimal, Comic, Mascot, Clay, Pixel, Low Poly, 3D Cartoon, Ink Drawing, Paper Cut, Sticker Style, SVG.

CONSISTENCY RULES (mandatory — never change): Head size, Eye spacing, Eye shape, Mouth style, Body proportions,
Arm length, Leg length, Color palette, Outline thickness, Art style, Silhouette, Shape language, Character height,
Accessory placement, Clothing design, Hair shape.

The final output should ONLY be a highly detailed image-generation prompt. Do NOT explain. Do NOT summarize.
Do NOT use markdown. Do NOT add notes. Only output the finished prompt.`;

interface CharacterCardProps {
  character: Character;
  project: Project;
}

const DESIGN_FIELDS: { key: keyof CharacterDesign; label: string; placeholder: string }[] = [
  { key: 'characterName', label: 'Character Name', placeholder: 'e.g. Captain Nova' },
  { key: 'characterType', label: 'Character Type', placeholder: 'e.g. Protagonist, Mascot, Sidekick' },
  { key: 'species', label: 'Species', placeholder: 'e.g. Human, Robot, Animal, Alien' },
  { key: 'personality', label: 'Personality', placeholder: 'e.g. Brave, curious, mischievous, wise' },
  { key: 'artStyle', label: 'Art Style', placeholder: 'e.g. Pixar 3D, Flat Vector, Anime' },
  { key: 'primaryColor', label: 'Primary Color', placeholder: 'e.g. #FF6B35 (main color)' },
  { key: 'secondaryColor', label: 'Secondary Color', placeholder: 'e.g. #004E89 (accent)' },
  { key: 'outlineColor', label: 'Outline Color', placeholder: 'e.g. #1A1A2E (border/line)' },
  { key: 'headShape', label: 'Head Shape', placeholder: 'e.g. Round, Oval, Square, Triangular' },
  { key: 'bodyShape', label: 'Body Shape', placeholder: 'e.g. Slim, Stocky, Hourglass, Athletic' },
  { key: 'eyeShape', label: 'Eye Shape', placeholder: 'e.g. Large round, Almond, Dot eyes' },
  { key: 'mouthStyle', label: 'Mouth Style', placeholder: 'e.g. Simple curve, Cat mouth, Beak' },
  { key: 'accessories', label: 'Accessories', placeholder: 'e.g. Red cape, Golden crown, Backpack' },
  { key: 'theme', label: 'Theme', placeholder: 'e.g. Space adventure, Underwater, Forest' },
  { key: 'animationStyle', label: 'Animation Style', placeholder: 'e.g. Bouncy, Smooth, Stiff, Rubber hose' },
];

export default function CharacterCard({ character, project }: CharacterCardProps) {
  const updateCharacter = useAppStore((s) => s.updateCharacter);
  const removeCharacter = useAppStore((s) => s.removeCharacter);

  const [expanded, setExpanded] = useState(true);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const showSaved = useCallback((field: string) => {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  }, []);

  // Auto-save name
  const [nameDraft, setNameDraft] = useState(character.name);
  useEffect(() => { setNameDraft(character.name); }, [character.name]);

  const handleNameChange = (val: string) => {
    setNameDraft(val);
    if (timers.current.name) clearTimeout(timers.current.name);
    timers.current.name = setTimeout(async () => {
      await updateCharacter(character.id, { name: val });
      showSaved('name');
    }, 800);
  };

  // Auto-save design field
  const handleDesignChange = (key: keyof CharacterDesign, val: string) => {
    const newDesign = { ...character.design, [key]: val };
    // Update optimistically
    updateCharacter(character.id, { design: newDesign });
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      await updateCharacter(character.id, { design: newDesign });
      showSaved(key);
    }, 1000);
  };

  // Auto-save image prompt
  const [promptDraft, setPromptDraft] = useState(character.imagePrompt);
  useEffect(() => { setPromptDraft(character.imagePrompt); }, [character.imagePrompt]);

  const handlePromptChange = (val: string) => {
    setPromptDraft(val);
    if (timers.current.imagePrompt) clearTimeout(timers.current.imagePrompt);
    timers.current.imagePrompt = setTimeout(async () => {
      await updateCharacter(character.id, { imagePrompt: val });
      showSaved('imagePrompt');
    }, 800);
  };

  // AI generate image prompt from character guide + design fields
  const handleGeneratePrompt = async () => {
    if (generatingPrompt) return;
    setGeneratingPrompt(true);
    try {
      const d = character.design;
      const filledFields = DESIGN_FIELDS.filter((f) => d[f.key]?.trim());
      const fieldSummary = filledFields.length > 0
        ? DESIGN_FIELDS.map((f) => `${f.label}: ${d[f.key] || '(not set)'}`).join('\n')
        : 'No fields filled yet. Generate a character design from scratch based on the project.';

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: CHARACTER_GUIDE_SYSTEM_PROMPT,
          prompt: `Generate a highly detailed, consistent character image-generation prompt for a YouTube video.

Project Context:
- Video Title: ${project.title}
- Video Topic: ${project.topic}
- Video Theme: ${project.settings.theme}
- Target Audience: ${project.settings.targetAudience}
- Art Style: ${project.settings.theme}

Character Design Fields:
${fieldSummary}

Requirements:
- Create a complete, production-ready character design prompt
- Include every visual detail needed for perfect consistency
- Reference the character design fields above
- The prompt should enable any AI image model to recreate this exact character
- Include: silhouette description, color palette, facial features, body proportions, expression defaults, pose defaults, and any accessories
- Be extremely specific about shapes, proportions, and colors
- Follow the consistency rules strictly

Return ONLY the image prompt. No quotes, no explanation, no markdown.`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const prompt = data.text || data.response || '';
        if (prompt) {
          setPromptDraft(prompt);
          await updateCharacter(character.id, { imagePrompt: prompt });
          showSaved('imagePrompt');
          toast.success('Character image prompt generated!');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to generate prompt');
      }
    } catch {
      toast.error('Failed to generate character prompt');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // AI auto-fill all design fields
  const handleAutoFillDesign = async () => {
    if (generatingPrompt) return;
    setGeneratingPrompt(true);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: CHARACTER_GUIDE_SYSTEM_PROMPT,
          prompt: `Design a unique character for this YouTube video project and fill in ALL design fields.

Project Context:
- Video Title: ${project.title}
- Video Topic: ${project.topic}
- Video Theme: ${project.settings.theme}
- Target Audience: ${project.settings.targetAudience}

Return a JSON object with EXACTLY these keys (no extra keys):
{
  "characterName": "string",
  "characterType": "string",
  "species": "string",
  "personality": "string",
  "artStyle": "string",
  "primaryColor": "string (hex code)",
  "secondaryColor": "string (hex code)",
  "outlineColor": "string (hex code)",
  "headShape": "string",
  "bodyShape": "string",
  "eyeShape": "string",
  "mouthStyle": "string",
  "accessories": "string",
  "theme": "string",
  "animationStyle": "string"
}

Return ONLY the JSON object. No markdown fences, no explanation.`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        let text = data.text || data.response || '';
        let parsed: Partial<CharacterDesign> = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          const match = text.match(/\{[\s\S]*?\}/);
          if (match) {
            try { parsed = JSON.parse(match[0]); } catch { /* empty */ }
          }
        }
        if (Object.keys(parsed).length > 0) {
          const newDesign: CharacterDesign = {
            characterName: parsed.characterName || '',
            characterType: parsed.characterType || '',
            species: parsed.species || '',
            personality: parsed.personality || '',
            artStyle: parsed.artStyle || '',
            primaryColor: parsed.primaryColor || '',
            secondaryColor: parsed.secondaryColor || '',
            outlineColor: parsed.outlineColor || '',
            headShape: parsed.headShape || '',
            bodyShape: parsed.bodyShape || '',
            eyeShape: parsed.eyeShape || '',
            mouthStyle: parsed.mouthStyle || '',
            accessories: parsed.accessories || '',
            theme: parsed.theme || '',
            animationStyle: parsed.animationStyle || '',
          };
          const newName = newDesign.characterName || character.name;
          await updateCharacter(character.id, { design: newDesign, name: newName });
          toast.success('Character design auto-filled!');
        } else {
          toast.error('Could not parse AI response');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to auto-fill');
      }
    } catch {
      toast.error('Failed to auto-fill character design');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleDelete = async () => {
    await removeCharacter(character.id);
    toast.success('Character removed');
  };

  const handleCopy = (text: string, label: string) => {
    if (!text.trim()) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const filledCount = DESIGN_FIELDS.filter((f) => character.design[f.key]?.trim()).length;

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCircle className="size-4 text-primary" />
            <Input
              value={nameDraft}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-7 w-auto max-w-[200px] text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0"
              placeholder="Character Name"
            />
            {savedField === 'name' && (
              <span className="text-emerald-500 flex items-center gap-0.5 text-xs">
                <Check className="size-3" /> Saved
              </span>
            )}
            <Badge variant="secondary" className="text-[10px] font-normal">
              {filledCount}/{DESIGN_FIELDS.length} fields
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handleAutoFillDesign}
                  disabled={generatingPrompt}
                >
                  {generatingPrompt ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI auto-fill all fields</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove character</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Design Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DESIGN_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center justify-between">
                  {field.label}
                  {savedField === field.key && (
                    <span className="text-emerald-500 flex items-center gap-0.5 text-[10px] normal-case tracking-normal">
                      <Check className="size-2.5" /> Saved
                    </span>
                  )}
                </Label>
                <Input
                  value={character.design[field.key] || ''}
                  onChange={(e) => handleDesignChange(field.key, e.target.value)}
                  className="h-8 text-sm"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* Image Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Palette className="size-3.5" />
                Character Image Prompt
                {savedField === 'imagePrompt' && (
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
                      onClick={handleGeneratePrompt}
                      disabled={generatingPrompt}
                    >
                      {generatingPrompt ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI generate image prompt from design</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleCopy(promptDraft, 'Image prompt')}
                      disabled={!promptDraft.trim()}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <Textarea
              value={promptDraft}
              onChange={(e) => handlePromptChange(e.target.value)}
              className="min-h-[100px] resize-y text-sm leading-relaxed"
              placeholder="AI-generated character design prompt will appear here... Click sparkle to generate from design fields, or wand to auto-fill all fields first."
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Character Manager (wrapper with Add button) ───────────────────────────────

export function CharacterManager({ project }: { project: Project }) {
  const characters = useAppStore((s) => s.characters);
  const addCharacter = useAppStore((s) => s.addCharacter);

  const handleAddCharacter = async () => {
    const now = Date.now();
    const newChar: Character = {
      id: uuidv4(),
      projectId: project.id,
      name: 'New Character',
      design: {
        characterName: '',
        characterType: '',
        species: '',
        personality: '',
        artStyle: project.settings.theme || '',
        primaryColor: '',
        secondaryColor: '',
        outlineColor: '',
        headShape: '',
        bodyShape: '',
        eyeShape: '',
        mouthStyle: '',
        accessories: '',
        theme: project.topic || '',
        animationStyle: '',
      },
      imagePrompt: '',
      createdAt: now,
      updatedAt: now,
    };
    await addCharacter(newChar);
    toast.success('Character added');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserCircle className="size-4 text-primary" />
          Characters
          {characters.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {characters.length}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleAddCharacter} className="gap-1.5 h-7 text-xs">
          <Plus className="size-3.5" />
          Add Character
        </Button>
      </div>

      {characters.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/50 bg-muted/20 p-6 text-center">
          <UserCircle className="size-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No characters yet. Add characters to assign them to scenes for consistent visual design.
          </p>
        </div>
      )}

      {characters.map((char) => (
        <CharacterCard key={char.id} character={char} project={project} />
      ))}
    </div>
  );
}
