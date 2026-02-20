'use server';
/**
 * Adaptive Luma Feedback - Profile Integrated Version
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getUserProfileIndex } from '@/lib/firestore/userProfile'; // ← Firestore helper

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
  userId: z.string(),
  language: z.string(),
  technicalAnalysis: PhotoTechnicalDataSchema,
  currentPhotoAverageScore: z.number(),
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

You MUST use USER_PROFILE_INDEX to adapt tone, depth, and behavioral emphasis.

CORE RULES:

1. Tone comes from communication_profile.tone.
2. Depth comes from dominant_technical_level.
3. Interpret consistency_gap:
   - 0–5 → Stable
   - 6–12 → Moderate inconsistency
   - 13+ → High inconsistency (reinforce fundamentals)

4. Always reference trend.direction explicitly.
5. Do NOT mention numeric scores.
6. Keep feedback concise.
7. Structure output with Markdown headers:
   **Işık**
   **Kompozisyon**
   **Teknik**
8. No emojis. No self-introduction.
`,

  prompt: `
USER_PROFILE_INDEX:
\`\`\`json
{{{userProfileIndex}}}
\`\`\`

PHOTO_TECHNICAL_DATA:
- Light: {{{technicalAnalysis.light_score}}}
- Composition: {{{technicalAnalysis.composition_score}}}
- Focus: {{{technicalAnalysis.focus_score}}}
- Color Control: {{{technicalAnalysis.color_control_score}}}
- Background Control: {{{technicalAnalysis.background_control_score}}}
- Creativity: {{{technicalAnalysis.creativity_risk_score}}}

USER_RECENT_AVERAGE: {{{recentAverage}}}
CURRENT_PHOTO_AVERAGE: {{{currentPhotoAverageScore}}}

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
    // 1️⃣ Firestore’dan profil çek
    const userProfileIndex = await getUserProfileIndex(input.userId);

    if (!userProfileIndex) {
      throw new Error('User profile index not found.');
    }

    // 2️⃣ Prompt’a entegre et
    const { output } = await feedbackPrompt({
      ...input,
      userProfileIndex,
      recentAverage: userProfileIndex.profile_index_score,
    });

    if (!output) {
      throw new Error('Adaptive feedback generation failed.');
    }

    return output;
  }
);