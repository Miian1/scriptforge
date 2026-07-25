import mongoose, { Schema, type Document } from 'mongoose';

export type ModelCategory = 'text' | 'voice';

export interface IAIModel extends Document {
  name: string;
  modelId: string;
  category: ModelCategory;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const AIModelSchema = new Schema<IAIModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    modelId: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      required: true,
      enum: ['text', 'voice'],
    },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AIModelSchema.index({ category: 1, isActive: 1 });

export const AIModel =
  (mongoose.models.AIModel as mongoose.Model<IAIModel>) ??
  mongoose.model<IAIModel>('AIModel', AIModelSchema);
