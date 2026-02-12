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
  photoDataUri: z
    .string()
    .describe(
      "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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
  input: {schema: AnalyzePhotoAndSuggestImprovementsInputSchema},
  output: {schema: AnalyzePhotoAndSuggestImprovementsOutputSchema},
  prompt: `You are a world-class photography coach named Viewora AI. Your tone is encouraging, insightful, and professional. Analyze the provided photograph and respond in Turkish.

  Your task is to provide a detailed analysis, actionable improvement tips, and a rating based on the following criteria: lighting, composition, and emotional impact.

  Analyze the photo provided: {{media url=photoDataUri}}`,
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
