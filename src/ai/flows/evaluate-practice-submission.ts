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
  feedback: z.string().describe("Provide very short, constructive, and friendly feedback (2-3 sentences). Explain if the task was accomplished and what could be improved. Start with a direct comment like 'Great!', 'Good try!', or 'Almost there!'."),
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
  prompt: `You are a friendly and encouraging photography coach, Viewora AI. A student has submitted a photo to complete a practice task from a lesson. Your goal is to provide very brief, actionable feedback in the specified language: {{language}}.

  Evaluate the photo based *only* on the provided task and criteria.

  **Practice Task:**
  "{{practiceTask}}"

  **Success Criteria:**
  {{#each analysisCriteria}}
  - {{{this}}}
  {{/each}}

  Based on this, determine if the photo is a success, provide 2-3 sentences of feedback, and give a score from 1-10. Be direct and helpful.

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
