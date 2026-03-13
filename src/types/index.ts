
export type UserTier = 'start' | 'pro' | 'master';

export type VisualMarker = {
  type: "subject" | "distraction" | "light_direction";
  box_2d: number[];
  label: string;
};

export type PhotoAnalysis = {
  genre: string;
  scene: string;
  dominant_subject: string;
  light_score: number;
  composition_score: number;
  technical_clarity_score: number;
  storytelling_score?: number;
  boldness_score?: number;
  visual_markers?: VisualMarker[];
  style_analysis?: string;
  tags: string[];
  short_neutral_analysis: string;
};

export type StrategicFeedback = {
  feedback: string;
  actionTask: {
    title: string;
    purpose: string;
    steps: string[];
    evaluationQuestions: string[];
    weeklyTarget: string[];
  };
  explanations?: Array<{
    term: string;
    definition: string;
  }>;
};

export type StoredStrategicFeedback = StrategicFeedback & {
  id: string;
  createdAt: string;
};

export type AppSettings = {
  currencyName: string;
  maintenanceMode?: boolean;
};

export type PixPackage = {
  id: string;
  name: string;
  description: string;
  price: number;
  pix_amount: number;
  payment_link: string;
  active: boolean;
  order: number;
};

export type PixPurchase = {
  id: string;
  user_id: string;
  user_name: string;
  package_id: string;
  package_name: string;
  pix_amount: number;
  price: number;
  payment_provider: "iyzico_link";
  payment_link: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export type OnboardingResults = {
  device_type: 'mobile' | 'camera' | 'hybrid';
  interest: 'portrait' | 'landscape' | 'street' | 'food' | 'social' | 'art';
  approach: 'lighting' | 'composition' | 'casual';
  technical_level: 'beginner' | 'intermediate' | 'advanced';
  motivation: 'social' | 'hobby' | 'learning' | 'professional';
};

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
  profile_index_score: number;
  technical: {
    composition: number;
    light: number;
    technical_clarity: number;
    boldness: number;
    storytelling: number;
  };
  activity_signals: {
    learning_score: number;
    competition_score: number;
    exhibition_score: number;
    group_activity_score: number;
  };
  communication_profile: {
    tone: 'supportive' | 'direct' | 'analytical';
    explanation_depth: 'low' | 'medium' | 'high';
    challenge_level: number;
  };
};

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  photoURL?: string | null;
  phone?: string;
  instagram?: string;
  auro_balance: number;
  pix_balance: number;
  total_auro_spent?: number;
  total_analyses_count: number;
  total_mentor_analyses_count: number;
  total_exhibitions_count?: number;
  total_competitions_count?: number;
  current_xp: number;
  level_name: string;
  tier: UserTier;
  is_mentor?: boolean;
  weekly_free_refill_date: string;
  test_balance_reset?: boolean;
  daily_streak?: number;
  last_active_date?: string;
  completed_modules: string[];
  interests: string[];
  onboarded: boolean;
  onboarding_results?: OnboardingResults;
  groups?: string[];
  createdAt?: string;
  lastLoginAt?: string;
  lastNotificationsViewedAt?: string;
  communication_style?: 'soft' | 'balanced' | 'technical';
  score_history?: { score: number; date: string }[];
  profile_index?: UserProfileIndex;
  provider: 'google' | 'email';
};

export type PublicUserProfile = {
  id: string;
  name: string;
  email?: string | null;
  photoURL?: string | null;
  level_name?: string;
  phone?: string;
  instagram?: string;
};

export type AnalysisLog = {
  id: string;
  userId: string;
  userName: string;
  type: 'technical' | 'mentor' | 'exhibition' | 'competition' | 'gift' | 'package';
  auroSpent: number;
  timestamp: string;
  status: 'success' | 'failed';
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
  exhibitionId?: string | null;
  likes?: string[];
  userName?: string;
  userPhotoURL?: string | null;
  userLevelName?: string;
  imageHash?: string;
  analysisTier?: UserTier;
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
  updatedAt: string;
  imageUrl: string;
  imageHint: string;
  scoringModel: 'community' | 'jury_ai' | 'hybrid' | 'ai_only' | 'custom';
  juryWeight: number;
  aiWeight: number;
  communityWeight: number;
  participantCount?: number;
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

export type GroupPurpose = 'study' | 'challenge' | 'walk' | 'mentor';

export type Group = {
  id: string;
  name: string;
  description: string;
  purpose: GroupPurpose;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
  joinCode?: string;
  maxMembers: number;
  photoURL?: string | null;
  allowMemberComments?: boolean;
};

export type GroupAssignment = {
  id: string;
  groupId: string;
  title: string;
  description: string;
  dueDate?: string;
  createdAt: string;
};

export type GroupComment = {
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

export type GroupSubmission = {
  id: string;
  groupId: string;
  assignmentId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string | null;
  photoUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  likes: string[];
  aiFeedback?: {
    isSuccess: boolean;
    feedback: string;
    score: number;
    technicalPoints: string[];
  } | null;
  comments: GroupComment[];
  submittedAt: string;
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
  type: 'system' | 'competition' | 'exhibition' | 'reward' | 'trip_created' | 'trip_cancelled' | 'trip_updated';
  targetLevel?: string;
  competitionId?: string;
  exhibitionId?: string;
  tripId?: string;
  groupId?: string;
  createdAt: string;
  read?: boolean;
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
  imageUrl?: string;
  imageHint: string;
  createdAt: string;
  tags?: string[];
};

export type CurriculumTopic = {
  id: string;
  level: string;
  category: string;
  topics: string[];
};

export type ParticipantStatus = 'pending' | 'yes' | 'no';

export type TripParticipant = {
  userId: string;
  userName: string;
  userPhotoURL?: string | null;
  status: ParticipantStatus;
  joined_at: string;
};

export type TripStatus = 'planned' | 'completed' | 'cancelled' | 'archived';

export type RoutePointType = 'start' | 'photo_stop' | 'break' | 'viewpoint' | 'end';

export type RoutePoint = {
  name: string;
  type: RoutePointType;
};

export type ContactVisible = 'none' | 'group_members' | 'participants_only';

export type Trip = {
  id: string;
  groupId: string;
  title: string;
  description: string;
  startPoint: string;
  endPoint: string;
  date: string;
  time: string;
  duration: string;
  distance: string;
  approvalRequired: boolean;
  isListPublic: boolean;
  status: TripStatus;
  route_points?: RoutePoint[];
  created_at: string;
  completed_at?: string;
  cancelled_at?: string;
  
  // Mentor & Meeting Info
  mentorId: string;
  meeting_point: string;
  meeting_time: string;
  contact_visible: ContactVisible;
  max_participants: number;
};

export type TripTemplate = {
  id: string;
  title: string;
  city: string;
  category: string;
  duration_minutes: number;
  distance_km: number;
  start_point: string;
  end_point: string;
  route_points: RoutePoint[];
};
