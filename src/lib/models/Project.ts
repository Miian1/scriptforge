import mongoose, { Schema, type Document } from 'mongoose';

export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  topic: string;
  description: string;
  settings: {
    duration: string;
    theme: string;
    language: string;
    writingStyle: string;
    targetAudience: string;
  };
  status: 'draft' | 'generating' | 'completed' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    topic: { type: String, required: true, trim: true, maxlength: 500 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    settings: {
      duration: { type: String, default: 'medium' },
      theme: { type: String, default: 'cinematic' },
      language: { type: String, default: 'english' },
      writingStyle: { type: String, default: 'conversational' },
      targetAudience: { type: String, default: 'general' },
    },
    status: { type: String, enum: ['draft', 'generating', 'completed', 'error'], default: 'draft' },
  },
  { timestamps: true }
);

ProjectSchema.index({ userId: 1, updatedAt: -1 });

export const ProjectModel =
  (mongoose.models.Project as mongoose.Model<IProject>) ??
  mongoose.model<IProject>('Project', ProjectSchema);