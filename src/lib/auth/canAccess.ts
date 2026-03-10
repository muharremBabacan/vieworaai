import { gates, Level } from "@/lib/config/gates";
import type { User } from "@/types";

const levelOrder: Level[] = [
  "neuner",
  "viewner",
  "sytner",
  "omner",
  "vexer"
];

/**
 * Centralized access control function.
 * @param user The user profile object from Firestore.
 * @param gateName The key defined in gates.ts.
 * @returns boolean - True if access is granted.
 */
export function canAccess(user: User | null | undefined, gateName: string): boolean {
  if (!user) return false;

  const rule = gates[gateName];
  // If no rule is defined for this feature, it's open by default.
  if (!rule) return true;

  // 1. Level Check (Hiyerarşik)
  if (rule.minLevel) {
    const userLevel = (user.level_name || "neuner").toLowerCase() as Level;
    const requiredLevel = rule.minLevel.toLowerCase() as Level;
    
    if (levelOrder.indexOf(userLevel) < levelOrder.indexOf(requiredLevel)) {
      return false;
    }
  }

  // 2. Tier Check (Paket Derinliği)
  if (rule.minTier) {
    const tierOrder = ["start", "pro", "master"];
    const userTier = user.tier || "start";
    
    if (tierOrder.indexOf(userTier) < tierOrder.indexOf(rule.minTier)) {
      return false;
    }
  }

  // 3. XP Check
  if (rule.minXP && user.current_xp < rule.minXP) {
    return false;
  }

  // 4. Balance Check
  if (rule.auroCost && user.auro_balance < rule.auroCost) {
    return false;
  }

  return true;
}
