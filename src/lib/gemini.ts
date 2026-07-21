import type { Project, Scene } from './types';

// ---------- Prompt templates ----------

export interface PhaseInfo {
  phaseNumber: number;
  totalPhases: number;
  sceneStart: number;
  sceneEnd: number;
  previousPhaseTitles: string[];
}

function buildPhasePrompt(project: Project, phase: PhaseInfo): string {
  const { settings, topic, description } = project;
  const sceneLength = settings.sceneLength || 8;
  const scenesInThisPhase = phase.sceneEnd - phase.sceneStart + 1;
  const isLastPhase = phase.phaseNumber === phase.totalPhases;
  const isFirstPhase = phase.phaseNumber === 1;
  const totalDurationSec = (settings.totalScenes || 60) * sceneLength;
  const totalDurationMin = Math.round(totalDurationSec / 60 * 10) / 10;

  const previousContext = phase.previousPhaseTitles.length > 0
    ? `\n\n## Previously Generated Scenes (for continuity)
${phase.previousPhaseTitles.map((t, i) => `${phase.sceneStart - phase.previousPhaseTitles.length + i + 1}. ${t}`).join('\n')}

IMPORTANT: Continue the narrative seamlessly from where the previous phase ended. Do NOT repeat content.`
    : '';

  const metadataSection = isFirstPhase
    ? `## ALSO generate these metadata fields at the top level of the JSON (alongside "scenes"):
1. **videoDescription**: A compelling 3-5 sentence YouTube video description optimized for SEO. Include the main keyword in the first line. Add relevant hashtags at the end. Make it engaging and include a call-to-action.
2. **tags**: An array of 8-12 relevant YouTube SEO tags (lowercase strings). Mix broad and long-tail keywords related to the topic.
3. **thumbnailPrompt**: A detailed AI image generation prompt for the video thumbnail. Eye-catching, bold colors, clear text overlay space, conveys the video's main idea at a glance. Style: ${settings.theme}. Max 150 words.

`
    : '';

  return `You are an expert YouTube video scriptwriter and production designer. Your task is to create scenes for ${isFirstPhase ? 'the beginning' : 'the middle'} of a YouTube video, broken into phases.

## Video Details
- Topic: ${topic}
- Description: ${description || 'No additional description provided.'}
- Total Video Duration: ~${totalDurationMin} minutes
- Total Scenes: ${settings.totalScenes || 'N/A'} (each scene is ~${sceneLength} seconds)
- Scene Length: ${sceneLength} seconds per scene
- Current Phase: Phase ${phase.phaseNumber} of ${phase.totalPhases}
- Scenes in This Phase: ${scenesInThisPhase} (Scene ${phase.sceneStart} to Scene ${phase.sceneEnd})
- Theme: ${settings.theme}
- Language: ${settings.language}
- Writing Style: ${settings.writingStyle}
- Target Audience: ${settings.targetAudience}

${previousContext}

## Your Task
Generate exactly ${scenesInThisPhase} scenes for this phase of the video. Each scene's narration MUST be appropriate for a ${sceneLength}-second scene (approximately ${Math.round(sceneLength * 2.5)}-${Math.round(sceneLength * 3.5)} words of spoken text).

For each scene, generate:
1. **title**: A short descriptive scene title (5-8 words)
2. **estimatedDuration**: Set to ${sceneLength} (this is the fixed scene length)
3. **goal**: What this scene accomplishes (1-2 sentences)
4. **narration**: Complete spoken narration for a ${sceneLength}-second scene. Write it as if speaking directly to the camera. Include pacing cues in brackets like [pause], [dramatic music]. Keep it concise and impactful for the short duration. Must be in ${settings.language}.
5. **imagePrompt**: A detailed AI image generation prompt describing: environment, characters, camera angle, composition, lighting, colors, mood, style, and quality. Must be compatible with Midjourney/DALL-E style generators. Use the theme "${settings.theme}" as the visual style. In English.
6. **animationPrompt**: A cinematic image-to-video prompt describing: camera movement, character motion, facial expressions, background movement, environmental effects, transitions, lighting changes, and motion style. Compatible with Google Veo, Runway, Kling, PixVerse, Pika, Luma. In English.
7. **notes** containing:
   - "emotion": The primary emotion conveyed
   - "visualFocus": What the viewer's eye should be drawn to
   - "transitionSuggestion": How to transition to the next scene
   - "importantDetails": Any critical production notes

${metadataSection}
## CRITICAL RULES
- Return ONLY valid JSON — no markdown, no code fences, no explanation.
- The JSON must have a top-level "scenes" array.${isFirstPhase ? ' It must ALSO have top-level "videoDescription", "tags", and "thumbnailPrompt" fields.' : ''}
- Narration must be in ${settings.language}. All prompts must be in English.
- Make the narration compelling and natural — avoid robotic phrasing.
- Each narration should fit within ${sceneLength} seconds of speaking time.
- Ensure scenes flow logically with proper pacing.
- ${isLastPhase ? 'This is the FINAL phase — ensure a satisfying conclusion to the video.' : `After this phase, ${settings.totalScenes - phase.sceneEnd} more scenes remain. Set up anticipation for what comes next.`}
- ${!isFirstPhase && !isLastPhase ? 'This is a MIDDLE phase — maintain momentum and develop the core content.' : ''}`;

}

function buildSystemPrompt(project: Project): string {
  const { settings, topic, description } = project;
  const sceneLength = settings.sceneLength || 8;
  const totalDurationSec = (settings.totalScenes || 60) * sceneLength;
  const totalDurationMin = Math.round(totalDurationSec / 60 * 10) / 10;

  return `You are an expert YouTube video scriptwriter and production designer. Your task is to create a complete, scene-by-scene production script for a YouTube video.

## Video Details
- Topic: ${topic}
- Description: ${description || 'No additional description provided.'}
- Total Video Duration: ~${totalDurationMin} minutes
- Total Scenes: ${settings.totalScenes || 'N/A'} (each scene is ~${sceneLength} seconds)
- Scene Length: ${sceneLength} seconds per scene
- Theme: ${settings.theme}
- Language: ${settings.language}
- Writing Style: ${settings.writingStyle}
- Target Audience: ${settings.targetAudience}

## Your Task
Research this topic mentally, then produce a complete production script broken into individual scenes. Each scene's narration MUST be appropriate for a ${sceneLength}-second scene (approximately ${Math.round(sceneLength * 2.5)}-${Math.round(sceneLength * 3.5)} words of spoken text).

For each scene, generate:
1. **title**: A short descriptive scene title (5-8 words)
2. **estimatedDuration**: Set to ${sceneLength} (this is the fixed scene length)
3. **goal**: What this scene accomplishes (1-2 sentences)
4. **narration**: Complete spoken narration for a ${sceneLength}-second scene. Write it as if speaking directly to the camera. Include pacing cues in brackets like [pause], [dramatic music]. Keep it concise and impactful for the short duration.
5. **imagePrompt**: A detailed AI image generation prompt describing: environment, characters, camera angle, composition, lighting, colors, mood, style, and quality. Must be compatible with Midjourney/DALL-E style generators. Use the theme "${settings.theme}" as the visual style. In English.
6. **animationPrompt**: A cinematic image-to-video prompt describing: camera movement, character motion, facial expressions, background movement, environmental effects, transitions, lighting changes, and motion style. Compatible with Google Veo, Runway, Kling, PixVerse, Pika, Luma. In English.
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
- Each narration should fit within ${sceneLength} seconds of speaking time.
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
  const sceneLength = project.settings.sceneLength || 8;

  if (regenField === 'narration') {
    return `You are rewriting ONLY the narration for scene ${scene.sceneNumber} of a YouTube video.
Video topic: ${project.topic}
Scene title: ${scene.title}
Scene goal: ${scene.goal}
Video language: ${project.settings.language}
Writing style: ${project.settings.writingStyle}
Target audience: ${project.settings.targetAudience}
Scene length: ${sceneLength} seconds

This is scene ${scene.sceneNumber} of ${totalScenes} total scenes.
Generate a compelling, natural narration for this ${sceneLength}-second scene (approximately ${Math.round(sceneLength * 2.5)}-${Math.round(sceneLength * 3.5)} words). Include pacing cues in brackets like [pause], [dramatic music], etc.
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
Scene length: ${sceneLength} seconds
Theme: ${project.settings.theme}
Language: ${project.settings.language}
Writing style: ${project.settings.writingStyle}
Target audience: ${project.settings.targetAudience}

This is scene ${scene.sceneNumber} of ${totalScenes} total scenes.

Generate a complete replacement scene with: title, estimatedDuration (set to ${sceneLength}), goal, narration (in ${project.settings.language}, for a ${sceneLength}-second scene, with pacing cues in brackets), imagePrompt (detailed, in English, for AI image generation in ${project.settings.theme} style), animationPrompt (detailed, in English, for AI video generation), and notes (emotion, visualFocus, transitionSuggestion, importantDetails).

Return ONLY valid JSON: { "title": "...", "estimatedDuration": ${sceneLength}, "goal": "...", "narration": "...", "imagePrompt": "...", "animationPrompt": "...", "notes": { "emotion": "...", "visualFocus": "...", "transitionSuggestion": "...", "importantDetails": "..." } }. No markdown fences.`;
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

function mapToScene(raw: Record<string, unknown>, index: number, projectId: string, startSceneNumber: number): Scene {
  const notes = raw.notes as Record<string, string> | undefined;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    sceneNumber: startSceneNumber + index,
    title: String(raw.title || `Scene ${startSceneNumber + index}`),
    estimatedDuration: Number(raw.estimatedDuration) || 8,
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
      const scenes = parsed.scenes.map((s, i) => mapToScene(s, i, project.id, 1));
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

export async function generatePhase(
  project: Project,
  phase: PhaseInfo
): Promise<{ scenes: Scene[]; metadata?: GeneratedMetadata }> {
  const prompt = buildPhasePrompt(project, phase);

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const text = await callServer(prompt, 65536);
      const parsed = parseGeminiJSON(text);
      const scenes = parsed.scenes.map((s, i) => mapToScene(s, i, project.id, phase.sceneStart));

      let metadata: GeneratedMetadata | undefined;
      if (phase.phaseNumber === 1) {
        metadata = {
          videoDescription: String(parsed.videoDescription || ''),
          tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: unknown) => String(t).toLowerCase()).slice(0, 15) : [],
          thumbnailPrompt: String(parsed.thumbnailPrompt || ''),
        };
      }

      return { scenes, metadata };
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to generate phase after retries.');
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