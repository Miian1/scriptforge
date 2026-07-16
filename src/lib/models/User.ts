import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'admin';
export type AuthProvider = 'email' | 'google';
export type UserPlan = 'free' | 'pro';

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

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  provider: AuthProvider;
  role: UserRole;
  plan: UserPlan;
  isVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpires: Date | null;
  dailyUsage: IDailyUsage;
  youtube: IYouTubeConnection;
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