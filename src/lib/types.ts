export type VideoTheme = 'realistic' | 'anime' | 'cinematic' | 'cartoon' | '3d-render' | 'watercolor' | 'pixel-art';
export type WritingStyle = 'conversational' | 'professional' | 'dramatic' | 'educational' | 'storytelling' | 'humorous';
export type TargetAudience = 'beginners' | 'general' | 'intermediate' | 'experts' | 'kids' | 'teens';
export type VideoLanguage = 'english' | 'spanish' | 'french' | 'german' | 'portuguese' | 'japanese' | 'korean' | 'chinese' | 'hindi' | 'arabic';
export type VideoDuration = 'short' | 'medium' | 'long';
export type GenerationStatus = 'draft' | 'generating' | 'completed' | 'error';
export type AppView = 'dashboard' | 'create-project' | 'editor' | 'settings' | 'about';

export interface ProjectSettings {
  duration: VideoDuration;
  theme: VideoTheme;
  language: VideoLanguage;
  writingStyle: WritingStyle;
  targetAudience: TargetAudience;
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
  notes: SceneNotes;
  createdAt: number;
  updatedAt: number;
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
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
}

export const DURATION_LABELS: Record<VideoDuration, string> = {
  short: 'Short (1-3 min)',
  medium: 'Medium (5-10 min)',
  long: 'Long (15-30 min)',
};

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