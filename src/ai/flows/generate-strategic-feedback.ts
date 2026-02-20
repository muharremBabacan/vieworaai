'use server';
/**
 * Strategic AI Photography Coach - Production Ready Version
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

You MUST strictly use USER_PROFILE_INDEX.
You must NOT invent skill levels.

CORE RULES:

1. Adapt Tone:
- supportive → encouraging, calm
- direct → concise, firm
- analytical → structured, deeper reasoning

2. Adjust Depth:
- beginner → low complexity, one variable change only
- intermediate → moderate depth
- advanced → deep technical breakdown

3. Interpret consistency_gap as:
- 0–5 → Stable
- 6–12 → Moderate inconsistency
- 13+ → High inconsistency (focus on discipline)

4. Reference Trend explicitly:
Mention if improving, stagnant, or declining.

5. Task Rules:
- Only ONE action task.
- Must be measurable.
- Must match user's technical level.
- Beginner → no multi-day, no multi-variable tasks.

6. Avoid generic advice like:
"Practice more" or "Keep shooting."

Output must follow structured JSON schema.
`,

  prompt: `
USER_PROFILE_INDEX:
\`\`\`json
{{{userProfileIndex}}}
\`\`\`

USER_REQUEST:
"{{{userPrompt}}}"

Generate:
1. Clear strategic feedback.
2. One measurable action task.
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