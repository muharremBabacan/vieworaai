import { xpRewards } from "@/lib/config/xp";
import { getLevelFromXP } from "@/lib/engines/levelEngine";
import { evaluateBadges } from "@/lib/engines/badgeEngine";
import { getLumaLevel } from "@/lib/engines/lumaLevelEngine";

export async function runBrain(event, user, stats, metrics) {

  let xp = user.xp ?? 0;

  // XP
  if (xpRewards[event]) {
    xp += xpRewards[event];
  }

  // Level
  const level = getLevelFromXP(xp);

  // Badges
  const badgeResult = evaluateBadges(user, stats);

  // Luma Level
  const lumaLevel = metrics
    ? getLumaLevel(metrics)
    : user.lumaLevel;

  return {
    xp,
    level,
    lumaLevel,
    badges: badgeResult.badges,
    newBadges: badgeResult.newlyEarned
  };
}