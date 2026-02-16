'use server';
/**
 * @fileOverview Generates adaptive, human-readable feedback for a photo based on technical data, user level, and tone.
 * This flow implements the "Luma" persona.
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
  userXpLevel: z.string().describe("The user's experience level name (e.g., 'Neuner', 'Vexer')."),
  profileLevel: z.string().describe("The user's technical profile level based on photo history (e.g., 'beginner', 'advanced')."),
  tone: z.enum(['direct', 'gentle']).describe("The desired tone for the feedback."),
  language: z.string().describe('The language for the response (e.g., "tr", "en").'),
  photoData: PhotoTechnicalDataSchema,
});
export type AdaptiveFeedbackInput = z.infer<typeof AdaptiveFeedbackInputSchema>;

const AdaptiveFeedbackOutputSchema = z.object({
    feedback: z.string().describe("The generated adaptive feedback from Luma.")
});
export type AdaptiveFeedbackOutput = z.infer<typeof AdaptiveFeedbackOutputSchema>;

export async function generateAdaptiveFeedback(
  input: AdaptiveFeedbackInput
): Promise<AdaptiveFeedbackOutput> {
  return feedbackFlow(input);
}

const feedbackPrompt = ai.definePrompt({
  name: 'adaptiveFeedbackLumaPrompt',
  input: {schema: AdaptiveFeedbackInputSchema},
  output: {schema: AdaptiveFeedbackOutputSchema},
  prompt: `You are Luma, Viewora’s visual mentor.

You are calm, professional, and growth-oriented.
You are not a mascot.
You do not exaggerate praise.
You guide clearly and respectfully.

Respond in the specified language: {{{language}}}.

User XP Level: {{{userXpLevel}}}
Technical Profile Level: {{{profileLevel}}}
Tone Style: {{{tone}}}

Photo Technical Data:
- light_score: {{{photoData.light_score}}}
- composition_score: {{{photoData.composition_score}}}
- focus_score: {{{photoData.focus_score}}}
- color_score: {{{photoData.color_control_score}}}
- background_score: {{{photoData.background_control_score}}}
- creativity_risk_score: {{{photoData.creativity_risk_score}}}

Rules:
- Do NOT mention numeric scores.
- Provide 3 strengths and 1 improvement suggestion.
- Keep it under 6 sentences.
- No emojis.
- No childish tone.
- Do not say you are an AI.
- Do not introduce yourself each time.
- If beginner, simplify language.
- If advanced, be more precise.
- If tone is "direct", be concise and firm.
- If tone is "gentle", soften the suggestion slightly.

Write only the feedback.
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
