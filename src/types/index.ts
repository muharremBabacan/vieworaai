'use client';

import type { PhotoAnalysisOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';

export type PhotoAnalysis = PhotoAnalysisOutput;

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  auro_balance: number;
  current_xp: number;
  level_name: string;
  is_mentor?: boolean;
  weekly_free_refill_date: string;
  completed_modules: string[];
  interests: string[];
  onboarded: boolean;
  groups?: string[];
  // New profile fields from user prompt
  profile_index?: any; // Define properly later
  technical_score?: number;
  development_score?: number;
  activity_score?: number;
  dominant_genre?: string;
  device_type?: string;
};

export type Photo = {
  id: string;
  userId: string;
  imageUrl: string;
  filePath?: string;
  tags?: string[];
  aiFeedback: PhotoAnalysis | null;
  adaptiveFeedback?: string | null;
  createdAt: string;
  isSubmittedToPublic?: boolean;
};

export type Lesson = {
  id: string;
  level: 'Temel' | 'Orta' | 'İleri';
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
    amount: number;
    type: 'Purchase' | 'Gift' | 'Refill';
    status: 'Completed' | 'Pending' | 'Failed';
    transactionDate: string;
    currencyAmount?: number;
    currency?: string;
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

export type Notification = {
  id: string;
  userId: string;
  type: 'group_invite' | 'system_message';
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string; // ISO string
};
