'use server';
/**
 * @fileOverview A photo analysis AI agent that provides feedback and ratings.
 *
 * - analyzePhotoAndSuggestImprovements - A function that handles the photo analysis process.
 * - AnalyzePhotoAndSuggestImprovementsInput - The input type for the analyzePhotoAndSuggestImprovements function.
 * - AnalyzePhotoAndSuggestImprovementsOutput - The return type for the analyzePhotoAndSuggestImprovements function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzePhotoAndSuggestImprovementsInputSchema = z.object({
  photoUrl: z
    .string()
    .url()
    .describe(
      "A publicly accessible HTTPS URL of the photo to analyze."
    ),
});
export type AnalyzePhotoAndSuggestImprovementsInput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsInputSchema>;

const AnalyzePhotoAndSuggestImprovementsOutputSchema = z.object({
  analysis: z.string().describe('Provide a comprehensive, constructive, and friendly analysis of the photo, as if you were a photography coach. Discuss the strengths and weaknesses of the image in Turkish.'),
  improvements: z
    .array(z.string())
    .describe('Provide a list of 3 concrete, actionable suggestions for improvement in Turkish.'),
  rating: z
    .object({
      lighting: z.number().min(1).max(10).describe('Rate the lighting on a scale of 1-10.'),
      composition: z.number().min(1).max(10).describe('Rate the composition on a scale of 1-10.'),
      emotion: z.number().min(1).max(10).describe('Rate the emotional impact or storytelling on a scale of 1-10.'),
      overall: z.number().min(1).max(10).describe('Provide an overall rating for the photo on a scale of 1-10, based on the other criteria.'),
    })
    .describe('Provide ratings for the photo based on the specified criteria.'),
  tags: z.array(z.string()).max(10).describe('Provide up to 10 relevant tags in Turkish for the photo\'s content, style, and mood (e.g., "portre", "manzara", "sokak fotoğrafçılığı", "siyah beyaz", "minimalist", "mutlu").'),
});
export type AnalyzePhotoAndSuggestImprovementsOutput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsOutputSchema>;

// The main function that the application calls.
export async function analyzePhotoAndSuggestImprovements(
  input: AnalyzePhotoAndSuggestImprovementsInput
): Promise<AnalyzePhotoAndSuggestImprovementsOutput> {
  return analysisFlow(input);
}

const analysisPrompt = ai.definePrompt({
  name: 'photoAnalysisPrompt',
  // Model, merkezi genkit.ts dosyasından miras alınır.
  input: {schema: AnalyzePhotoAndSuggestImprovementsInputSchema},
  output: {schema: AnalyzePhotoAndSuggestImprovementsOutputSchema},
  prompt: `You are a world-class photography coach named Viewora AI. Your tone is encouraging, insightful, and professional. Analyze the provided photograph and respond in Turkish.

  Your task is to provide a detailed analysis, actionable improvement tips, and a rating based on the following criteria: lighting, composition, and emotional impact.

  In the 'tags' field, provide up to 10 relevant tags in Turkish that describe the photo's content, style, and mood (e.g., "portre", "manzara", "sokak fotoğrafçılığı", "siyah beyaz", "minimalist", "mutlu"). These tags will be used for filtering.

  Analyze the photo provided: {{media url=photoUrl}}`,
});

const analysisFlow = ai.defineFlow(
  {
    name: 'analysisFlow',
    inputSchema: AnalyzePhotoAndSuggestImprovementsInputSchema,
    outputSchema: AnalyzePhotoAndSuggestImprovementsOutputSchema,
  },
  async (input) => {
    const {output} = await analysisPrompt(input);
    return output!;
  }
);
