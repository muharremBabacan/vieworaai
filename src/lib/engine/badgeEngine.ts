import { badges } from "@/lib/config/badges";

type User = {
  id: string;
  badges?: string[];
};

type Stats = {
  photosUploaded?: number;
  analysisCount?: number;
  academyCompleted?: number;
  exhibitions?: number;
  challengeWins?: number;
  challengePlacements?: number;
};

export function evaluateBadges(user: User, stats: Stats) {

  const earned = new Set(user.badges || []);
  const newlyEarned: string[] = [];

  function grant(badgeId: string) {
    if (!earned.has(badgeId)) {
      earned.add(badgeId);
      newlyEarned.push(badgeId);
    }
  }

  // --- ANALYSIS BADGES ---
  if ((stats.analysisCount ?? 0) >= 10) grant("analyst_10");
  if ((stats.analysisCount ?? 0) >= 50) grant("analyst_50");
  if ((stats.analysisCount ?? 0) >= 200) grant("analyst_200");

  // --- ACADEMY BADGES ---
  if ((stats.academyCompleted ?? 0) >= 1) grant("academy_first");
  if ((stats.academyCompleted ?? 0) >= 5) grant("academy_5");
  if ((stats.academyCompleted ?? 0) >= 20) grant("academy_20");

  // --- EXHIBITION BADGES ---
  if ((stats.exhibitions ?? 0) >= 1) grant("exhibition_first");
  if ((stats.exhibitions ?? 0) >= 5) grant("exhibition_5");
  if ((stats.exhibitions ?? 0) >= 20) grant("exhibition_20");

  // --- CHALLENGE BADGES ---
  if ((stats.challengePlacements ?? 0) >= 3) grant("challenge_finalist");
  if ((stats.challengeWins ?? 0) >= 1) grant("challenge_winner");

  return {
    badges: Array.from(earned),
    newlyEarned
  };
}