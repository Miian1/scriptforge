// Quick debug script to test Gemini TTS API and dump raw response
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';

async function test() {
  console.log('=== Gemini TTS Debug Test ===');
  console.log('API Key set:', !!GEMINI_API_KEY);
  console.log('API Key prefix:', GEMINI_API_KEY?.substring(0, 8) + '...');
  console.log();

  const body = {
    model: 'gemini-3.1-flash-tts-preview',
    input: 'Hello, this is a test.',
    response_format: { type: 'audio' },
    generation_config: {
      speech_config: [{ voice: 'Kore' }],
    },
  };

  console.log('Request body:', JSON.stringify(body, null, 2));
  console.log();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    });

    console.log('Status:', res.status, res.statusText);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log();

    const data = await res.json();
    console.log('Response keys:', Object.keys(data));
    console.log();

    // Check for interaction
    if (data.interaction) {
      console.log('interaction keys:', Object.keys(data.interaction));
      console.log('interaction.output_audio:', data.interaction.output_audio ? 'EXISTS' : 'MISSING');
      console.log('interaction.outputAudio:', data.interaction.outputAudio ? 'EXISTS' : 'MISSING');
      if (data.interaction.candidates) {
        console.log('interaction.candidates length:', data.interaction.candidates.length);
      }
      if (data.interaction.output_audio?.data) {
        console.log('output_audio.data length:', data.interaction.output_audio.data.length);
      }
      if (data.interaction.outputAudio?.data) {
        console.log('outputAudio.data length:', data.interaction.outputAudio?.data.length);
      }
    }

    // Check for candidates at top level
    if (data.candidates) {
      console.log('Top-level candidates:', data.candidates.length);
      if (data.candidates[0]) {
        console.log('First candidate keys:', Object.keys(data.candidates[0]));
      }
    }

    // Check for output_audio at top level
    if (data.output_audio) console.log('Top-level output_audio: EXISTS');
    if (data.outputAudio) console.log('Top-level outputAudio: EXISTS');

    // Check for error
    if (data.error) {
      console.log('ERROR:', JSON.stringify(data.error));
    }

    console.log();
    console.log('=== Full response (truncated to 2000 chars) ===');
    const fullStr = JSON.stringify(data);
    console.log(fullStr.substring(0, 2000));
    if (fullStr.length > 2000) console.log(`... (${fullStr.length} total chars)`);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
