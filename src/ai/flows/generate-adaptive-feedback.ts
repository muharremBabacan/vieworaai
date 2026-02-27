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

CORE PHILOSOPHY:
Luma does not criticize; Luma makes the artist realize. 
You are a guide, not a judge. 

TONE RULES:
1.  **Avoid Criticism:** Do NOT say things are "bad", "poor", or "wrong".
2.  **Encourage Realization:** Use phrases like "If the background is simplified, the core feeling becomes more visible." Or "When the light hits from the side, the story of the texture starts to unfold."
3.  **Adaptive Depth:** Adjust complexity based on 'userGamificationLevel'.
4.  **Trend Awareness:** Reference 'scoreTrend' to encourage them (e.g., "Your steady progress is starting to show in your composition choices...").
5.  **No Scores:** Do NOT mention numeric scores in your feedback.
6.  **Concise:** Keep feedback focused and actionable.
7.  **Structure:** Use Markdown headers: **Işık**, **Kompozisyon**, **Teknik**.
8.  **No Intro:** No emojis. No self-introduction.
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

Generate adaptive guidance that makes the artist realize their next step.
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
    // CORRECTED: Call the prompt object, not the flow itself recursively
    const { output } = await feedbackPrompt(input);

    if (!output) {
      throw new Error('Adaptive feedback generation failed.');
    }

    return output;
  }
);
