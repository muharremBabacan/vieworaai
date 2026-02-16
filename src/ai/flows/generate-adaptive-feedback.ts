'use server';
/**
 * @fileOverview Generates adaptive, human-readable feedback for a photo based on technical data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// This is a subset of the full analysis, only what's needed for the prompt.
const PhotoTechnicalDataSchema = z.object({
  light_score: z.number(),
  composition_score: z.number(),
  focus_score: z.number(),
  color_control_score: z.number(),
  background_control_score: z.number(),
  creativity_risk_score: z.number(),
});

const AdaptiveFeedbackInputSchema = z.object({
    userLevel: z.enum(["beginner", "intermediate", "advanced"]),
    language: z.string().describe('The language for the response (e.g., "tr", "en").'),
    photoData: PhotoTechnicalDataSchema,
});
export type AdaptiveFeedbackInput = z.infer<typeof AdaptiveFeedbackInputSchema>;

const AdaptiveFeedbackOutputSchema = z.object({
    feedback: z.string().describe("The generated adaptive feedback, following the 3:1 rule. Max 5 sentences.")
});
export type AdaptiveFeedbackOutput = z.infer<typeof AdaptiveFeedbackOutputSchema>;

export async function generateAdaptiveFeedback(
  input: AdaptiveFeedbackInput
): Promise<AdaptiveFeedbackOutput> {
  return feedbackFlow(input);
}

const feedbackPrompt = ai.definePrompt({
  name: 'adaptiveFeedbackPrompt',
  input: {schema: AdaptiveFeedbackInputSchema},
  output: {schema: AdaptiveFeedbackOutputSchema},
  prompt: `You are a supportive photography coach. Respond in the specified language: {{{language}}}.

User level: {{{userLevel}}}

Photo technical data:
- light_score: {{{photoData.light_score}}}
- composition_score: {{{photoData.composition_score}}}
- focus_score: {{{photoData.focus_score}}}
- color_score: {{{photoData.color_control_score}}}
- background_score: {{{photoData.background_control_score}}}
- risk_score: {{{photoData.creativity_risk_score}}}

Rules:
- Follow 3:1 rule (3 positive observations, 1 improvement suggestion).
- Do not criticize harshly.
- Suggest improvement as opportunity.
- Maximum 5 sentences.
`,
});

const feedbackFlow = ai.defineFlow(
  {
    name: 'adaptiveFeedbackFlow',
    inputSchema: AdaptiveFeedbackInputSchema,
    outputSchema: AdaptiveFeedbackOutputSchema,
  },
  async (input) => {
    const {output} = await feedbackPrompt(input);
    return output!;
  }
);
