// ── Gemini TTS Helper ──────────────────────────────
// Server-side utility for Gemini Text-to-Speech API.
// Uses the generateContent endpoint with AUDIO response modality.

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

  if (style) parts.push(style);

  if (pace === 'very_slow') parts.push('speak very slowly');
  else if (pace === 'slow') parts.push('speak slowly');
  else if (pace === 'moderate') parts.push('speak at a moderate pace');
  else if (pace === 'fast') parts.push('speak quickly');
  else if (pace === 'very_fast') parts.push('speak very quickly');

  if (accent === 'american') parts.push('with an American accent');
  else if (accent === 'british') parts.push('with a British accent');
  else if (accent === 'australian') parts.push('with an Australian accent');
  else if (accent === 'neutral') parts.push('with a neutral accent');

  if (customInstructions.trim()) parts.push(customInstructions.trim());

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
 * List available TTS voices.
 */
export async function listVoices(): Promise<GeminiVoice[]> {
  return GEMINI_TTS_VOICES;
}

/**
 * Generate speech from text using Gemini TTS via the generateContent endpoint.
 * Returns PCM audio data (24kHz, 16-bit, mono) converted to a WAV buffer.
 *
 * Uses POST /v1beta/models/{model}:generateContent?key=API_KEY
 * with responseModalities: ["AUDIO"] and speechConfig for voice selection.
 * Response: candidates[0].content.parts[0].inlineData.data (base64 PCM).
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

  // Build the prompt text with style instructions
  const prompt = instructions ? `${instructions}: ${text}` : text;

  const url = `${GEMINI_TTS_BASE}/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }],
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName,
          },
        },
      },
    },
  };

  console.log('[gemini-tts] Request URL:', url.replace(GEMINI_API_KEY, '***'));
  console.log('[gemini-tts] Model:', modelId, '| Voice:', voiceName, '| Prompt length:', prompt.length);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errMsg = JSON.stringify(errData);
    console.error('[gemini-tts] API error:', res.status, errMsg.substring(0, 500));

    const apiMsg = (errData as Record<string, Record<string, string>>)?.error?.message;
    throw new Error(apiMsg || `Gemini TTS API error ${res.status}: ${errMsg.substring(0, 200)}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // Log response structure
  console.log('[gemini-tts] Response top-level keys:', Object.keys(data));

  // ── Extract audio from standard generateContent response ──
  // Expected: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }

  const candidates = data['candidates'] as Array<Record<string, unknown>> | undefined;
  if (candidates && candidates.length > 0) {
    const content = candidates[0]['content'] as Record<string, unknown> | undefined;
    if (content) {
      const parts = content['parts'] as Array<Record<string, unknown>> | undefined;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          // Try inlineData (camelCase - standard REST)
          const inlineData = part['inlineData'] as Record<string, unknown> | undefined;
          if (inlineData && inlineData['data']) {
            console.log('[gemini-tts] Got audio via inlineData, mimeType:', inlineData['mimeType']);
            return base64ToWav(inlineData['data'] as string);
          }
          // Try inline_data (snake_case)
          const inlineDataSnake = part['inline_data'] as Record<string, unknown> | undefined;
          if (inlineDataSnake && inlineDataSnake['data']) {
            console.log('[gemini-tts] Got audio via inline_data, mimeType:', inlineDataSnake['mimeType']);
            return base64ToWav(inlineDataSnake['data'] as string);
          }
          // Check if model returned text instead of audio (shouldn't happen with AUDIO modality)
          if (part['text']) {
            console.warn('[gemini-tts] Model returned text instead of audio:', (part['text'] as string).substring(0, 200));
          }
        }
      }
    }
  }

  // ── Fallback: check for interaction output ──
  const interaction = data['interaction'] as Record<string, unknown> | undefined;
  if (interaction) {
    for (const key of ['output_audio', 'outputAudio'] as const) {
      const oa = interaction[key] as Record<string, unknown> | undefined;
      if (oa && oa['data']) {
        console.log('[gemini-tts] Got audio via interaction.' + key);
        return base64ToWav(oa['data'] as string);
      }
    }
  }

  // Build detailed error with response info for debugging
  const responseSummary = {
    topKeys: Object.keys(data),
    candidatesCount: candidates?.length || 0,
    firstCandidateKeys: candidates?.[0] ? Object.keys(candidates[0]) : [],
    firstCandidateContentKeys: candidates?.[0]?.content ? Object.keys(candidates[0].content as Record<string, unknown>) : [],
    partsCount: ((candidates?.[0]?.content) as Record<string, unknown>)?.parts
      ? ((candidates[0].content as Record<string, unknown>).parts as unknown[])?.length || 0
      : 0,
    firstPartKeys: ((candidates?.[0]?.content) as Record<string, unknown>)?.parts
      ? Object.keys((((candidates[0].content as Record<string, unknown>).parts as unknown[])?.[0]) as Record<string, unknown> || {})
      : [],
    rawPreview: JSON.stringify(data).substring(0, 500),
  };

  console.error('[gemini-tts] Response structure:', JSON.stringify(responseSummary, null, 2));

  throw new Error(
    `No audio data found in Gemini TTS response. Response keys: [${Object.keys(data).join(', ')}]. ` +
    `First candidate parts: ${JSON.stringify(responseSummary.firstPartKeys)}. ` +
    `See server logs for full response.`
  );
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

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
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
