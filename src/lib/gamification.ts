export type Level = {
  name: string;
  minXp: number;
  isMentor?: boolean;
};

// Seviyeler: Neuner → Viewner → Sytner → Omner → Vexer
export const levels: Level[] = [
  { name: 'Neuner', minXp: 0 },
  { name: 'Viewner', minXp: 101 },
  { name: 'Sytner', minXp: 501 },
  { name: 'Omner', minXp: 1501 },
  { name: 'Vexer', minXp: 5001, isMentor: true },
];

export function getLevelFromXp(xp: number): Level {
  // Diziyi tersine çeviririz, böylece en yüksek XP gereksinimine sahip seviyeden başlarız.
  const reversedLevels = [...levels].reverse();
  // Kullanıcının XP'sinin, seviyenin minimum XP'sinden büyük veya eşit olduğu ilk seviyeyi buluruz.
  const currentLevel = reversedLevels.find(l => xp >= l.minXp);

  // Eğer bir seviye bulunamazsa (örn. negatif XP), ilk seviyeye varsayılan olarak ayarla.
  return currentLevel || levels[0];
}

export const getGroupLimits = (levelName?: string) => {
  switch (levelName) {
    case 'Vexer': // Mentor
      return { maxGroups: 10, maxMembers: 40 };
    case 'Omner':
      return { maxGroups: 5, maxMembers: 20 };
    case 'Sytner':
      return { maxGroups: 5, maxMembers: 15 };
    case 'Viewner':
      return { maxGroups: 5, maxMembers: 10 };
    case 'Neuner': // New users
    default:
      return { maxGroups: 1, maxMembers: 7 };
  }
};
