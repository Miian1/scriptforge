// ── Gemini TTS Helper ──────────────────────────────
// Server-side utility for Gemini Text-to-Speech API.
// Uses the Interactions API: POST /v1beta/interactions

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TTS_BASE = 'https://generativelanguage.googleapis.com/v1beta';

if (!GEMINI_API_KEY) {
  console.warn('[gemini-tts] GEMINI_API_KEY is not set. Voice generation will be disabled.');
}

// ── Voice definitions ──────────────────────────────

export interface GeminiVoice {
  name: string;
  description: string;
  category: string;
}

export const GEMINI_TTS_VOICES: GeminiVoice[] = [
  // Bright / Clear
  { name: 'Zephyr', description: 'Bright', category: 'Narration' },
  { name: 'Autonoe', description: 'Bright', category: 'Narration' },
  { name: 'Iapetus', description: 'Clear', category: 'Narration' },
  { name: 'Erinome', description: 'Clear', category: 'Narration' },

  // Upbeat / Excitable
  { name: 'Puck', description: 'Upbeat', category: 'Energetic' },
  { name: 'Fenrir', description: 'Excitable', category: 'Energetic' },
  { name: 'Laomedeia', description: 'Upbeat', category: 'Energetic' },
  { name: 'Sadachbia', description: 'Lively', category: 'Energetic' },

  // Informative / Knowledgeable
  { name: 'Charon', description: 'Informative', category: 'Professional' },
  { name: 'Rasalgethi', description: 'Informative', category: 'Professional' },
  { name: 'Sadaltager', description: 'Knowledgeable', category: 'Professional' },

  // Firm / Confident
  { name: 'Kore', description: 'Firm', category: 'Confident' },
  { name: 'Orus', description: 'Firm', category: 'Confident' },
  { name: 'Alnilam', description: 'Firm', category: 'Confident' },

  // Smooth / Soft / Gentle
  { name: 'Algieba', description: 'Smooth', category: 'Warm' },
  { name: 'Despina', description: 'Smooth', category: 'Warm' },
  { name: 'Achernar', description: 'Soft', category: 'Warm' },
  { name: 'Vindemiatrix', description: 'Gentle', category: 'Warm' },
  { name: 'Sulafat', description: 'Warm', category: 'Warm' },
  { name: 'Achird', description: 'Friendly', category: 'Warm' },

  // Youthful / Breezy
  { name: 'Leda', description: 'Youthful', category: 'Casual' },
  { name: 'Aoede', description: 'Breezy', category: 'Casual' },
  { name: 'Callirrhoe', description: 'Easy-going', category: 'Casual' },
  { name: 'Umbriel', description: 'Easy-going', category: 'Casual' },
  { name: 'Zubenelgenubi', description: 'Casual', category: 'Casual' },

  // Dramatic / Character
  { name: 'Enceladus', description: 'Breathy', category: 'Character' },
  { name: 'Algenib', description: 'Gravelly', category: 'Character' },
  { name: 'Gacrux', description: 'Mature', category: 'Character' },
  { name: 'Pulcherrima', description: 'Forward', category: 'Character' },
  { name: 'Schedar', description: 'Even', category: 'Character' },
];

// Voice categories for filtering
export const VOICE_CATEGORIES = [...new Set(GEMINI_TTS_VOICES.map(v => v.category))].sort();

// ── TTS Style / Pace / Accent options ─────────────────

export const TTS_STYLES = [
  { value: '', label: 'Default' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'news_anchor', label: 'News Anchor' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'excited', label: 'Excited' },
  { value: 'calm', label: 'Calm' },
  { value: 'whisper', label: 'Whisper' },
  { value: 'cheerful', label: 'Cheerful' },
  { value: 'serious', label: 'Serious' },
];

export const TTS_PACES = [
  { value: '', label: 'Default' },
  { value: 'very_slow', label: 'Very Slow' },
  { value: 'slow', label: 'Slow' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'fast', label: 'Fast' },
  { value: 'very_fast', label: 'Very Fast' },
];

export const TTS_ACCENTS = [
  { value: '', label: 'Default (Auto)' },
  { value: 'american', label: 'American' },
  { value: 'british', label: 'British' },
  { value: 'australian', label: 'Australian' },
  { value: 'neutral', label: 'Neutral / Accent-free' },
];

/**
 * Build natural-language instructions from Style / Pace / Accent selections.
 */
export function buildInstructions(
  style: string,
  pace: string,
  accent: string,
  customInstructions: string,
): string {
  const parts: string[] = [];

  if (style) {
    parts.push(style);
  }

  if (pace === 'very_slow') parts.push('speak very slowly');
  else if (pace === 'slow') parts.push('speak slowly');
  else if (pace === 'moderate') parts.push('speak at a moderate pace');
  else if (pace === 'fast') parts.push('speak quickly');
  else if (pace === 'very_fast') parts.push('speak very quickly');

  if (accent === 'american') parts.push('with an American accent');
  else if (accent === 'british') parts.push('with a British accent');
  else if (accent === 'australian') parts.push('with an Australian accent');
  else if (accent === 'neutral') parts.push('with a neutral accent');

  if (customInstructions.trim()) {
    parts.push(customInstructions.trim());
  }

  return parts.join(', ');
}

// ── TTS Model ───────────────────────────────────────

export const GEMINI_TTS_MODEL_FALLBACK = 'gemini-3.1-flash-tts-preview';

// ── TTS Options ──────────────────────────────────────

export interface TTSOptions {
  voiceName: string;
  text: string;
  instructions?: string;
  modelId?: string;
}

// ── API Functions ────────────────────────────────────

/**
 * List available TTS voices (returns the hardcoded list since Gemini TTS doesn't
 * have a separate voices endpoint — voices are built into the model).
 */
export async function listVoices(): Promise<GeminiVoice[]> {
  return GEMINI_TTS_VOICES;
}

/**
 * Generate speech from text using Gemini TTS Interactions API.
 * Returns PCM audio data (24kHz, 16-bit, mono) which we convert to a WAV buffer.
 */
export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.');

  const {
    voiceName,
    text,
    instructions = '',
    modelId = GEMINI_TTS_MODEL_FALLBACK,
  } = options;

  if (!voiceName) throw new Error('voiceName is required.');
  if (!text || text.trim().length === 0) throw new Error('text is required and must be non-empty.');

  // Build the input — prepend any style instructions
  const input = instructions ? `${instructions}: ${text}` : text;

  const url = `${GEMINI_TTS_BASE}/interactions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: modelId,
      input,
      response_format: {
        type: 'audio',
      },
      generation_config: {
        speech_config: [
          { voice: voiceName },
        ],
      },
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error('[gemini-tts] API error response:', JSON.stringify(errData));
    const msg = (errData as Record<string, Record<string, string>>)?.error?.message || `Gemini TTS error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json() as Record<string, unknown>;

  // Debug: log raw response keys for troubleshooting
  console.log('[gemini-tts] Response top-level keys:', Object.keys(data));

  // Strategy 1: interaction.output_audio.data (SDK-style response from Interactions API)
  const interaction = data['interaction'] as Record<string, unknown> | undefined;
  if (interaction) {
    // Try snake_case (SDK convention)
    const outputAudio = interaction['output_audio'] as Record<string, unknown> | undefined;
    if (outputAudio && outputAudio['data']) {
      return base64ToWav(outputAudio['data'] as string);
    }
    // Try camelCase (REST convention)
    const outputAudioCamel = interaction['outputAudio'] as Record<string, unknown> | undefined;
    if (outputAudioCamel && outputAudioCamel['data']) {
      return base64ToWav(outputAudioCamel['data'] as string);
    }
    // Try candidates inside interaction
    const candidates = interaction['candidates'] as Array<Record<string, unknown>> | undefined;
    const audioFromCandidates = extractAudioFromCandidates(candidates);
    if (audioFromCandidates) return audioFromCandidates;
  }

  // Strategy 2: candidates at top level (standard generateContent response)
  const topCandidates = data['candidates'] as Array<Record<string, unknown>> | undefined;
  const audioFromTop = extractAudioFromCandidates(topCandidates);
  if (audioFromTop) return audioFromTop;

  // Strategy 3: outputAudio at top level
  const topOutputAudio = data['output_audio'] as Record<string, unknown> | undefined
    || data['outputAudio'] as Record<string, unknown> | undefined;
  if (topOutputAudio && topOutputAudio['data']) {
    return base64ToWav(topOutputAudio['data'] as string);
  }

  console.error('[gemini-tts] Full response:', JSON.stringify(data).substring(0, 2000));
  throw new Error('No audio data found in Gemini TTS response.');
}

/**
 * Extract audio base64 from a candidates array (handles both snake_case and camelCase).
 */
function extractAudioFromCandidates(
  candidates: Array<Record<string, unknown>> | undefined,
): Buffer | null {
  if (!candidates || candidates.length === 0) return null;

  const content = candidates[0]['content'] as Record<string, unknown> | undefined;
  if (!content) return null;

  const parts = content['parts'] as Array<Record<string, unknown>> | undefined;
  if (!parts || parts.length === 0) return null;

  for (const part of parts) {
    // Try snake_case
    const inlineData = part['inline_data'] as Record<string, unknown> | undefined;
    if (inlineData && inlineData['data']) {
      return base64ToWav(inlineData['data'] as string);
    }
    // Try camelCase
    const inlineDataCamel = part['inlineData'] as Record<string, unknown> | undefined;
    if (inlineDataCamel && inlineDataCamel['data']) {
      return base64ToWav(inlineDataCamel['data'] as string);
    }
  }

  return null;
}

/**
 * Convert raw PCM base64 data (24kHz, 16-bit, mono) to a WAV buffer.
 */
function base64ToWav(base64Data: string): Buffer {
  const pcmBuffer = Buffer.from(base64Data, 'base64');

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;

  // Build WAV header (44 bytes)
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20);   // AudioFormat (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// ── Clean narration text for TTS ─────────────────────
export function stripStageDirections(text: string): string {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\*.*?\*/g, '')
    .replace(/[\[\]\(\)]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
