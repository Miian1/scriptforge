import mongoose, { Schema, type Document } from 'mongoose';

export interface IScene extends Document {
  projectId: mongoose.Types.ObjectId;
  sceneNumber: number;
  title: string;
  estimatedDuration: number;
  goal: string;
  narration: string;
  imagePrompt: string;
  animationPrompt: string;
  notes: {
    emotion: string;
    visualFocus: string;
    transitionSuggestion: string;
    importantDetails: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SceneSchema = new Schema<IScene>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    sceneNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    estimatedDuration: { type: Number, default: 0, min: 0 },
    goal: { type: String, default: '', trim: true },
    narration: { type: String, default: '', trim: true },
    imagePrompt: { type: String, default: '', trim: true },
    animationPrompt: { type: String, default: '', trim: true },
    notes: {
      emotion: { type: String, default: '' },
      visualFocus: { type: String, default: '' },
      transitionSuggestion: { type: String, default: '' },
      importantDetails: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

SceneSchema.index({ projectId: 1, sceneNumber: 1 });

export const SceneModel =
  (mongoose.models.Scene as mongoose.Model<IScene>) ??
  mongoose.model<IScene>('Scene', SceneSchema);