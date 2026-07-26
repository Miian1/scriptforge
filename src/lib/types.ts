export type VideoTheme = 'realistic' | 'anime' | 'cinematic' | 'cartoon' | '3d-render' | 'watercolor' | 'pixel-art';
export type WritingStyle = 'conversational' | 'professional' | 'dramatic' | 'educational' | 'storytelling' | 'humorous';
export type TargetAudience = 'beginners' | 'general' | 'intermediate' | 'experts' | 'kids' | 'teens';
export type VideoLanguage = 'english' | 'spanish' | 'french' | 'german' | 'portuguese' | 'japanese' | 'korean' | 'chinese' | 'hindi' | 'arabic';
export type VideoDuration = 'short' | 'medium' | 'long' | 'custom';
export type GenerationStatus = 'draft' | 'generating' | 'completed' | 'error';
export type AppView = 'dashboard' | 'create-project' | 'editor' | 'settings' | 'about';

export interface ProjectSettings {
  duration: VideoDuration;
  customVideoDuration?: number; // seconds — used when duration === 'custom'
  theme: VideoTheme;
  language: VideoLanguage;
  writingStyle: WritingStyle;
  targetAudience: TargetAudience;
  sceneLength: number;
  totalScenes: number;
  scenesPerPhase: number;
  /** 'niche' = use saved channel niche settings; 'custom' = manual override */
  productionMode?: 'niche' | 'custom';
}

export interface CharacterDesign {
  characterName: string;
  characterType: string;
  species: string;
  personality: string;
  artStyle: string;
  primaryColor: string;
  secondaryColor: string;
  outlineColor: string;
  headShape: string;
  bodyShape: string;
  eyeShape: string;
  mouthStyle: string;
  accessories: string;
  theme: string;
  animationStyle: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  design: CharacterDesign;
  imagePrompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface SceneNotes {
  emotion: string;
  visualFocus: string;
  transitionSuggestion: string;
  importantDetails: string;
}

export interface Scene {
  id: string;
  projectId: string;
  sceneNumber: number;
  title: string;
  estimatedDuration: number; // seconds
  goal: string;
  narration: string;
  imagePrompt: string;
  animationPrompt: string;
  characterIds: string[];
  narrationAudioPath: string;
  notes: SceneNotes;
  createdAt: number;
  updatedAt: number;
}

export interface ScoreEntry {
  titleScore: number;
  descriptionScore: number;
  tagsScore: number;
  nicheFit: number;
  trendScore: number;
  engagementScore: number;
  seoScore: number;
  overallScore: number;
  tip: string;
  scoredAt: number;
}

export interface Project {
  id: string;
  title: string;
  topic: string;
  description: string;
  thumbnailPrompt: string;
  tags: string[];
  settings: ProjectSettings;
  status: GenerationStatus;
  scoreHistory: ScoreEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
}

export const DURATION_LABELS: Record<VideoDuration, string> = {
  short: 'Short (2 min)',
  medium: 'Medium (8 min)',
  long: 'Long (25 min)',
  custom: 'Custom duration...',
};

export const DURATION_SECONDS: Record<VideoDuration, number> = {
  short: 120,
  medium: 480,
  long: 1500,
  custom: 0, // placeholder — actual value comes from settings.customVideoDuration
};

/**
 * Resolve the actual video duration in seconds for a project's settings.
 * Falls back to the standard presets if `custom` is selected but no
 * customVideoDuration is provided.
 */
export function resolveVideoDurationSeconds(settings: {
  duration: VideoDuration;
  customVideoDuration?: number;
}): number {
  if (settings.duration === 'custom') {
    const custom = Number(settings.customVideoDuration);
    if (custom > 0) return custom;
    // Fallback to medium if custom was selected without a value
    return DURATION_SECONDS.medium;
  }
  return DURATION_SECONDS[settings.duration];
}

export const SCENES_PER_PHASE = 10;

export const THEME_LABELS: Record<VideoTheme, string> = {
  realistic: 'Realistic',
  anime: 'Anime',
  cinematic: 'Cinematic',
  cartoon: 'Cartoon',
  '3d-render': '3D Render',
  watercolor: 'Watercolor',
  'pixel-art': 'Pixel Art',
};

export const STYLE_LABELS: Record<WritingStyle, string> = {
  conversational: 'Conversational',
  professional: 'Professional',
  dramatic: 'Dramatic',
  educational: 'Educational',
  storytelling: 'Storytelling',
  humorous: 'Humorous',
};

export const AUDIENCE_LABELS: Record<TargetAudience, string> = {
  beginners: 'Beginners',
  general: 'General Audience',
  intermediate: 'Intermediate',
  experts: 'Experts',
  kids: 'Kids (8-12)',
  teens: 'Teens (13-17)',
};

export const LANGUAGE_LABELS: Record<VideoLanguage, string> = {
  english: 'English',
  spanish: 'Spanish',
  french: 'French',
  german: 'German',
  portuguese: 'Portuguese',
  japanese: 'Japanese',
  korean: 'Korean',
  chinese: 'Chinese',
  hindi: 'Hindi',
  arabic: 'Arabic',
};

export const STATUS_LABELS: Record<GenerationStatus, string> = {
  draft: 'Draft',
  generating: 'Generating...',
  completed: 'Completed',
  error: 'Error',
};