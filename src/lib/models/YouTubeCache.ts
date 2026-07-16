import mongoose, { Schema, type Document } from 'mongoose';

export interface ICachedVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
}

export interface ICachedChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

export interface IYouTubeCache extends Document {
  userId: string;           // references User._id
  channel: ICachedChannel | null;
  videos: ICachedVideo[];
  channelFetchedAt: Date | null;
  videosFetchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CachedVideoSchema = new Schema<ICachedVideo>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  thumbnail: { type: String, required: true },
  publishedAt: { type: String, required: true },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
});

const CachedChannelSchema = new Schema<ICachedChannel>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  thumbnail: { type: String, required: true },
  subscriberCount: { type: Number, default: 0 },
  videoCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
});

const YouTubeCacheSchema = new Schema<IYouTubeCache>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    channel: { type: CachedChannelSchema, default: null },
    videos: { type: [CachedVideoSchema], default: [] },
    channelFetchedAt: { type: Date, default: null },
    videosFetchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const YouTubeCache =
  (mongoose.models.YouTubeCache as mongoose.Model<IYouTubeCache>) ??
  mongoose.model<IYouTubeCache>('YouTubeCache', YouTubeCacheSchema);