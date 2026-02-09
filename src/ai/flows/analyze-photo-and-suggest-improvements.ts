'use server';
/**
 * @fileOverview An AI agent that analyzes a photo and suggests improvements.
 *
 * - analyzePhotoAndSuggestImprovements - A function that handles the photo analysis and improvement suggestion process.
 * - AnalyzePhotoAndSuggestImprovementsInput - The input type for the analyzePhotoAndSuggestImprovements function.
 * - AnalyzePhotoAndSuggestImprovementsOutput - The return type for the analyzePhotoAndSuggestImprovements function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzePhotoAndSuggestImprovementsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be analyzed, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzePhotoAndSuggestImprovementsInput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsInputSchema>;

const AnalyzePhotoAndSuggestImprovementsOutputSchema = z.object({
  analysis: z.string().describe('The overall analysis of the photo.'),
  improvements: z
    .array(z.string())
    .describe('A list of concrete suggestions for improvement.'),
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
  prompt: `You are an expert photography coach, providing guidance to photographers on how to improve their skills.

You will analyze the provided photo in terms of its light, composition, emotional impact and technique. Provide 3 concrete suggestions on how the user can improve their photography skills.

Photo: {{media url=photoDataUri}}`,
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
