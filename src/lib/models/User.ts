import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'admin';
export type AuthProvider = 'email' | 'google';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  provider: AuthProvider;
  role: UserRole;
  isVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

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
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verificationTokenExpires: { type: Date, default: null },
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