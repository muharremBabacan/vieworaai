'use server';
/**
 * @fileOverview An AI agent that evaluates a user's photo submission for a specific academy lesson.
 *
 * - evaluatePracticeSubmission - A function that handles the photo evaluation process.
 * - EvaluatePracticeSubmissionInput - The input type for the function.
 * - EvaluatePracticeSubmissionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluatePracticeSubmissionInputSchema = z.object({
  photoUrl: z.string().url().describe("A publicly accessible HTTPS URL of the photo to evaluate."),
  practiceTask: z.string().describe("The specific practice task the user was trying to accomplish."),
  analysisCriteria: z.array(z.string()).describe("The criteria for a successful photo for this lesson."),
  language: z.string().describe('The language for the response (e.g., "tr", "en").'),
});
export type EvaluatePracticeSubmissionInput = z.infer<typeof EvaluatePracticeSubmissionInputSchema>;

const EvaluatePracticeSubmissionOutputSchema = z.object({
  isSuccess: z.boolean().describe("Whether the user successfully applied the lesson's concepts based on the criteria."),
  feedback: z.string().describe("Guidance-oriented feedback (2-3 sentences)."),
  score: z.number().min(1).max(10).describe("Rate how well the photo meets the practice task and criteria on a scale of 1-10."),
});
export type EvaluatePracticeSubmissionOutput = z.infer<typeof EvaluatePracticeSubmissionOutputSchema>;

export async function evaluatePracticeSubmission(
  input: EvaluatePracticeSubmissionInput
): Promise<EvaluatePracticeSubmissionOutput> {
  return evaluationFlow(input);
}

const evaluationPrompt = ai.definePrompt({
  name: 'practiceEvaluationPrompt',
  input: {schema: EvaluatePracticeSubmissionInputSchema},
  output: {schema: EvaluatePracticeSubmissionOutputSchema},
  prompt: `You are Luma, a friendly and encouraging photography coach. 

CORE PHILOSOPHY:
Luma does not criticize; Luma makes the artist realize. 
You are a guide, not a judge. 
Never say "This is wrong" or "The lighting is bad". 
Instead, help them see the potential: "A slight shift in the light direction could emphasize the texture even more."

Evaluate the photo based strictly on the provided task and criteria, but deliver it with this guiding persona.

**Practice Task:**
"{{practiceTask}}"

**Success Criteria:**
{{#each analysisCriteria}}
- {{{this}}}
{{/each}}

**Your Task:**
1.  **Analyze:** Check if the user's photo meets the success criteria.
2.  **Score:** Give a score from 1 to 10 based on criteria fulfillment.
3.  **Feedback:** Provide 2-3 sentences of guidance. Help them realize how to improve. Use phrases like "If [change], then [benefit becomes visible]". 
4.  **Success Flag:** Set \`isSuccess\` to \`true\` if the score is 7 or higher.

Respond in language: {{{language}}}

Analyze the photo provided: {{media url=photoUrl}}`,
});

const evaluationFlow = ai.defineFlow(
  {
    name: 'evaluationFlow',
    inputSchema: EvaluatePracticeSubmissionInputSchema,
    outputSchema: EvaluatePracticeSubmissionOutputSchema,
  },
  async (input) => {
    const {output} = await evaluationPrompt(input);
    return output!;
  }
);
