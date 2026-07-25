import mongoose, { Schema, type Document } from 'mongoose';

export interface ISiteConfig extends Document {
  tools: {
    youtube: { enabled: boolean };
    // Future tools can be added here:
    // comments: { enabled: boolean };
    // analytics: { enabled: boolean };
  };
  updatedAt: Date;
}

const SiteConfigSchema = new Schema<ISiteConfig>(
  {
    tools: {
      youtube: { enabled: { type: Boolean, default: true } },
    },
  },
  { timestamps: true }
);

// Singleton — only one document in this collection
export const SiteConfig =
  (mongoose.models.SiteConfig as mongoose.Model<ISiteConfig>) ??
  mongoose.model<ISiteConfig>('SiteConfig', SiteConfigSchema);
