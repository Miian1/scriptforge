import mongoose, { Schema, type Document } from 'mongoose';

export interface IGeneratedAudio extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  sceneId: mongoose.Types.ObjectId;
  sceneNumber: number;
  sceneTitle: string;
  narration: string;                // narration text used for generation
  voiceName: string;
  voiceDescription: string;
  voiceCategory: string;
  style: string;
  pace: string;
  accent: string;
  instructions: string;
  audioPath: string;                // e.g. /api/tts/audio/{_id}
  audioSize: number;                // bytes
  duration: number;                 // estimated seconds
  createdAt: Date;
  updatedAt: Date;
}

const GeneratedAudioSchema = new Schema<IGeneratedAudio>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    sceneId: { type: Schema.Types.ObjectId, ref: 'Scene', required: true, index: true },
    sceneNumber: { type: Number, required: true },
    sceneTitle: { type: String, required: true, trim: true },
    narration: { type: String, default: '', trim: true },
    voiceName: { type: String, required: true, trim: true },
    voiceDescription: { type: String, default: '', trim: true },
    voiceCategory: { type: String, default: '', trim: true },
    style: { type: String, default: '' },
    pace: { type: String, default: '' },
    accent: { type: String, default: '' },
    instructions: { type: String, default: '' },
    audioPath: { type: String, required: true, trim: true },
    audioSize: { type: Number, required: true, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Unique: one audio per scene (user can regenerate → replaces)
GeneratedAudioSchema.index({ userId: 1, projectId: 1, sceneId: 1 }, { unique: true });
// Quick lookups
GeneratedAudioSchema.index({ projectId: 1, createdAt: -1 });

export const GeneratedAudioModel =
  (mongoose.models.GeneratedAudio as mongoose.Model<IGeneratedAudio>) ??
  mongoose.model<IGeneratedAudio>('GeneratedAudio', GeneratedAudioSchema);
