import type { AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  tokenBalance: number;
  planLevel: 'Temel' | 'Orta' | 'Pro';
  xp: number;
  level: string;
  interests: string[];
  onboarded: boolean;
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
  category: 'Kompozisyon' | 'Işık' | 'Teknik';
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

    