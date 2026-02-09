export type Level = {
  name: string;
  minXp: number;
  maxXp: number;
};

export const levels: Level[] = [
  { name: 'Meraklı Göz', minXp: 0, maxXp: 99 },
  { name: 'Gelişen Kadraj', minXp: 100, maxXp: 249 },
  { name: 'Yetkin Vizör', minXp: 250, maxXp: 499 },
  { name: 'Işık Bükücü', minXp: 500, maxXp: 999 },
  { name: 'Viewora Maestrosu', minXp: 1000, maxXp: Infinity },
];

export function getLevelFromXp(xp: number): Level {
  // Find the level where the user's XP is within the min/max range.
  // The find will return the first match, which works because the array is sorted by minXp.
  const currentLevel = levels.find(l => xp >= l.minXp && xp <= l.maxXp);
  
  // If for some reason a level isn't found (e.g., negative XP), default to the first level.
  return currentLevel || levels[0];
}
