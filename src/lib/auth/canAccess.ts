'use client';

import { gates } from "@/lib/config/gates";

/**
 * Minimal user interface to break dependency on heavy type files
 * that might pull in server actions into client components.
 */
interface AccessUser {
  level_name?: string;
  tier?: string;
  current_xp: number;
  auro_balance: number;
}

const levelOrder: string[] = [
  "neuner",
  "viewner",
  "sytner",
  "omner",
  "vexer"
];

/**
 * Centralized access control function.
 * Handles hierarchical level checks and tier-based rules.
 */
export function canAccess(user: AccessUser | null | undefined, gateName: string): boolean {
  if (!user) return false;

  const rule = gates[gateName];
  // If no rule is defined for this feature, it's open by default.
  if (!rule) return true;

  // 1. Level Check (Hierarchical)
  if (rule.minLevel) {
    const userLevel = (user.level_name || "neuner").toLowerCase();
    const requiredLevel = rule.minLevel.toLowerCase();
    
    const userIndex = levelOrder.indexOf(userLevel);
    const requiredIndex = levelOrder.indexOf(requiredLevel);

    if (userIndex < requiredIndex) {
      return false;
    }
  }

  // 2. Tier Check (Subscription depth)
  if (rule.minTier) {
    const tierOrder = ["start", "pro", "master"];
    const userTier = (user.tier || "start").toLowerCase();
    const requiredTier = rule.minTier.toLowerCase();
    
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(requiredTier);

    if (userTierIndex < requiredTierIndex) {
      return false;
    }
  }

  // 3. XP Check
  if (rule.minXP !== undefined && user.current_xp < rule.minXP) {
    return false;
  }

  // 4. Balance Check
  if (rule.auroCost !== undefined && user.auro_balance < rule.auroCost) {
    return false;
  }

  return true;
}
