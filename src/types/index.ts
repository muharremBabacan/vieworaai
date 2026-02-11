'use client';

import type { AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  aura_balance: number; // Renamed from tokenBalance
  current_xp: number; // Renamed from xp
  level_name: string; // Renamed from level
  is_mentor?: boolean; // New
  weekly_free_refill_date: string; // New
  completed_modules: string[]; // New
  interests: string[];
  onboarded: boolean;
};

export type Photo = {
  id: string;
  userId?: string; // Added to satisfy security rules on creation
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
  aura: number;
  price: number;
  currency: string;
  isBestValue: boolean;
};

export type Transaction = {
    id: string;
    userId: string;
    amount: number;
    type: 'Purchase' | 'Gift' | 'Refill';
    status: 'Completed' | 'Pending' | 'Failed';
    transactionDate: string;
};
