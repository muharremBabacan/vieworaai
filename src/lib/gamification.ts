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
  // Seviyeyi, kullanıcının XP'sinin min/max aralığında olduğu yeri bularak bulur.
  // Bulma işlemi ilk eşleşmeyi döndürür, bu da dizi minXp'ye göre sıralandığı için çalışır.
  const currentLevel = levels.find(l => xp >= l.minXp && xp < l.maxXp);

  // Eğer bir seviye bulunamazsa (örneğin, 1000'den fazla XP), son seviyeyi döndür.
  if (xp >= 1000) return levels[levels.length - 1];
  
  // Eğer bir seviye bulunamazsa (örneğin, negatif XP), ilk seviyeye varsayılan olarak ayarla.
  return currentLevel || levels[0];
}
