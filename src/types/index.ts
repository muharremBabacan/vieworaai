'use client';

import type { AnalyzePhotoAndSuggestImprovementsOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  auro_balance: number; // Renamed from aura_balance
  current_xp: number; // Renamed from xp
  level_name: string; // Renamed from level
  is_mentor?: boolean; // New
  weekly_free_refill_date: string; // New
  completed_modules: string[]; // New
  interests: string[];
  onboarded: boolean;
  groups?: string[];
};

export type Photo = {
  id: string;
  userId: string;
  imageUrl: string;
  filePath?: string;
  tags?: string[];
  aiFeedback: AnalyzePhotoAndSuggestImprovementsOutput | null;
  createdAt: string;
  isSubmittedToPublic?: boolean;
};

export type Lesson = {
  id: string;
  level: 'Temel' | 'Orta' | 'İleri'; // New curriculum levels
  category: string;
  title: string;
  learningObjective: string;
  theory: string;
  analysisCriteria: string[];
  practiceTask: string;
  auroNote: string;
  imageUrl: string;
  imageHint: string;
  createdAt: string;
};

export type Package = {
  id: string;
  name: string;
  target: string;
  slogan: string;
  auro: number;
  price: number;
  currency: string;
  isBestValue: boolean;
};

export type Transaction = {
    id: string;
    userId: string;
    amount: number; // Auro amount
    type: 'Purchase' | 'Gift' | 'Refill';
    status: 'Completed' | 'Pending' | 'Failed';
    transactionDate: string;
    currencyAmount?: number; // Price in currency
    currency?: string; // e.g., 'TRY'
};

export type Competition = {
  id:string;
  title: string;
  description: string;
  theme: string;
  prize: string;
  startDate: string;
  endDate: string;
  imageUrl: string;
  imageHint: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
  joinCode?: string;
  maxMembers: number;
};

export type ChatMessage = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  timestamp: string; // ISO string
};
