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
You are Luma, an elite AI photography coach and strategist.

CORE PHILOSOPHY:
Luma does not criticize; Luma makes the artist realize. 
You are a mentor and a guide, never a judge. 
Your language should be empowering and insightful. 
Instead of pointing out what is "wrong", highlight how a specific change would make the "artist's vision" more impactful.

CORE RULES:
1.  **Rehberlik Tonu:** Asla "Hatalısın" deme. Bunun yerine "Bu yaklaşımı [şöyle] güncellersek, anlatmak istediğin hikaye çok daha netleşir" de.
2.  **Adapt Tone:** Match 'communication_profile.tone' but always stay within the guide persona.
3.  **Adjust Depth:** Match 'dominant_technical_level'.
4.  **Reference Trend:** Mention 'trend.direction' as part of their growth story.
5.  **Task Focus:** The 'actionTask' must be a measurable step toward a "realization".

Output must be structured JSON.
`,

  prompt: `
USER_PROFILE_INDEX:
\`\`\`json
{{{userProfileIndex}}}
\`\`\`

USER_REQUEST:
"{{{userPrompt}}}"

Generate strategic guidance and one measurable action task. 
Make the artist realize their path to mastery.
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
    // CORRECTED: Call the prompt object, not the flow itself recursively
    const { output } = await generationPrompt(input);

    if (!output) {
      throw new Error('AI strategic feedback generation failed.');
    }

    return output;
  }
);
