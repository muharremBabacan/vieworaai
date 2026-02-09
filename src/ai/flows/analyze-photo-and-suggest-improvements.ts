'use server';
/**
 * @fileOverview Bir fotoğrafı analiz eden ve iyileştirmeler öneren bir YZ ajanı.
 *
 * - analyzePhotoAndSuggestImprovements - Fotoğraf analizi ve iyileştirme önerisi sürecini yöneten bir fonksiyon.
 * - AnalyzePhotoAndSuggestImprovementsInput - analyzePhotoAndSuggestImprovements fonksiyonu için girdi türü.
 * - AnalyzePhotoAndSuggestImprovementsOutput - analyzePhotoAndSuggestImprovements fonksiyonu için dönüş türü.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzePhotoAndSuggestImprovementsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "Analiz edilecek bir fotoğraf, bir MIME türü içermesi ve Base64 kodlaması kullanması gereken bir veri URI'si olarak. Beklenen format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzePhotoAndSuggestImprovementsInput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsInputSchema>;

const AnalyzePhotoAndSuggestImprovementsOutputSchema = z.object({
  analysis: z.string().describe('Fotoğrafın genel analizi.'),
  improvements: z
    .array(z.string())
    .describe('İyileştirme için somut önerilerin bir listesi.'),
  rating: z
    .object({
      lighting: z.number().describe('Işık kullanımı için 1-10 arası puan.'),
      composition: z
        .number()
        .describe('Kompozisyon için 1-10 arası puan.'),
      emotion: z.number().describe('Duygusal etki için 1-10 arası puan.'),
      overall: z.number().describe('Genel olarak 1-10 arası puan.'),
    })
    .describe('Fotoğraf için kriterlere göre puanlama.'),
});
export type AnalyzePhotoAndSuggestImprovementsOutput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsOutputSchema>;

export async function analyzePhotoAndSuggestImprovements(
  input: AnalyzePhotoAndSuggestImprovementsInput
): Promise<AnalyzePhotoAndSuggestImprovementsOutput> {
  return analyzePhotoAndSuggestImprovementsFlow(input);
}

const analyzePhotoAndSuggestImprovementsPrompt = ai.definePrompt({
  name: 'analyzePhotoAndSuggestImprovementsPrompt',
  input: {schema: AnalyzePhotoAndSuggestImprovementsInputSchema},
  output: {schema: AnalyzePhotoAndSuggestImprovementsOutputSchema},
  prompt: `Sen, fotoğrafçılara yeteneklerini nasıl geliştirebilecekleri konusunda rehberlik eden uzman bir fotoğrafçılık koçusun.

Sunulan fotoğrafı ışık, kompozisyon, duygusal etki ve teknik açılarından analiz edeceksin.

Analizine dayanarak, aşağıdaki kriterlerin her biri için 1'den 10'a kadar bir puan ver:
- Işık: Işığın etkin kullanımı, pozlama ve yarattığı atmosfer.
- Kompozisyon: Üçler kuralı, öncü çizgiler, denge gibi kompozisyonel elementlerin kullanımı.
- Duygusal Etki: Fotoğrafın izleyicide uyandırdığı his veya anlattığı hikaye.

Bu üç puana dayanarak bir de genel bir puan ver. Puanları 'rating' objesi içinde döndür.

Son olarak, kullanıcının fotoğrafçılık becerilerini geliştirmesi için 3 somut öneride bulun.

Fotoğraf: {{media url=photoDataUri}}`,
});

const analyzePhotoAndSuggestImprovementsFlow = ai.defineFlow(
  {
    name: 'analyzePhotoAndSuggestImprovementsFlow',
    inputSchema: AnalyzePhotoAndSuggestImprovementsInputSchema,
    outputSchema: AnalyzePhotoAndSuggestImprovementsOutputSchema,
  },
  async input => {
    const {output} = await analyzePhotoAndSuggestImprovementsPrompt(input);
    return output!;
  }
);
