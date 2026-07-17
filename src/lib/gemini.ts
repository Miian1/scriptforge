import type { Project, Scene } from './types';

// ---------- Prompt templates ----------

function buildSystemPrompt(project: Project): string {
  const { settings, topic, description, duration } = project;
  return `You are an expert YouTube video scriptwriter and production designer. Your task is to create a complete, scene-by-scene production script for a YouTube video.

## Video Details
- Topic: ${topic}
- Description: ${description || 'No additional description provided.'}
- Duration: ${duration === 'short' ? '1-3 minutes (2-4 scenes)' : duration === 'medium' ? '5-10 minutes (5-8 scenes)' : '15-30 minutes (8-15 scenes)'}
- Theme: ${settings.theme}
- Language: ${settings.language}
- Writing Style: ${settings.writingStyle}
- Target Audience: ${settings.targetAudience}

## Your Task
Research this topic mentally, then produce a complete production script broken into individual scenes. For each scene, generate:

1. **title**: A short descriptive scene title (5-8 words)
2. **estimatedDuration**: Duration in seconds (realistic for the narration length)
3. **goal**: What this scene accomplishes (1-2 sentences)
4. **narration**: Complete spoken narration (natural, engaging, ready for AI TTS). Write it as if speaking directly to the camera. Include hooks, transitions, and pacing cues in brackets like [pause], [dramatic music], etc.
5. **imagePrompt**: A detailed AI image generation prompt describing: environment, characters, camera angle, composition, lighting, colors, mood, style, and quality. Must be compatible with Midjourney/DALL-E style generators. Use the theme "${settings.theme}" as the visual style.
6. **animationPrompt**: A cinematic image-to-video prompt describing: camera movement, character motion, facial expressions, background movement, environmental effects, transitions, lighting changes, and motion style. Compatible with Google Veo, Runway, Kling, PixVerse, Pika, Luma.
7. **notes** containing:
   - "emotion": The primary emotion conveyed
   - "visualFocus": What the viewer's eye should be drawn to
   - "transitionSuggestion": How to transition to the next scene
   - "importantDetails": Any critical production notes

## ALSO generate these metadata fields at the top level of the JSON (alongside "scenes"):
1. **videoDescription**: A compelling 3-5 sentence YouTube video description optimized for SEO. Include the main keyword in the first line. Add relevant hashtags at the end. Make it engaging and include a call-to-action.
2. **tags**: An array of 8-12 relevant YouTube SEO tags (lowercase strings). Mix broad and long-tail keywords related to the topic.
3. **thumbnailPrompt**: A detailed AI image generation prompt for the video thumbnail. Eye-catching, bold colors, clear text overlay space, conveys the video's main idea at a glance. Style: ${settings.theme}. Max 150 words.

## CRITICAL RULES
- Return ONLY valid JSON — no markdown, no code fences, no explanation.
- The JSON must have a top-level "scenes" array AND top-level "videoDescription", "tags", and "thumbnailPrompt" fields.
- Narration must be in ${settings.language}.
- All prompts must be in English regardless of video language.
- Make the narration compelling and natural — avoid robotic phrasing.
- Image and animation prompts should be highly detailed and specific.
- Ensure scenes flow logically with proper pacing.
- Total estimated duration of all scenes should match the requested video duration.`;
}

function buildRegenPrompt(
  project: Project,
  scene: Scene,
  totalScenes: number,
  regenField?: 'narration' | 'imagePrompt' | 'animationPrompt'
): string {
  if (regenField === 'narration') {
    return `You are rewriting ONLY the narration for scene ${scene.sceneNumber} of a YouTube video.
Video topic: ${project.topic}
Scene title: ${scene.title}
Scene goal: ${scene.goal}
Video language: ${project.settings.language}
Writing style: ${project.settings.writingStyle}
Target audience: ${project.settings.targetAudience}

This is scene ${scene.sceneNumber} of ${totalScenes} total scenes.
Generate a compelling, natural narration for this scene. Include pacing cues in brackets like [pause], [dramatic music], etc.
Return ONLY valid JSON with a single key "narration" containing the narration text. No markdown fences.`;
  }
  if (regenField === 'imagePrompt') {
    return `You are rewriting ONLY the AI image generation prompt for scene ${scene.sceneNumber} of a YouTube video.
Video topic: ${project.topic}
Scene title: ${scene.title}
Scene goal: ${scene.goal}
Visual theme: ${project.settings.theme}

Generate a detailed AI image prompt describing: environment, characters, camera angle, composition, lighting, colors, mood, style, and quality. Use the "${project.settings.theme}" visual style. Make it compatible with Midjourney/DALL-E.
Return ONLY valid JSON with a single key "imagePrompt" containing the prompt text. No markdown fences.`;
  }
  if (regenField === 'animationPrompt') {
    return `You are rewriting ONLY the AI video/animation prompt for scene ${scene.sceneNumber} of a YouTube video.
Video topic: ${project.topic}
Scene title: ${scene.title}
Scene goal: ${scene.goal}
Visual theme: ${project.settings.theme}

Generate a cinematic image-to-video prompt describing: camera movement, character motion, facial expressions, background movement, environmental effects, transitions, lighting changes, and motion style. Compatible with Google Veo, Runway, Kling, PixVerse, Pika, Luma.
Return ONLY valid JSON with a single key "animationPrompt" containing the prompt text. No markdown fences.`;
  }

  // Full scene regen
  return `You are regenerating scene ${scene.sceneNumber} of a YouTube video script.
Video topic: ${project.topic}
Description: ${project.description || 'N/A'}
Duration target: ${project.settings.duration}
Theme: ${project.settings.theme}
Language: ${project.settings.language}
Writing style: ${project.settings.writingStyle}
Target audience: ${project.settings.targetAudience}

This is scene ${scene.sceneNumber} of ${totalScenes} total scenes.

Generate a complete replacement scene with: title, estimatedDuration (seconds), goal, narration (in ${project.settings.language}, with pacing cues in brackets), imagePrompt (detailed, in English, for AI image generation in ${project.settings.theme} style), animationPrompt (detailed, in English, for AI video generation), and notes (emotion, visualFocus, transitionSuggestion, importantDetails).

Return ONLY valid JSON: { "title": "...", "estimatedDuration": 30, "goal": "...", "narration": "...", "imagePrompt": "...", "animationPrompt": "...", "notes": { "emotion": "...", "visualFocus": "...", "transitionSuggestion": "...", "importantDetails": "..." } }. No markdown fences.`;
}

// ---------- Server-side API call ----------

async function callServer(prompt: string, maxTokens: number = 65536): Promise<string> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: { message: 'Server error' } }));
    const msg = data.error || `Server error: ${res.status}`;
    if (res.status === 429) throw new Error('Rate limited. Please wait a moment and try again.');
    throw new Error(msg);
  }

  const data = await res.json();
  return data.text;
}

// ---------- JSON parsing ----------

export interface GeneratedMetadata {
  videoDescription: string;
  tags: string[];
  thumbnailPrompt: string;
}

export function parseGeminiJSON(text: string): { scenes: Array<Record<string, unknown>> } & Partial<GeneratedMetadata> {
  try {
    const parsed = JSON.parse(text);
    if (parsed.scenes && Array.isArray(parsed.scenes)) return parsed;
  } catch { /* continue */ }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed.scenes && Array.isArray(parsed.scenes)) return parsed;
    } catch { /* continue */ }
  }

  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    try {
      const parsed = JSON.parse(text.slice(braceStart, braceEnd + 1));
      if (parsed.scenes && Array.isArray(parsed.scenes)) return parsed;
    } catch { /* continue */ }
  }

  throw new Error('Failed to parse AI response as JSON scene data.');
}

function mapToScene(raw: Record<string, unknown>, index: number, projectId: string): Scene {
  const notes = raw.notes as Record<string, string> | undefined;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    sceneNumber: index + 1,
    title: String(raw.title || `Scene ${index + 1}`),
    estimatedDuration: Number(raw.estimatedDuration) || 30,
    goal: String(raw.goal || ''),
    narration: String(raw.narration || ''),
    imagePrompt: String(raw.imagePrompt || ''),
    animationPrompt: String(raw.animationPrompt || ''),
    notes: {
      emotion: notes?.emotion || '',
      visualFocus: notes?.visualFocus || '',
      transitionSuggestion: notes?.transitionSuggestion || '',
      importantDetails: notes?.importantDetails || '',
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- Public API ----------

export async function generateScript(project: Project): Promise<{ scenes: Scene[]; metadata: GeneratedMetadata }> {
  const systemPrompt = buildSystemPrompt(project);

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const text = await callServer(systemPrompt, 65536);
      const parsed = parseGeminiJSON(text);
      const scenes = parsed.scenes.map((s, i) => mapToScene(s, i, project.id));
      const metadata: GeneratedMetadata = {
        videoDescription: String(parsed.videoDescription || ''),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: unknown) => String(t).toLowerCase()).slice(0, 15) : [],
        thumbnailPrompt: String(parsed.thumbnailPrompt || ''),
      };
      return { scenes, metadata };
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to generate script after retries.');
}

export async function regenerateScene(
  project: Project,
  scene: Scene,
  totalScenes: number,
  regenField?: 'narration' | 'imagePrompt' | 'animationPrompt'
): Promise<Partial<Scene>> {
  const prompt = buildRegenPrompt(project, scene, totalScenes, regenField);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await callServer(prompt, 8192);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fence) parsed = JSON.parse(fence[1].trim());
        else {
          const s = text.indexOf('{');
          const e = text.lastIndexOf('}');
          if (s !== -1 && e > s) parsed = JSON.parse(text.slice(s, e + 1));
          else throw new Error('Cannot parse response');
        }
      }

      if (regenField === 'narration') return { narration: String(parsed.narration || '') };
      if (regenField === 'imagePrompt') return { imagePrompt: String(parsed.imagePrompt || '') };
      if (regenField === 'animationPrompt') return { animationPrompt: String(parsed.animationPrompt || '') };

      const notes = parsed.notes as Record<string, string> | undefined;
      return {
        title: String(parsed.title || scene.title),
        estimatedDuration: Number(parsed.estimatedDuration) || scene.estimatedDuration,
        goal: String(parsed.goal || scene.goal),
        narration: String(parsed.narration || scene.narration),
        imagePrompt: String(parsed.imagePrompt || scene.imagePrompt),
        animationPrompt: String(parsed.animationPrompt || scene.animationPrompt),
        notes: {
          emotion: notes?.emotion || scene.notes.emotion,
          visualFocus: notes?.visualFocus || scene.notes.visualFocus,
          transitionSuggestion: notes?.transitionSuggestion || scene.notes.transitionSuggestion,
          importantDetails: notes?.importantDetails || scene.notes.importantDetails,
        },
      };
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  throw new Error('Failed to regenerate scene.');
}