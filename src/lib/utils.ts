import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Firestore'dan gelen veriyi derinlemesine (recursive) serileştirir.
 * Sadece Plain Object ve Array'leri işler, karmaşık class instance'larına (Firestore Ref vb.) dokunmaz.
 * Özellikle Timestamp objelerini ({seconds, nanoseconds}) ISO string formatına çevirir.
 */
export function serializeData(data: any): any {
  if (data === null || data === undefined) return data;

  // Primative tipler (string, number, boolean)
  if (typeof data !== 'object') return data;

  // Firestore Timestamp duck-typing check
  if (
    typeof data.seconds === 'number' &&
    typeof data.nanoseconds === 'number' &&
    typeof data.toDate === 'function'
  ) {
    try {
      return data.toDate().toISOString();
    } catch (e) {
      return new Date(data.seconds * 1000).toISOString();
    }
  }

  // Standart Date objesi
  if (Object.prototype.toString.call(data) === '[object Date]') {
    return data.toISOString();
  }

  // Dizi ise her elemanı tara
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }

  // SADECE PURE OBJECT ise her key'i tara
  // Bu kontrol, Firestore DocumentReference veya Firebase App gibi devasa objelerin 
  // içine girip sistemi çökertmeyi (stack overflow/serialization error) engeller.
  if (Object.prototype.toString.call(data) === '[object Object]') {
    const result: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = serializeData(data[key]);
      }
    }
    return result;
  }

  // Karmaşık objeleri olduğu gibi bırak (RSC serialization bunları reddederse hatayı loglarda net görürüz)
  return data;
}

/**
 * İki objenin serileştirilmiş hallerini karşılaştırarak değişim olup olmadığını kontrol eder.
 * Render loop'larını (onSnapshot -> state update -> re-render) engellemek için kullanılır.
 */
export function deepCompare(oldData: any, newData: any): boolean {
  try {
    return JSON.stringify(oldData) === JSON.stringify(newData);
  } catch (e) {
    return false;
  }
}

/**
 * Herhangi bir tarih verisini (string, date, timestamp) güvenli bir şekilde Date objesine çevirir.
 * Eğer veri geçersizse null döner, "Invalid Date" UI hatalarını önler.
 */
export function safeDate(val: any): Date | null {
  if (!val) return null;
  
  if (val.seconds && typeof val.toDate === 'function') return val.toDate();

  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}
