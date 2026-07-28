import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// UserRole:
//   'user'    — standard end user (signs up themselves, requires email verification)
//   'admin'   — full superuser (created via DB seed or promoted by another admin)
//   'manager' — limited staff role created from the admin panel (no email
//               verification, can edit plans and send notifications, CANNOT
//               delete users or change roles)
export type UserRole = 'user' | 'admin' | 'manager';
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

// ── Credit system ───────────────────────────────────────
// Every AI action (text gen, voice gen, project create, score, etc.)
// costs 1 credit. Free plan: 30 credits/day (daily reset). Pro plan: 8,000 credits (one-time pool).
// Admins/managers bypass credit checks entirely.
//
// `dailyLimit` overrides the plan default when > 0 (admin can set per-user).
// `bonusCredits` are admin-granted extra credits that do NOT reset daily —
// they persist until used. They are consumed after daily credits run out.
// `lastResetDate` controls when daily credits were last refilled.
// `transactions` is a capped log of the last 50 deductions for audit.
export interface ICreditTransaction {
  action: string;         // 'text_generation', 'voice_generation', etc.
  amount: number;         // typically 1, but could be higher for batch ops
  balanceAfter: number;   // credits balance right after this deduction
  at: number;             // ms timestamp
}

export interface ICredits {
  balance: number;        // current spendable daily credit balance
  dailyLimit: number;     // 0 = use plan default (free=30, pro=8000); >0 = custom override
  bonusCredits: number;   // admin-granted, never resets, consumed after daily
  lastResetDate: string;  // 'YYYY-MM-DD' — when balance was last refilled
  lifetimeUsed: number;   // total credits ever consumed (audit)
  transactions: ICreditTransaction[];
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

export interface IChannelCharacter {
  id: string;                   // client-generated uuid for stable React keys
  name: string;                 // e.g. "Dr. Nova", "The Curious Kid"
  role: string;                 // e.g. "Host", "Subject-matter expert", "Recurring guest"
  description: string;          // metadata: appearance, vibe, backstory, traits
  visualPrompt: string;         // ready-to-use image prompt snippet for this character
  personalityPrompt: string;    // speaking-style cues the AI should mimic in narration
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
  characters: IChannelCharacter[]; // recurring channel characters the AI should use in scenes
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
  credits: ICredits;
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

// ── Credit system schema ──
// Free plan default: 30 credits/day. Pro plan default: 8000 credits (lump sum, no daily reset).
// `dailyLimit=0` means "use plan default" — admin can override per-user.
// `balance` is the daily balance that resets each day; `bonusCredits`
// never resets and is consumed after balance hits 0.
const CreditTransactionSchema = new Schema<ICreditTransaction>({
  action: { type: String, required: true },
  amount: { type: Number, required: true, default: 1 },
  balanceAfter: { type: Number, required: true, default: 0 },
  at: { type: Number, required: true, default: () => Date.now() },
});

const CreditsSchema = new Schema<ICredits>({
  balance: { type: Number, default: 30 },          // free plan default on creation
  dailyLimit: { type: Number, default: 0 },        // 0 = use plan default
  bonusCredits: { type: Number, default: 0 },
  lastResetDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0],
  },
  lifetimeUsed: { type: Number, default: 0 },
  transactions: {
    type: [CreditTransactionSchema],
    default: () => [],
  },
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

const ChannelCharacterSchema = new Schema<IChannelCharacter>({
  id: { type: String, required: true, default: () => Math.random().toString(36).slice(2) + Date.now().toString(36) },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: { type: String, default: '', trim: true, maxlength: 100 },
  description: { type: String, default: '', trim: true, maxlength: 2000 },
  visualPrompt: { type: String, default: '', trim: true, maxlength: 2000 },
  personalityPrompt: { type: String, default: '', trim: true, maxlength: 2000 },
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
  characters: { type: [ChannelCharacterSchema], default: () => [] },
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
    role: { type: String, enum: ['user', 'admin', 'manager'], default: 'user' },
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
    credits: {
      type: CreditsSchema,
      default: () => ({
        balance: 30,
        dailyLimit: 0,
        bonusCredits: 0,
        lastResetDate: new Date().toISOString().split('T')[0],
        lifetimeUsed: 0,
        transactions: [],
      }),
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