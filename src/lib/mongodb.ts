import mongoose from 'mongoose';

// ── Lazy MONGODB_URI resolution ────────────────────────
//
// We MUST NOT read `process.env.MONGODB_URI` at module-evaluation time.
// Next.js evaluates API route modules at BUILD time to collect route
// metadata, and if the env var isn't set during the build, an eager
// `throw` here would break `npm run build` with:
//
//   Error: MONGODB_URI environment variable is not defined
//   Failed to collect page data for /api/...
//
// By moving the check inside `connectDB()`, the module loads cleanly
// at build time and only fails at runtime if a request actually needs
// the database and the var is genuinely missing.

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose> {
  // Fast path: already connected
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI environment variable is not defined. ' +
      'Set it in your .env file (see .env.example).',
    );
  }

  const opts = {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  };

  try {
    await mongoose.connect(MONGODB_URI, opts);
    isConnected = true;
    return mongoose;
  } catch (error) {
    isConnected = false;
    throw error;
  }
}
