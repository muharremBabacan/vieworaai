'use server';
/**
 * Strategic AI Photography Coach - Production Ready Version
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*                               INPUT & OUTPUT SCHEMA                        */
/* -------------------------------------------------------------------------- */

const UserProfileIndexSchema = z.object({
  dominant_style: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  dominant_technical_level: z.enum(['beginner', 'intermediate', 'advanced']),
  trend: z.object({
    direction: z.enum(['improving', 'stagnant', 'declining']),
    percentage: z.number(),
  }),
  consistency_gap: z.number(),
  communication_profile: z.object({
    tone: z.enum(['supportive', 'direct', 'analytical']),
    explanation_depth: z.enum(['low', 'medium', 'high']),
    challenge_level: z.number(),
  }),
});

const StrategicFeedbackInputSchema = z.object({
    userPrompt: z.string(),
    userProfileIndex: UserProfileIndexSchema,
});
export type StrategicFeedbackInput = z.infer<
  typeof StrategicFeedbackInputSchema
>;

const StrategicFeedbackOutputSchema = z.object({
  feedback: z.string(),
  actionTask: z.object({
    title: z.string(),
    steps: z.array(z.string()),
    metric: z.string(),
    difficulty: z.number(),
  }),
});

export type StrategicFeedbackOutput = z.infer<
  typeof StrategicFeedbackOutputSchema
>;

/* -------------------------------------------------------------------------- */
/*                                MAIN EXPORT                                 */
/* -------------------------------------------------------------------------- */

export async function generateStrategicFeedback(
  input: StrategicFeedbackInput
): Promise<StrategicFeedbackOutput> {
  return strategicFeedbackFlow(input);
}

/* -------------------------------------------------------------------------- */
/*                                  PROMPT                                    */
/* -------------------------------------------------------------------------- */

const generationPrompt = ai.definePrompt({
  name: 'strategicCoachPrompt',
  input: { schema: StrategicFeedbackInputSchema },
  output: { schema: StrategicFeedbackOutputSchema },

  system: `
You are an elite AI photography coach inside the Viewora platform.

You MUST strictly use USER_PROFILE_INDEX. You must NOT invent skill levels.

CORE RULES:

1.  **Adapt Tone:** Your response tone must match 'communication_profile.tone'.
    *   'supportive' -> Use encouraging, calm, and positive language.
    *   'direct' -> Be concise, clear, and firm. Get straight to the point.
    *   'analytical' -> Use structured reasoning and deeper, logical explanations.

2.  **Adjust Depth:** The complexity of your explanation must match 'dominant_technical_level'.
    *   'beginner' -> Keep explanations simple. Suggest tasks that change only one variable at a time.
    *   'intermediate' -> Provide moderate depth, comparing options or discussing decision-making.
    *   'advanced' -> Give a deep technical breakdown, mentioning professional workflows or advanced execution insights.

3.  **Reference Trend Explicitly:** You MUST mention the user's performance 'trend.direction' in your feedback (e.g., "Your recent improving trend...", "To break out of this stagnant phase...").

4.  **Interpret Consistency Gap Behaviorally:** The 'consistency_gap' value dictates your behavioral focus.
    *   0–5 (Stable): Praise consistency and suggest creative exploration.
    *   6–12 (Moderate Inconsistency): Recommend focused practice on one of the 'weaknesses'.
    *   13+ (High Inconsistency): Emphasize discipline, reinforcing fundamentals from the 'weaknesses' list.

5.  **Task Rules:**
    *   The 'actionTask' you provide MUST be measurable and directly address a 'weakness'.
    *   It must be appropriate for the user's 'dominant_technical_level'.
    *   Beginner tasks should NOT be multi-day or involve changing multiple variables.

6.  **Avoid Generic Advice:** Do NOT use empty phrases like "Practice more," "Keep shooting," or "Experiment." Your advice must be specific and actionable.

Output must follow the structured JSON schema.
`,

  prompt: `
USER_PROFILE_INDEX:
\`\`\`json
{{{userProfileIndex}}}
\`\`\`

USER_REQUEST:
"{{{userPrompt}}}"

Generate:
1. Clear strategic feedback based on all the rules.
2. One measurable action task that is directly derived from the feedback.
`,
});

/* -------------------------------------------------------------------------- */
/*                                   FLOW                                     */
/* -------------------------------------------------------------------------- */

const strategicFeedbackFlow = ai.defineFlow(
  {
    name: 'strategicFeedbackFlow',
    inputSchema: StrategicFeedbackInputSchema,
    outputSchema: StrategicFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await generationPrompt(input);

    if (!output) {
      throw new Error('AI strategic feedback generation failed.');
    }

    return output;
  }
);
