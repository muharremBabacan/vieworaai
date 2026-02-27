
import type { PhotoAnalysisOutput } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import type { StrategicFeedbackOutput } from '@/ai/flows/generate-strategic-feedback';

export type PhotoAnalysis = PhotoAnalysisOutput;
export type StrategicFeedback = StrategicFeedbackOutput;

export type UserProfileIndex = {
  dominant_style: string;
  strengths: string[];
  weaknesses: string[];
  dominant_technical_level: 'beginner' | 'intermediate' | 'advanced';
  trend: {
    direction: 'improving' | 'stagnant' | 'declining';
    percentage: number;
  };
  consistency_gap: number;
  communication_profile: {
    tone: 'supportive' | 'direct' | 'analytical';
    explanation_depth: 'low' | 'medium' | 'high';
    challenge_level: number;
  };
  profile_index_score: number;
};

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  photoURL?: string | null;
  auro_balance: number;
  total_auro_spent?: number;
  total_analyses_count?: number;
  current_xp: number;
  level_name: string;
  is_mentor?: boolean;
  weekly_free_refill_date: string;
  completed_modules: string[];
  interests: string[];
  onboarded: boolean;
  groups?: string[];
  createdAt?: string;
  lastLoginAt?: string;
  lastNotificationsViewedAt?: string;
  communication_style?: 'soft' | 'balanced' | 'technical';
  score_history?: { score: number; date: string }[];
  profile_index?: UserProfileIndex;
};

export type AnalysisLog = {
  id: string;
  userId: string;
  userName: string;
  type: 'technical' | 'mentor';
  auroSpent: number;
  timestamp: string;
  status: 'success' | 'failed';
};

export type DailyStats = {
  id: string;
  date: string;
  dau: number;
  technicalAnalyses: number;
  mentorAnalyses: number;
  photoUploads: number;
  auroSpent: number;
  activeUsersList: string[];
};

export type PublicUserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  photoURL?: string | null;
  level_name: string;
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
  isSubmittedToExhibition?: boolean;
  exhibitionId?: string;
  likes?: string[];
  userName?: string;
  userPhotoURL?: string | null;
  userLevelName?: string;
};

export type Competition = {
  id: string;
  title: string;
  description: string;
  theme: string;
  prize: string;
  targetLevel: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  imageUrl: string;
  imageHint: string;
  scoringModel: 'community' | 'jury_ai' | 'hybrid' | 'ai_only' | 'custom';
  juryWeight: number;
  aiWeight: number;
  communityWeight: number;
};

export type CompetitionEntry = {
  id: string;
  competitionId: string;
  userId: string;
  userName: string;
  photoUrl: string;
  filePath: string;
  submittedAt: string;
  votes: string[];
  aiScore?: number;
  award?: 'winner' | 'honorable_mention' | 'participant';
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
  photoURL?: string | null;
};

export type GroupInvite = {
  id: string;
  groupId: string;
  groupName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

export type GlobalNotification = {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'competition' | 'exhibition' | 'reward';
  targetLevel?: string;
  competitionId?: string;
  exhibitionId?: string;
  createdAt: string;
};

export type Exhibition = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  minLevel: string;
  isActive: boolean;
  imageUrl: string;
  imageHint: string;
  createdAt: string;
  updatedAt: string;
};
