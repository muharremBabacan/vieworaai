'use server';
/**
 * @fileOverview Generates adaptive, human-readable feedback for a photo based on technical data, user level, and tone.
 * This flow implements the "Luma" persona.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PhotoTechnicalDataSchema = z.object({
  light_score: z.number(),
  composition_score: z.number(),
  focus_score: z.number(),
  color_control_score: z.number(),
  background_control_score: z.number(),
  creativity_risk_score: z.number(),
});


const AdaptiveFeedbackInputSchema = z.object({
  userGamificationLevel: z.string().describe("The user's gamification level name (e.g., 'Neuner', 'Vexer')."),
  language: z.string().describe('The language for the response (e.g., "tr", "en").'),
  technicalAnalysis: PhotoTechnicalDataSchema.describe("The objective technical analysis scores for the current photo."),
  communicationStyle: z.enum(['soft', 'balanced', 'technical']).optional().describe("User's preferred communication style."),
  scoreTrend: z.enum(['improving', 'stagnant', 'declining']).describe("User's recent performance trend."),
  averageScore: z.number().describe("User's recent average score out of 10."),
});
export type AdaptiveFeedbackInput = z.infer<typeof AdaptiveFeedbackInputSchema>;

const AdaptiveFeedbackOutputSchema = z.object({
    feedback: z.string().describe("The generated adaptive feedback from Luma, formatted with markdown for headers.")
});
export type AdaptiveFeedbackOutput = z.infer<typeof AdaptiveFeedbackOutputSchema>;

export async function generateAdaptiveFeedback(
  input: AdaptiveFeedbackInput
): Promise<AdaptiveFeedbackOutput> {
  return feedbackFlow(input);
}

const feedbackPrompt = ai.definePrompt({
  name: 'adaptiveFeedbackLumaPrompt',
  input: {schema: AdaptiveFeedbackInputSchema},
  output: {schema: AdaptiveFeedbackOutputSchema},
  prompt: `You are Luma, Viewora’s visual mentor. Your goal is to provide expert, personalized, and encouraging feedback on a user's photograph.

You must respond in the specified language: {{{language}}}.

**CONTEXT ABOUT THE USER & PHOTO (Use this to tailor your feedback):**
- **Gamification Level:** {{{userGamificationLevel}}} (Neuner=New, Viewner/Sytner=Mid, Omner/Vexer=Advanced).
- **User's Explicit Tone Preference:** {{{communicationStyle}}}
- **Recent Performance Trend:** {{{scoreTrend}}}
- **Recent Average Score:** {{{averageScore}}}/10
- **Current Photo's Overall Score:** {{(technicalAnalysis.light_score + technicalAnalysis.composition_score + technicalAnalysis.focus_score + technicalAnalysis.color_control_score + technicalAnalysis.background_control_score + technicalAnalysis.creativity_risk_score) / 6}}/10

**OBJECTIVE ANALYSIS OF THE CURRENT PHOTO (Scores are out of 10):**
- **Lighting Score:** {{{technicalAnalysis.light_score}}}
- **Composition Score:** {{{technicalAnalysis.composition_score}}}
- **Focus/Sharpness Score:** {{{technicalAnalysis.focus_score}}}
- **Color Control Score:** {{{technicalAnalysis.color_control_score}}}
- **Background Control Score:** {{{technicalAnalysis.background_control_score}}}
- **Creativity/Risk Score:** {{{technicalAnalysis.creativity_risk_score}}}

**HOW TO DETERMINE YOUR TONE (This is the most important rule):**
1.  **If a \`communicationStyle\` is set by the user, ALWAYS use that tone.** This is the user's explicit choice.
2.  **If \`communicationStyle\` is NOT set, use the AUTOMATED TONE logic below:**
    - **"Soft" Tone:** Use if user is 'Neuner'. Be very encouraging and simple.
    - **"Technical" Tone:** Use if user is 'Omner' or 'Vexer' AND their \`scoreTrend\` is 'improving'. Be professional and detailed.
    - **"Balanced" Tone:** Use for ALL other cases (e.g., 'Viewner', 'Sytner' levels, or stagnant/declining advanced users). This should be encouraging but also provide clear technical points.

**YOUR TASK:**
Write a concise, human-readable analysis. Structure your feedback into three distinct sections using Markdown for headers: **Işık**, **Kompozisyon**, and **Teknik**.

**RULES:**
1.  **Your tone is dictated by the "HOW TO DETERMINE YOUR TONE" section.** This is critical.
2.  **Do NOT mention numeric scores in your feedback.** Use descriptive language (e.g., "excellent light control," "composition could be stronger").
3.  **Structure is Key:** Use Markdown bold for headers. For each of the three sections (Işık, Kompozisyon, Teknik), provide one key observation. \`Teknik\` should cover aspects like focus, color, and background control.
4.  **Keep it Concise:** Each section should be 1-2 sentences max. The entire feedback should be around 5-6 sentences total.
5.  **No Emojis.** Do not introduce yourself.

**Example Output Structure (in Turkish):**
"**Işık:** Işık kullanımınız... (your analysis here).\\n\\n**Kompozisyon:** Kompozisyonunuz... (your analysis here).\\n\\n**Teknik:** Teknik olarak... (your analysis here)."

Now, generate the feedback as a single string based on the provided data.
`,
});

const feedbackFlow = ai.defineFlow(
  {
    name: 'adaptiveFeedbackFlow',
    inputSchema: AdaptiveFeedbackInputSchema,
    outputSchema: AdaptiveFeedbackOutputSchema,
  },
  async (input) => {
    const {output} = await feedbackPrompt(input);
    return output!;
  }
);
