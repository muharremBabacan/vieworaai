import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Firestore'dan gelen veriyi derinlemesine (recursive) serileştirir.
 * Özellikle Timestamp objelerini ({seconds, nanoseconds}) ISO string formatına çevirir.
 * Bu sayede React Error #31 (objects are not valid as a React child) önlenmiş olur.
 */
export function serializeData(data: any): any {
  if (data === null || data === undefined) return data;

  // Firestore Timestamp duck-typing check
  if (
    typeof data === 'object' &&
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
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Dizi ise her elemanı tara
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }

  // Obje ise her key'i tara
  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = serializeData(data[key]);
      }
    }
    return result;
  }

  return data;
}

/**
 * Herhangi bir tarih verisini (string, date, timestamp) güvenli bir şekilde Date objesine çevirir.
 * Eğer veri geçersizse null döner, "Invalid Date" UI hatalarını önler.
 */
export function safeDate(val: any): Date | null {
  if (!val) return null;
  
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}
