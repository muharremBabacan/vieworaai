import type { AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';

export type User = {
  name: string;
  email: string;
  avatarUrl: string;
  tokenBalance: number;
  planLevel: 'Basic' | 'Mid' | 'Pro';
  xp: number;
};

export type Photo = {
  id: string;
  imageUrl: string;
  imageHint: string;
  aiFeedback: AnalyzePhotoAndSuggestImprovementsOutput | null;
  createdAt: string;
};

export type Lesson = {
  id: string;
  category: 'Composition' | 'Lighting' | 'Technique';
  title: string;
  content: string;
  imageUrl: string;
  imageHint: string;
};

export type Package = {
  id: string;
  tokens: number;
  price: number;
  currency: string;
  isBestValue: boolean;
};
