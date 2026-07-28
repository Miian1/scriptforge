import type { Project, Scene } from './types';

export interface ChannelCharacter {
  id: string;
  name: string;
  role: string;
  description: string;
  visualPrompt: string;
  personalityPrompt: string;
}

export interface ChannelNiche {
  visualTheme: string;
  writingStyle: string;
  audience: string;
  language: string;
  description: string;
  channelName: string;
  channelDescription: string;
  channelCategory: string;
  channelUrl: string;
  characters?: ChannelCharacter[];
}

/**
 * Build the channel niche context block for prompts.
 * This includes brand guidelines AND (critically) character definitions
 * with HARD rules for consistent usage across ALL scenes.
 */
function buildNicheContext(niche?: ChannelNiche | null): string {
  if (!niche || (!niche.visualTheme && !niche.writingStyle && !niche.audience && !niche.language && !niche.description && !niche.channelName)) {
    return '';
  }
  let ctx = '\n## Channel Niche & Brand Guidelines\nThe user has a YouTube channel with specific style preferences. Follow these guidelines STRICTLY:\n';
  if (niche.channelName) ctx += `- Channel Name: ${niche.channelName}\n`;
  if (niche.channelCategory) ctx += `- Channel Category: ${niche.channelCategory}\n`;
  if (niche.channelDescription) ctx += `- About Channel: ${niche.channelDescription}\n`;
  if (niche.visualTheme) ctx += `- Visual Theme: ${niche.visualTheme}\n`;
  if (niche.writingStyle) ctx += `- Writing Style: ${niche.writingStyle}\n`;
  if (niche.audience) ctx += `- Target Audience: ${niche.audience}\n`;
  if (niche.language) ctx += `- Channel Language: ${niche.language}\n`;
  if (niche.description) ctx += `\n### Detailed Niche Context:\n${niche.description}\n`;

  // ── Channel Characters (MANDATORY usage) ──
  const validChars = (niche.characters || []).filter((c) => c.name && c.name.trim());
  if (validChars.length > 0) {
    ctx += `\n### MANDATORY: Channel Characters (Recurring Personas)\n`;
    ctx += `The following characters are DEFINED for this channel. You MUST use them in EVERY scene that features a person, host, narrator, expert, or any humanoid figure. NEVER invent random or generic characters. Every person shown in imagePrompt or mentioned in narration MUST be one of these characters.\n\n`;
    validChars.forEach((c, i) => {
      ctx += `**CHARACTER ${i + 1}: "${c.name.trim()}"**\n`;
      if (c.role) ctx += `- Role: ${c.role.trim()}\n`;
      if (c.description) ctx += `- Full Description: ${c.description.trim()}\n`;
      if (c.visualPrompt) ctx += `- EXACT Visual Appearance (copy this VERBATIM into every imagePrompt where this character appears): "${c.visualPrompt.trim()}"\n`;
      if (c.personalityPrompt) ctx += `- EXACT Voice & Personality (match this VERBATIM in every narration where this character speaks): "${c.personalityPrompt.trim()}"\n`;
      ctx += `\n`;
    });

    // Hard consistency rules
    ctx += `### CHARACTER CONSISTENCY RULES (FOLLOW STRICTLY):\n`;
    ctx += `1. **EVERY scene that shows a person** MUST feature one of the above characters as the primary figure. No exceptions.\n`;
    ctx += `2. **Visual identity must be IDENTICAL in every scene.** The same character must look exactly the same across ALL scenes — same face, same clothing, same features, same colors. Copy the "EXACT Visual Appearance" text verbatim into the imagePrompt.\n`;
    ctx += `3. **Voice must be IDENTICAL in every scene.** When a character narrates, their tone, vocabulary, and speaking style must match their "EXACT Voice & Personality" verbatim.\n`;
    ctx += `4. **Distribute characters naturally.** If multiple characters exist, assign them to scenes based on their role (e.g., the Host appears most often, the Expert appears in educational scenes). Do NOT cluster all scenes around one character.\n`;
    ctx += `5. **NEVER describe a character generically** (e.g. "a man in a suit", "a woman presenting"). ALWAYS use the character's NAME and their EXACT visual description.\n`;
    ctx += `6. **In imagePrompt**: ALWAYS start the character description with the character's name and paste their full visual prompt. Example format: "[Character Name], [EXACT Visual Appearance], [scene environment and composition]".\n`;
    ctx += `7. **In narration**: When a character speaks, their dialogue MUST reflect their personality prompt. The narration voice changes depending on WHO is speaking.\n`;
  }

  ctx += '\nIMPORTANT: Generate content that matches this channel\'s brand identity. The narration, visual prompts, and overall tone should feel like it belongs on this channel. Characters must remain 100% consistent across all scenes.';
  return ctx;
}

/**
 * Build a compact character reference card for injection into
 * per-scene instructions and regeneration prompts.
 * This is a shorter version that reinforces consistency without
 * repeating the full niche context.
 */
function buildCharacterRef(niche?: ChannelNiche | null): string {
  if (!niche) return '';
  const validChars = (niche.characters || []).filter((c) => c.name && c.name.trim());
  if (validChars.length === 0) return '';

  let ref = `\n### CHARACTER REFERENCE (use in EVERY scene with a person):\n`;
  validChars.forEach((c) => {
    ref += `- "${c.name.trim()}"`;
    if (c.role) ref += ` (${c.role.trim()})`;
    ref += `\n  Visual: ${c.visualPrompt.trim() || 'Not specified'}\n`;
    ref += `  Voice: ${c.personalityPrompt.trim() || 'Not specified'}\n`;
  });
  ref += `\nRule: Copy the EXACT visual description into imagePrompt. Match the EXACT voice in narration. NEVER invent unnamed characters.\n`;
  return ref;
}

/**
 * Build a CRITICAL RULES-level block enforcing character consistency.
 * This is injected at the end of the rules section to have maximum
 * attention weight — LLMs tend to follow instructions near the end more.
 */
function buildCharacterConsistencyRule(niche?: ChannelNiche | null): string {
  if (!niche) return '';
  const validChars = (niche.characters || []).filter((c) => c.name && c.name.trim());
  if (validChars.length === 0) return '';

  return `\n### ⚠️ CHARACTER ENFORCEMENT (HIGHEST PRIORITY — VERIFY BEFORE OUTPUT):
- Before outputting each scene, check: Does the imagePrompt start with a defined character's name and include their EXACT visual description? If not, FIX IT.
- Before outputting each scene, check: Does the narration match the character's EXACT personality? If not, FIX IT.
- Every scene's notes MUST include a "character" field naming which channel character appears.
- FAILURE TO USE THE DEFINED CHARACTERS = FAILURE TO FOLLOW INSTRUCTIONS.`;
}

/**
 * Build a character assignment guide for multi-scene generation.
 * Tells the AI which character should appear in which scene range,
 * preventing the AI from losing track across long scripts.
 */
function buildSceneCharacterInstructions(
  niche?: ChannelNiche | null,
  scenesInPhase: number,
  startScene: number,
): string {
  if (!niche) return '';
  const validChars = (niche.characters || []).filter((c) => c.name && c.name.trim());
  if (validChars.length === 0) return '';

  const names = validChars.map((c) => `"${c.name.trim()}"`).join(', ');
  const host = validChars.find((c) => c.role?.toLowerCase().includes('host')) || validChars[0];
  const others = validChars.filter((c) => c !== host);

  let instructions = `\n### Character Assignment Guide for Scenes ${startScene}–${startScene + scenesInPhase - 1}:\n`;
  instructions += `Available characters: ${names}.\n`;

  if (validChars.length === 1) {
    instructions += `- Character "${host.name.trim()}" should appear as the primary figure in ALL ${scenesInPhase} scenes.\n`;
  } else {
    instructions += `- "${host.name.trim()}" (Host) should appear in the MAJORITY of scenes as the primary presenter/narrator.\n`;
    others.forEach((c) => {
      instructions += `- "${c.name.trim()}" (${c.role.trim() || 'Supporting'}) should appear in 1-2 scenes where their expertise/role is most relevant.\n`;
    });
    instructions += `\nDecide NOW which scenes each character appears in, then be CONSISTENT throughout. Do NOT randomly switch characters between scenes — plan the assignment first.\n`;
  }

  instructions += `\nFor EVERY scene, the imagePrompt and narration MUST clearly feature the assigned character — no faceless/generic figures.\n`;
  return instructions;
}

// ---------- Prompt templates ----------

export interface PhaseInfo {
  phaseNumber: number;
  totalPhases: number;
  sceneStart: number;
  sceneEnd: number;
  previousPhaseTitles: string[];
}

// ── Research context ──
// Output of generateResearch() — fed into buildPhasePrompt so scene
// generation is informed by real analysis of the user's channel + niche.
export interface ResearchContext {
  /** Short summary of the channel + niche analysis (2-4 sentences). */
  channelSummary: string;
  /** Angles / hooks the script should leverage (3-6 items). */
  angles: string[];
  /** Recurring themes the user's audience responds to. */
  contentGaps: string[];
  /** Suggested narrative structure (intro hook → body → CTA). */
  narrativeArc: string;
  /** SEO keywords to weave into narration / description. */
  keywords: string[];
  /** Free-form extra notes the AI should consider. */
  notes: string;
}

/** Compact, in-prompt rendering of the research findings. */
function buildResearchContext(research?: ResearchContext | null): string {
  if (!research) return '';
  let out = '\n## Pre-Generation Research Findings\n';
  out += `The following research was performed BEFORE scene generation. Use it to ground the script in the channel's actual performance and audience.\n\n`;
  if (research.channelSummary) out += `**Channel Summary:** ${research.channelSummary}\n\n`;
  if (research.angles.length > 0) {
    out += `**Angles & Hooks to leverage:**\n`;
    research.angles.forEach((a) => (out += `- ${a}\n`));
    out += `\n`;
  }
  if (research.contentGaps.length > 0) {
    out += `**Audience content gaps to address:**\n`;
    research.contentGaps.forEach((g) => (out += `- ${g}\n`));
    out += `\n`;
  }
  if (research.narrativeArc) out += `**Suggested narrative arc:** ${research.narrativeArc}\n\n`;
  if (research.keywords.length > 0) {
    out += `**SEO keywords (weave into narration naturally):** ${research.keywords.join(', ')}\n\n`;
  }
  if (research.notes) out += `**Additional notes:** ${research.notes}\n\n`;
  out += `IMPORTANT: Treat this research as authoritative guidance. The scenes you generate should reflect these angles and gaps.\n`;
  return out;
}

function buildPhasePrompt(
  project: Project,
  phase: PhaseInfo,
  niche?: ChannelNiche | null,
  research?: ResearchContext | null,
): string {
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
3. **thumbnailPrompt**: A detailed AI image generation prompt for the video thumbnail. MUST feature the main channel character (with their EXACT visual appearance) in an eye-catching pose. Bold colors, clear text overlay space, conveys the video's main idea at a glance. Style: ${settings.theme}. Max 150 words.

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
${buildNicheContext(niche)}
${buildResearchContext(research)}
${previousContext}

## Your Task
Generate exactly ${scenesInThisPhase} scenes for this phase of the video. Each scene's narration MUST be appropriate for a ${sceneLength}-second scene (approximately ${Math.round(sceneLength * 2.5)}-${Math.round(sceneLength * 3.5)} words of spoken text).

For each scene, generate:
1. **title**: A short descriptive scene title (5-8 words)
2. **estimatedDuration**: Set to ${sceneLength} (this is the fixed scene length)
3. **goal**: What this scene accomplishes (1-2 sentences)
4. **narration**: Complete spoken narration for a ${sceneLength}-second scene. Write in the voice of the character assigned to this scene — match their EXACT personality, vocabulary, and speaking style. Include pacing cues in brackets like [pause], [dramatic music]. Must be in ${settings.language}.
5. **imagePrompt**: A detailed AI image generation prompt. MUST start with the assigned character's name and EXACT visual appearance (copied verbatim), then describe the environment, camera angle, composition, lighting, colors, mood, style, and quality. Must be compatible with Midjourney/DALL-E style generators. Use the theme "${settings.theme}" as the visual style. ALWAYS include the character — NEVER use generic descriptions like "a person" or "someone". In English.
6. **animationPrompt**: A cinematic image-to-video prompt. Animate the assigned character according to their personality — their expressions, gestures, and movement style should match who they are. Describe: camera movement, character motion, facial expressions, background movement, environmental effects, transitions, lighting changes, and motion style. Compatible with Google Veo, Runway, Kling, PixVerse, Pika, Luma. In English.
7. **notes** containing:
   - "character": The name of the channel character featured in this scene
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
- ${!isFirstPhase && !isLastPhase ? 'This is a MIDDLE phase — maintain momentum and develop the core content.' : ''}
${buildCharacterConsistencyRule(niche)}
${buildSceneCharacterInstructions(niche, scenesInThisPhase, phase.sceneStart)}`;

}

function buildSystemPrompt(project: Project, niche?: ChannelNiche | null): string {
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
${buildNicheContext(niche)}

## Your Task
Research this topic mentally, then produce a complete production script broken into individual scenes. Each scene's narration MUST be appropriate for a ${sceneLength}-second scene (approximately ${Math.round(sceneLength * 2.5)}-${Math.round(sceneLength * 3.5)} words of spoken text).

For each scene, generate:
1. **title**: A short descriptive scene title (5-8 words)
2. **estimatedDuration**: Set to ${sceneLength} (this is the fixed scene length)
3. **goal**: What this scene accomplishes (1-2 sentences)
4. **narration**: Complete spoken narration for a ${sceneLength}-second scene. Write in the voice of the character assigned to this scene — match their EXACT personality, vocabulary, and speaking style. Include pacing cues in brackets like [pause], [dramatic music].
5. **imagePrompt**: A detailed AI image generation prompt. MUST start with the assigned character's name and EXACT visual appearance (copied verbatim), then describe the environment, camera angle, composition, lighting, colors, mood, style, and quality. Must be compatible with Midjourney/DALL-E style generators. Use the theme "${settings.theme}" as the visual style. ALWAYS include the character — NEVER use generic descriptions like "a person" or "someone". In English.
6. **animationPrompt**: A cinematic image-to-video prompt. Animate the assigned character according to their personality — their expressions, gestures, and movement style should match who they are. Describe: camera movement, character motion, facial expressions, background movement, environmental effects, transitions, lighting changes, and motion style. Compatible with Google Veo, Runway, Kling, PixVerse, Pika, Luma. In English.
7. **notes** containing:
   - "character": The name of the channel character featured in this scene
   - "emotion": The primary emotion conveyed
   - "visualFocus": What the viewer's eye should be drawn to
   - "transitionSuggestion": How to transition to the next scene
   - "importantDetails": Any critical production notes

## ALSO generate these metadata fields at the top level of the JSON (alongside "scenes"):
1. **videoDescription**: A compelling 3-5 sentence YouTube video description optimized for SEO. Include the main keyword in the first line. Add relevant hashtags at the end. Make it engaging and include a call-to-action.
2. **tags**: An array of 8-12 relevant YouTube SEO tags (lowercase strings). Mix broad and long-tail keywords related to the topic.
3. **thumbnailPrompt**: A detailed AI image generation prompt for the video thumbnail. MUST feature the main channel character (with their EXACT visual appearance) in an eye-catching pose. Bold colors, clear text overlay space, conveys the video's main idea at a glance. Style: ${settings.theme}. Max 150 words.

## CRITICAL RULES
- Return ONLY valid JSON — no markdown, no code fences, no explanation.
- The JSON must have a top-level "scenes" array AND top-level "videoDescription", "tags", and "thumbnailPrompt" fields.
- Narration must be in ${settings.language}.
- All prompts must be in English regardless of video language.
- Make the narration compelling and natural — avoid robotic phrasing.
- Each narration should fit within ${sceneLength} seconds of speaking time.
- Image and animation prompts should be highly detailed and specific.
- Ensure scenes flow logically with proper pacing.
- Total estimated duration of all scenes should match the requested video duration.
${buildCharacterConsistencyRule(niche)}`;
}

function buildRegenPrompt(
  project: Project,
  scene: Scene,
  totalScenes: number,
  regenField?: 'narration' | 'imagePrompt' | 'animationPrompt',
  niche?: ChannelNiche | null
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
${buildNicheContext(niche)}
${buildCharacterRef(niche)}
This is scene ${scene.sceneNumber} of ${totalScenes} total scenes.
Generate a compelling, natural narration for this ${sceneLength}-second scene (approximately ${Math.round(sceneLength * 2.5)}-${Math.round(sceneLength * 3.5)} words). Write in the EXACT voice and personality of the character assigned to this scene. Include pacing cues in brackets like [pause], [dramatic music], etc.
Return ONLY valid JSON with a single key "narration" containing the narration text. No markdown fences.`;
  }
  if (regenField === 'imagePrompt') {
    return `You are rewriting ONLY the AI image generation prompt for scene ${scene.sceneNumber} of a YouTube video.
Video topic: ${project.topic}
Scene title: ${scene.title}
Scene goal: ${scene.goal}
Visual theme: ${project.settings.theme}
${buildCharacterRef(niche)}
CRITICAL: The imagePrompt MUST start with the channel character's name and their EXACT visual appearance (copied verbatim). Then describe the environment, composition, lighting, mood, and style. NEVER use generic descriptions like "a person" or "someone". Use the "${project.settings.theme}" visual style. Make it compatible with Midjourney/DALL-E.
Return ONLY valid JSON with a single key "imagePrompt" containing the prompt text. No markdown fences.`;
  }
  if (regenField === 'animationPrompt') {
    return `You are rewriting ONLY the AI video/animation prompt for scene ${scene.sceneNumber} of a YouTube video.
Video topic: ${project.topic}
Scene title: ${scene.title}
Scene goal: ${scene.goal}
Visual theme: ${project.settings.theme}
${buildCharacterRef(niche)}
CRITICAL: Animate the channel character according to their EXACT personality — their expressions, gestures, and movement style must match who they are. Describe: camera movement, character motion, facial expressions, background movement, environmental effects, transitions, lighting changes, and motion style. Compatible with Google Veo, Runway, Kling, PixVerse, Pika, Luma.
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

${buildCharacterRef(niche)}

This is scene ${scene.sceneNumber} of ${totalScenes} total scenes.

Generate a complete replacement scene with: title, estimatedDuration (set to ${sceneLength}), goal, narration (in ${project.settings.language}, for a ${sceneLength}-second scene, written in the character's EXACT voice, with pacing cues in brackets), imagePrompt (detailed, in English, MUST include the character's EXACT name and visual appearance, for AI image generation in ${project.settings.theme} style), animationPrompt (detailed, in English, animate the character per their personality, for AI video generation), and notes (character, emotion, visualFocus, transitionSuggestion, importantDetails).

CRITICAL: The character featured in this scene must look and sound IDENTICAL to the channel's character definition. Copy their visual prompt verbatim into the imagePrompt.

Return ONLY valid JSON: { "title": "...", "estimatedDuration": ${sceneLength}, "goal": "...", "narration": "...", "imagePrompt": "...", "animationPrompt": "...", "notes": { "character": "...", "emotion": "...", "visualFocus": "...", "transitionSuggestion": "...", "importantDetails": "..." } }. No markdown fences.`;
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

export async function generateScript(project: Project, niche?: ChannelNiche | null): Promise<{ scenes: Scene[]; metadata: GeneratedMetadata }> {
  const systemPrompt = buildSystemPrompt(project, niche);

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
  phase: PhaseInfo,
  niche?: ChannelNiche | null,
  research?: ResearchContext | null,
): Promise<{ scenes: Scene[]; metadata?: GeneratedMetadata }> {
  const prompt = buildPhasePrompt(project, phase, niche, research);

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
  regenField?: 'narration' | 'imagePrompt' | 'animationPrompt',
  niche?: ChannelNiche | null
): Promise<Partial<Scene>> {
  const prompt = buildRegenPrompt(project, scene, totalScenes, regenField, niche);

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

// ── Research step ──────────────────────────────────────
// Performs a real research call BEFORE scene generation.
// Analyzes the user's YouTube channel + recent videos + niche,
// and returns structured findings (angles, gaps, narrative arc,
// keywords) that get injected into the scene generation prompt.

export interface YouTubeResearchInput {
  channelTitle?: string;
  channelDescription?: string;
  subscriberCount?: number;
  videoCount?: number;
  recentVideos?: Array<{
    title: string;
    views?: number;
    likes?: number;
    comments?: number;
    publishedAt?: string;
  }>;
}

function buildResearchPrompt(
  project: Project,
  niche: ChannelNiche | null | undefined,
  yt: YouTubeResearchInput | null | undefined,
): string {
  const { topic, description, settings } = project;
  let ytSection = '';
  if (yt && (yt.channelTitle || (yt.recentVideos && yt.recentVideos.length > 0))) {
    ytSection = '\n## User\'s YouTube Channel (real data)\n';
    if (yt.channelTitle) ytSection += `- Channel Title: ${yt.channelTitle}\n`;
    if (yt.channelDescription) ytSection += `- Channel Description: ${yt.channelDescription.slice(0, 600)}\n`;
    if (typeof yt.subscriberCount === 'number') ytSection += `- Subscribers: ${yt.subscriberCount.toLocaleString()}\n`;
    if (typeof yt.videoCount === 'number') ytSection += `- Total Videos: ${yt.videoCount.toLocaleString()}\n`;
    if (yt.recentVideos && yt.recentVideos.length > 0) {
      ytSection += `\n### Recent Videos (analyze titles, view counts, what worked):\n`;
      yt.recentVideos.slice(0, 10).forEach((v, i) => {
        const views = typeof v.views === 'number' ? v.views.toLocaleString() : '?';
        const likes = typeof v.likes === 'number' ? v.likes.toLocaleString() : '?';
        ytSection += `${i + 1}. "${v.title}" — ${views} views, ${likes} likes`;
        if (v.publishedAt) ytSection += ` (${new Date(v.publishedAt).toLocaleDateString()})`;
        ytSection += `\n`;
      });
    }
    ytSection += '\nIMPORTANT: Use this real channel data to inform your research. Identify which of their past videos/topics performed well and why. Find gaps their audience would respond to.\n';
  }

  return `You are a YouTube content strategist. Analyze the user's channel, niche, and the topic they want to make a video about, then return structured research findings that will guide scene generation.

## Video Plan
- Topic: ${topic}
- Description: ${description || 'N/A'}
- Target Language: ${settings.language}
- Writing Style: ${settings.writingStyle}
- Target Audience: ${settings.targetAudience}
${buildNicheContext(niche)}
${ytSection}

## Your Task
Produce a focused research summary that will be consumed by a downstream AI scriptwriter. Be specific and actionable — generic platitudes are not useful.

Return ONLY valid JSON (no markdown, no fences) with these exact fields:
{
  "channelSummary": "2-4 sentences summarizing this channel's identity, niche fit, and what their audience expects.",
  "angles": ["3-6 specific angles or hooks the script should leverage for THIS topic. Each angle = 1 sentence."],
  "contentGaps": ["3-5 content gaps the audience has that this video could fill. Each gap = 1 sentence."],
  "narrativeArc": "1-2 sentences describing the suggested narrative arc (e.g. 'Open with a counterintuitive hook, build evidence through 3 case studies, end with a practical CTA').",
  "keywords": ["6-10 SEO keywords to weave into narration and description naturally"],
  "notes": "Any other important notes for the scriptwriter (tone, things to avoid, references to competitor videos, etc.)"
}

CRITICAL RULES:
- Return ONLY JSON. No prose before or after.
- All text must be in ${settings.language} except keywords which can be in English.
- Be specific to THIS topic and THIS channel — do not give generic advice.`;
}

/**
 * Run the research step. Returns null on failure (the wizard should
 * continue with scene generation even if research fails — research is
 * an enhancement, not a blocker).
 */
export async function generateResearch(
  project: Project,
  niche: ChannelNiche | null | undefined,
  yt: YouTubeResearchInput | null | undefined,
): Promise<ResearchContext | null> {
  const prompt = buildResearchPrompt(project, niche, yt);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callServer(prompt, 8192);

      // Parse — research response is JSON, but be defensive about fences
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
          else throw new Error('Cannot parse research response');
        }
      }

      const toArray = (v: unknown): string[] =>
        Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 12) : [];

      return {
        channelSummary: String(parsed.channelSummary || '').slice(0, 1200),
        angles: toArray(parsed.angles),
        contentGaps: toArray(parsed.contentGaps),
        narrativeArc: String(parsed.narrativeArc || '').slice(0, 600),
        keywords: toArray(parsed.keywords),
        notes: String(parsed.notes || '').slice(0, 1200),
      };
    } catch (err) {
      if (attempt === 1) {
        console.warn('[generateResearch] failed twice, returning null:', err);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}