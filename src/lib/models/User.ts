import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'admin';
export type AuthProvider = 'email' | 'google';
export type UserPlan = 'free' | 'pro';
export type CustomPlanType = boolean;

// Tracks HOW the user got their current Pro plan.
//   'stripe' — upgraded via Stripe checkout
//   'manual' — upgraded by admin (Easypaisa/JazzCash or admin-granted)
//   null/undefined — free user, no Pro access yet
export type PlanSource = 'stripe' | 'manual' | null;

export interface IDailyUsage {
  date: string;           // 'YYYY-MM-DD'
  projectsCreated: number;
  aiGenerations: number;
}

export interface IYouTubeConnection {
  connected: boolean;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface IStripeInfo {
  customerId: string;
  subscriptionId: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

export interface ICustomPlan {
  isCustom: boolean;
  customLabel: string;   // e.g. "Team Plan", "Agency Plan"
  customDays: number;     // admin-set days for custom plans
}

export interface IChannelNiche {
  visualTheme: string;      // e.g. "Cinematic dark tones with neon accents"
  writingStyle: string;     // e.g. "Casual, energetic, uses humor and pop culture refs"
  audience: string;         // e.g. "Tech-savvy millennials interested in AI and productivity"
  language: string;         // e.g. "English (US)"
  description: string;     // Full paragraphs describing the channel niche
  channelName: string;      // YouTube channel name
  channelDescription: string; // YouTube channel about/description
  channelCategory: string;   // e.g. "Technology", "Education", "Entertainment"
  channelUrl: string;       // YouTube channel URL
}

export interface INotification {
  id: string;
  type: 'info' | 'warning' | 'urgent';
  title: string;
  message: string;
  read: boolean;
  createdAt: number; // ms timestamp
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  provider: AuthProvider;
  role: UserRole;
  plan: UserPlan;
  planExpiresAt: number;       // ms timestamp — when the 30-day Pro period ends
  planSource?: PlanSource;     // how Pro was obtained: 'stripe' | 'manual' | null
  isCustomPlan: boolean;
  customPlan: ICustomPlan;
  isVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpires: Date | null;
  dailyUsage: IDailyUsage;
  youtube: IYouTubeConnection;
  channelNiche: IChannelNiche;
  stripe: IStripeInfo;
  notifications: INotification[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const DailyUsageSchema = new Schema<IDailyUsage>({
  date: { type: String, required: true },
  projectsCreated: { type: Number, default: 0 },
  aiGenerations: { type: Number, default: 0 },
});

const YouTubeSchema = new Schema<IYouTubeConnection>({
  connected: { type: Boolean, default: false },
  accessToken: { type: String, default: null },
  refreshToken: { type: String, default: null },
});

const StripeSchema = new Schema<IStripeInfo>({
  customerId: { type: String, default: '' },
  subscriptionId: { type: String, default: '' },
  currentPeriodEnd: { type: Number, default: 0 },
  cancelAtPeriodEnd: { type: Boolean, default: false },
});

const ChannelNicheSchema = new Schema<IChannelNiche>({
  visualTheme: { type: String, default: '' },
  writingStyle: { type: String, default: '' },
  audience: { type: String, default: '' },
  language: { type: String, default: '' },
  description: { type: String, default: '' },
  channelName: { type: String, default: '' },
  channelDescription: { type: String, default: '' },
  channelCategory: { type: String, default: '' },
  channelUrl: { type: String, default: '' },
});

const CustomPlanSchema = new Schema<ICustomPlan>({
  isCustom: { type: Boolean, default: false },
  customLabel: { type: String, default: '' },
  customDays: { type: Number, default: 0 },
});

const NotificationSchema = new Schema<INotification>({
  id: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'urgent'], default: 'info' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Number, default: () => Date.now() },
});

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    password: { type: String, minlength: 6, select: false },
    googleId: { type: String, unique: true, sparse: true, index: true },
    provider: { type: String, enum: ['email', 'google'], default: 'email' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    planExpiresAt: { type: Number, default: 0 },
    planSource: { type: String, enum: ['stripe', 'manual', null], default: null },
    isCustomPlan: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verificationTokenExpires: { type: Date, default: null },
    dailyUsage: {
      type: DailyUsageSchema,
      default: () => ({ date: new Date().toISOString().split('T')[0], projectsCreated: 0, aiGenerations: 0 }),
    },
    youtube: {
      type: YouTubeSchema,
      default: () => ({ connected: false, accessToken: null, refreshToken: null }),
    },
    channelNiche: {
      type: ChannelNicheSchema,
      default: () => ({ visualTheme: '', writingStyle: '', audience: '', language: '', description: '', channelName: '', channelDescription: '', channelCategory: '', channelUrl: '' }),
    },
    stripe: {
      type: StripeSchema,
      default: () => ({ customerId: '', subscriptionId: '', currentPeriodEnd: 0, cancelAtPeriodEnd: false }),
    },
    customPlan: {
      type: CustomPlanSchema,
      default: () => ({ isCustom: false, customLabel: '', customDays: 0 }),
    },
    notifications: {
      type: [NotificationSchema],
      default: () => [],
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ??
  mongoose.model<IUser>('User', UserSchema);