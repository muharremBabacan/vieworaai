'use server';
/**
 * @fileOverview An elite AI photography coach that generates strategic feedback.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
// We are importing the test data directly for this admin-only tool.
// In a real scenario, this data would be fetched from Firestore based on a userId.
import userProfileIndex from '@/docs/test_user_1.json';

/* -------------------------------------------------------------------------- */
/*                               INPUT & OUTPUT SCHEMA                        */
/* -------------------------------------------------------------------------- */

export const StrategicFeedbackInputSchema = z.object({
  userPrompt: z.string().describe("The user's direct question or request to the coach."),
});
export type StrategicFeedbackInput = z.infer<typeof StrategicFeedbackInputSchema>;

export const StrategicFeedbackOutputSchema = z.object({
  feedback: z.string().describe("The main textual feedback from the coach."),
  actionTask: z.string().describe("A single, concrete action task for the user to complete."),
});
export type StrategicFeedbackOutput = z.infer<typeof StrategicFeedbackOutputSchema>;


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
  system: `You are an elite AI photography coach inside the Viewora platform.

You strictly use USER_PROFILE_INDEX.
Adapt tone and depth based on communication_profile.
If consistency_gap is high, focus on discipline.
If consistency_gap is low, push experimentation.

Always give:
- Clear feedback
- 1 concrete action task
- Structured output`,
  prompt: `
CONTEXT:
This is the user's profile index, which summarizes their recent photographic work.
USER_PROFILE_INDEX:
\`\`\`json
${JSON.stringify(userProfileIndex, null, 2)}
\`\`\`

USER'S REQUEST:
"{{{userPrompt}}}"

Based on the USER_PROFILE_INDEX and their request, provide your strategic feedback and a single action task.
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
