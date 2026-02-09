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

Sunulan fotoğrafı ışık, kompozisyon, duygusal etki ve teknik açılarından analiz edeceksin. Kullanıcının fotoğrafçılık becerilerini geliştirmesi için 3 somut öneride bulun.

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
