import mongoose, { Schema, type Document } from 'mongoose';

export interface IAppSettings extends Document {
  geminiApiKey: string;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    geminiApiKey: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

// Singleton — only one document in this collection
export const AppSettings =
  (mongoose.models.AppSettings as mongoose.Model<IAppSettings>) ??
  mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);