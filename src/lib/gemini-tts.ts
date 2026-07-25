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
}

export const GEMINI_TTS_VOICES: GeminiVoice[] = [
  { name: 'Zephyr', description: 'Bright' },
  { name: 'Puck', description: 'Upbeat' },
  { name: 'Charon', description: 'Informative' },
  { name: 'Kore', description: 'Firm' },
  { name: 'Fenrir', description: 'Excitable' },
  { name: 'Leda', description: 'Youthful' },
  { name: 'Orus', description: 'Firm' },
  { name: 'Aoede', description: 'Breezy' },
  { name: 'Callirrhoe', description: 'Easy-going' },
  { name: 'Autonoe', description: 'Bright' },
  { name: 'Enceladus', description: 'Breathy' },
  { name: 'Iapetus', description: 'Clear' },
  { name: 'Umbriel', description: 'Easy-going' },
  { name: 'Algieba', description: 'Smooth' },
  { name: 'Despina', description: 'Smooth' },
  { name: 'Erinome', description: 'Clear' },
  { name: 'Algenib', description: 'Gravelly' },
  { name: 'Rasalgethi', description: 'Informative' },
  { name: 'Laomedeia', description: 'Upbeat' },
  { name: 'Achernar', description: 'Soft' },
  { name: 'Alnilam', description: 'Firm' },
  { name: 'Schedar', description: 'Even' },
  { name: 'Gacrux', description: 'Mature' },
  { name: 'Pulcherrima', description: 'Forward' },
  { name: 'Achird', description: 'Friendly' },
  { name: 'Zubenelgenubi', description: 'Casual' },
  { name: 'Vindemiatrix', description: 'Gentle' },
  { name: 'Sadachbia', description: 'Lively' },
  { name: 'Sadaltager', description: 'Knowledgeable' },
  { name: 'Sulafat', description: 'Warm' },
];

// ── TTS Model ───────────────────────────────────────

export const GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview';

export const GEMINI_TTS_MODELS = [
  { id: 'gemini-3.1-flash-tts-preview', name: 'Gemini 3.1 Flash TTS', description: 'Latest TTS preview, fast generation' },
];

// ── TTS Options ──────────────────────────────────────

export interface TTSOptions {
  voiceName: string;
  text: string;
  instructions?: string;  // Optional emotion/style instructions e.g. "Say cheerfully" or "whisper softly"
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
    modelId = GEMINI_TTS_MODEL,
  } = options;

  if (!voiceName) throw new Error('voiceName is required.');
  if (!text || text.trim().length === 0) throw new Error('text is required and must be non-empty.');

  // Build the input — prepend any style instructions
  const input = instructions ? `${instructions}: ${text}` : text;

  const url = `${GEMINI_TTS_BASE}/interactions?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      input,
      responseFormat: {
        type: 'audio',
      },
      generationConfig: {
        speechConfig: [
          { voice: voiceName },
        ],
      },
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = (errData as Record<string, Record<string, string>>)?.error?.message || `Gemini TTS error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json() as Record<string, unknown>;

  // The response contains interaction.candidates[].content.parts[].inlineData.data (base64)
  // or interaction.outputAudio (convenience property)
  const interaction = data['interaction'] as Record<string, unknown> | undefined;
  if (!interaction) {
    throw new Error('No interaction in Gemini TTS response.');
  }

  // Try convenience property first
  const outputAudio = interaction['outputAudio'] as Record<string, unknown> | undefined;
  if (outputAudio) {
    const audioData = outputAudio['data'] as string;
    if (audioData) {
      return base64ToWav(audioData);
    }
  }

  // Try candidates path
  const candidates = interaction['candidates'] as Array<Record<string, unknown>> | undefined;
  if (candidates && candidates.length > 0) {
    const content = candidates[0]['content'] as Record<string, unknown>;
    if (content) {
      const parts = content['parts'] as Array<Record<string, unknown>>;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          const inlineData = part['inlineData'] as Record<string, unknown> | undefined;
          if (inlineData && inlineData['data']) {
            return base64ToWav(inlineData['data'] as string);
          }
        }
      }
    }
  }

  throw new Error('No audio data found in Gemini TTS response.');
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
