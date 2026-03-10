import { levels, Level } from "@/lib/config/levels";

export function getLevelFromXP(xp: number): Level {

  if (xp >= levels.vexer) return "vexer";
  if (xp >= levels.omner) return "omner";
  if (xp >= levels.sytner) return "sytner";
  if (xp >= levels.viewner) return "viewner";

  return "neuner";
}