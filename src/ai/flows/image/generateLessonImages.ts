'use server'
/**
 * @fileOverview Gemini 2.5 Flash Image modelini kullanarak görsel üreten bağımsız akış.
 */

import { generateLessonImage as generateImage } from '../lesson/generate-academy-lessons';

/**
 * Bu fonksiyon artık generate-academy-lessons içindeki güncel Gemini 2.5 motorunu kullanır.
 * Firebase AI SDK bağımlılığı yerine Genkit 1.x altyapısına geçirilmiştir.
 */
export async function generateLessonImage(prompt: string): Promise<string> {
  return generateImage(prompt);
}
