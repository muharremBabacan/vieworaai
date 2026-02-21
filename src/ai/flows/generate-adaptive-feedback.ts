'use server';
/**
 * Adaptive Luma Feedback - Profile Integrated Version
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*                               SCHEMAS                                      */
/* -------------------------------------------------------------------------- */

const PhotoTechnicalDataSchema = z.object({
  light_score: z.number(),
  composition_score: z.number(),
  focus_score: z.number(),
  color_control_score: z.number(),
  background_control_score: z.number(),
  creativity_risk_score: z.number(),
});

const AdaptiveFeedbackInputSchema = z.object({
  userGamificationLevel: z.string(),
  language: z.string(),
  technicalAnalysis: PhotoTechnicalDataSchema,
  communicationStyle: z.string().optional(),
  scoreTrend: z.enum(['improving', 'stagnant', 'declining']),
  averageScore: z.number(),
  overallScore: z.number(), // Score of the current photo
});

export type AdaptiveFeedbackInput = z.infer<
  typeof AdaptiveFeedbackInputSchema
>;

const AdaptiveFeedbackOutputSchema = z.object({
  feedback: z.string(),
});

export type AdaptiveFeedbackOutput = z.infer<
  typeof AdaptiveFeedbackOutputSchema
>;

/* -------------------------------------------------------------------------- */
/*                              MAIN EXPORT                                   */
/* -------------------------------------------------------------------------- */

export async function generateAdaptiveFeedback(
  input: AdaptiveFeedbackInput
): Promise<AdaptiveFeedbackOutput> {
  return feedbackFlow(input);
}

/* -------------------------------------------------------------------------- */
/*                                  PROMPT                                    */
/* -------------------------------------------------------------------------- */

const feedbackPrompt = ai.definePrompt({
  name: 'adaptiveFeedbackLumaProfileIntegrated',
  input: { schema: AdaptiveFeedbackInputSchema },
  output: { schema: AdaptiveFeedbackOutputSchema },

  system: `
You are Luma, Viewora’s intelligent visual mentor.
You MUST adapt your tone, depth, and behavioral emphasis based on the user's profile data.

CORE RULES:

1.  **Tone:** Adapt your tone based on the 'communicationStyle' ('soft', 'balanced', 'technical').
2.  **Depth:** Adjust explanation complexity based on 'userGamificationLevel'.
3.  **Trend:** Explicitly reference the user's performance 'scoreTrend' in your feedback (e.g., "Your recent improving trend...", "To break out of this stagnant phase...").
4.  **No Scores:** Do NOT mention numeric scores in your feedback.
5.  **Concise:** Keep feedback concise and to the point.
6.  **Structure:** Structure output with Markdown headers: **Işık**, **Kompozisyon**, **Teknik**.
7.  **No Intro:** No emojis. No self-introduction.
`,

  prompt: `
USER_PROFILE_DATA:
- Level: {{{userGamificationLevel}}}
- Communication Style: {{{communicationStyle}}}
- Recent Trend: {{{scoreTrend}}}
- Historical Average Score: {{{averageScore}}}

CURRENT_PHOTO_DATA:
- Current Photo Score: {{{overallScore}}}
- Light: {{{technicalAnalysis.light_score}}}
- Composition: {{{technicalAnalysis.composition_score}}}
- Focus: {{{technicalAnalysis.focus_score}}}
- Color Control: {{{technicalAnalysis.color_control_score}}}
- Background Control: {{{technicalAnalysis.background_control_score}}}
- Creativity: {{{technicalAnalysis.creativity_risk_score}}}

Respond in language: {{{language}}}

Generate adaptive feedback.
`,
});

/* -------------------------------------------------------------------------- */
/*                                   FLOW                                     */
/* -------------------------------------------------------------------------- */

const feedbackFlow = ai.defineFlow(
  {
    name: 'adaptiveFeedbackFlow',
    inputSchema: AdaptiveFeedbackInputSchema,
    outputSchema: AdaptiveFeedbackOutputSchema,
  },
  async (input) => {
    // Data is now passed directly from the client. No more fetching.
    const { output } = await feedbackPrompt(input);

    if (!output) {
      throw new Error('Adaptive feedback generation failed.');
    }

    return output;
  }
);
