'use client';

import type { PhotoAnalysisOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';

export type PhotoAnalysis = PhotoAnalysisOutput;

export type UserProfileIndex = {
  overall_profile_score: number;
  technical_score: number;
  progress_score: number;
  activity_score: number;
  dominant_genre: string;
  dominant_device: string;
  last_calculated_at: string;
};

export type UserProfileIndexInput = {
  photoUrl: string;
  overallScore: number;
  deviceEstimation: string;
  genre: string;
  createdAt: string;
}[];


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
  profileIndex?: UserProfileIndex;
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

export type GroupInvite = {
  id: string;
  groupId: string;
  groupName: string;
  inviterId: string;
  inviterName: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string; // ISO string
};
