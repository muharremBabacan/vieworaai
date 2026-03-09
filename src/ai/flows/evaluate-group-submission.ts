'use server';
/**
 * @fileOverview Grup ödevleri için özel AI değerlendirme ajanı.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EvaluateGroupSubmissionInputSchema = z.object({
  photoUrl: z.string().url().describe("Değerlendirilecek fotoğrafın URL'si."),
  assignmentTitle: z.string().describe("Ödev başlığı."),
  assignmentDescription: z.string().describe("Ödev açıklaması ve kuralları."),
  language: z.string().default("tr"),
});

export type EvaluateGroupSubmissionInput = z.infer<typeof EvaluateGroupSubmissionInputSchema>;

const EvaluateGroupSubmissionOutputSchema = z.object({
  isSuccess: z.boolean().describe("Ödev kriterlerine uygunluk durumu."),
  feedback: z.string().describe("Ödev bağlamında teknik geri bildirim (2-3 cümle)."),
  score: z.number().min(1).max(10).describe("Ödeve uygunluk puanı (1-10)."),
  technicalPoints: z.array(z.string()).length(3).describe("Ödev konusuyla ilgili 3 kritik teknik nokta."),
});

export type EvaluateGroupSubmissionOutput = z.infer<typeof EvaluateGroupSubmissionOutputSchema>;

export async function evaluateGroupSubmission(
  input: EvaluateGroupSubmissionInput
): Promise<EvaluateGroupSubmissionOutput> {
  return groupEvaluationFlow(input);
}

const groupEvaluationPrompt = ai.definePrompt({
  name: 'groupEvaluationPrompt',
  input: { schema: EvaluateGroupSubmissionInputSchema },
  output: { schema: EvaluateGroupSubmissionOutputSchema },
  prompt: `
You are Luma, a professional photography instructor. 
Your task is to evaluate a student's photo based on a SPECIFIC GROUP ASSIGNMENT.

ASSIGNMENT: "{{{assignmentTitle}}}"
GOAL: "{{{assignmentDescription}}}"

EVALUATION CRITERIA:
1. Does the photo respect the theme of the assignment? (e.g. if it's "Window Portrait", is there a person and a window light?)
2. Provide constructive feedback focusing ONLY on this specific assignment topic.
3. Give a score from 1 to 10.
4. List 3 technical points they achieved or missed specifically for this assignment.

Respond in language: {{{language}}}

Analyze the photo: {{media url=photoUrl}}
`,
});

const groupEvaluationFlow = ai.defineFlow(
  {
    name: 'groupEvaluationFlow',
    inputSchema: EvaluateGroupSubmissionInputSchema,
    outputSchema: EvaluateGroupSubmissionOutputSchema,
  },
  async (input) => {
    const { output } = await groupEvaluationPrompt(input);
    if (!output) throw new Error("AI group submission analysis failed");
    return output;
  }
);
