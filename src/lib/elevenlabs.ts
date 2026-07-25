// ── ElevenLabs TTS Helper ──────────────────────────
// Server-side utility for ElevenLabs Text-to-Speech API.

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

if (!ELEVENLABS_API_KEY) {
  console.warn('[elevenlabs] ELEVENLABS_API_KEY is not set. Voice generation will be disabled.');
}

// ── Voice types ──────────────────────────────────────

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
  preview_url?: string;
  fine_tuning?: {
    finetuning_state: string;
    language: string;
  };
}

export interface VoiceSettings {
  stability: number;       // 0–1, default 0.5
  similarity_boost: number; // 0–1, default 0.75
  style: number;          // 0–1, default 0.0
  use_speaker_boost: boolean; // default true
  speed: number;          // 0.25–4.0, default 1.0
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
  speed: 1.0,
};

export const VOICE_SETTING_RANGES = {
  stability:       { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Stability', description: 'Higher values make the voice more consistent but less expressive' },
  similarity_boost: { min: 0, max: 1, step: 0.01, default: 0.75, label: 'Similarity', description: 'Higher values make the voice closer to the original speaker' },
  style:          { min: 0, max: 1, step: 0.01, default: 0.0, label: 'Style', description: 'Higher values make the voice more stylized and expressive' },
  speed:          { min: 0.25, max: 4.0, step: 0.05, default: 1.0, label: 'Speed', description: 'Controls the speaking speed of the voice' },
};

export interface TTSOptions {
  voiceId: string;
  text: string;
  settings?: Partial<VoiceSettings>;
  modelId?: string;
}

// ── API Functions ────────────────────────────────────

export async function listVoices(): Promise<ElevenLabsVoice[]> {
  if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key is not configured.');

  const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error((errData as Record<string, Record<string, string>>)?.detail?.message || `ElevenLabs API error: ${res.status}`);
  }

  const data = await res.json();
  return (data.voices || []) as ElevenLabsVoice[];
}

export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key is not configured.');

  const {
    voiceId,
    text,
    settings = {},
    modelId = 'eleven_multilingual_v2',
  } = options;

  // Merge settings with defaults
  const voiceSettings: VoiceSettings = {
    ...DEFAULT_VOICE_SETTINGS,
    ...settings,
  };

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error((errData as Record<string, Record<string, string>>)?.detail?.message || `ElevenLabs TTS error: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Clean narration text for TTS ─────────────────────
// Removes stage directions like [pause], [dramatic], [music], [emotional], etc.
export function stripStageDirections(text: string): string {
  return text
    // Remove bracketed content: [anything], (anything), *anything*
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\*.*?\*/g, '')
    // Remove remaining empty parentheses/brackets
    .replace(/[\[\]\(\)]/g, '')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Trim
    .trim();
}

// Available TTS models
export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Latest multilingual model, best quality' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Low latency, good quality' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2', description: 'Fast generation speed' },
  { id: 'eleven_monolingual_v1', name: 'English v1', description: 'English only, classic model' },
];
