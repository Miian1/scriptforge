import mongoose, { Schema, type Document } from 'mongoose';

export interface ICharacterDesign {
  characterName: string;
  characterType: string;
  species: string;
  personality: string;
  artStyle: string;
  primaryColor: string;
  secondaryColor: string;
  outlineColor: string;
  headShape: string;
  bodyShape: string;
  eyeShape: string;
  mouthStyle: string;
  accessories: string;
  theme: string;
  animationStyle: string;
}

export interface ICharacter extends Document {
  projectId: mongoose.Types.ObjectId;
  name: string;
  design: ICharacterDesign;
  imagePrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

const CharacterDesignSchema = new Schema<ICharacterDesign>(
  {
    characterName: { type: String, default: '' },
    characterType: { type: String, default: '' },
    species: { type: String, default: '' },
    personality: { type: String, default: '' },
    artStyle: { type: String, default: '' },
    primaryColor: { type: String, default: '' },
    secondaryColor: { type: String, default: '' },
    outlineColor: { type: String, default: '' },
    headShape: { type: String, default: '' },
    bodyShape: { type: String, default: '' },
    eyeShape: { type: String, default: '' },
    mouthStyle: { type: String, default: '' },
    accessories: { type: String, default: '' },
    theme: { type: String, default: '' },
    animationStyle: { type: String, default: '' },
  },
  { _id: false }
);

const CharacterSchema = new Schema<ICharacter>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    design: { type: CharacterDesignSchema, default: {} },
    imagePrompt: { type: String, default: '', trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

CharacterSchema.index({ projectId: 1, name: 1 });

export const CharacterModel =
  (mongoose.models.Character as mongoose.Model<ICharacter>) ??
  mongoose.model<ICharacter>('Character', CharacterSchema);
