'use server';
/**
 * @fileOverview A placeholder for the photo analysis feature.
 *
 * - analyzePhotoAndSuggestImprovements - A function that returns placeholder analysis data.
 * - AnalyzePhotoAndSuggestImprovementsInput - The input type for the analyzePhotoAndSuggestImprovements function.
 * - AnalyzePhotoAndSuggestImprovementsOutput - The return type for the analyzePhotoAndSuggestImprovements function.
 */

import {z} from 'genkit';

// Schemas and types remain to avoid breaking imports in other files.
const AnalyzePhotoAndSuggestImprovementsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a plant, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzePhotoAndSuggestImprovementsInput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsInputSchema>;

const AnalyzePhotoAndSuggestImprovementsOutputSchema = z.object({
  analysis: z.string().describe('The overall analysis of the photo.'),
  improvements: z
    .array(z.string())
    .describe('A list of concrete suggestions for improvement.'),
  rating: z
    .object({
      lighting: z.number().describe('A rating for lighting from 1-10.'),
      composition: z
        .number()
        .describe('A rating for composition from 1-10.'),
      emotion: z.number().describe('A rating for emotional impact from 1-10.'),
      overall: z.number().describe('An overall rating from 1-10.'),
    })
    .describe('A rating for the photo based on criteria.'),
});
export type AnalyzePhotoAndSuggestImprovementsOutput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsOutputSchema>;


/**
 * This is a placeholder function that returns a mock analysis result.
 * The original Genkit AI flow has been removed to "clean" the file.
 * The application will no longer call the AI model for analysis.
 */
export async function analyzePhotoAndSuggestImprovements(
  input: AnalyzePhotoAndSuggestImprovementsInput
): Promise<AnalyzePhotoAndSuggestImprovementsOutput> {
  // Return a hardcoded placeholder response.
  return {
    analysis: 'Bu, temizlenmiş bir yer tutucu analizdir. Yapay zeka işlevi devre dışı bırakıldı.',
    improvements: [
      'Bu, bir yer tutucu ipucudur.',
      'Yapay zeka akışı kaldırıldığı için gerçek bir öneri üretilmedi.',
      'Bu dosyayı eski haline getirerek özelliği yeniden etkinleştirebilirsiniz.',
    ],
    rating: {
      lighting: 5,
      composition: 5,
      emotion: 5,
      overall: 5,
    },
  };
}
