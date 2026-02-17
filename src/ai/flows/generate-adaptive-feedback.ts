'use server';
/**
 * @fileOverview Generates adaptive, human-readable feedback for a photo based on technical data, user level, and tone.
 * This flow implements the "Luma" persona.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// This is a subset of the full analysis, only what's needed for the prompt.
const PhotoTechnicalDataSchema = z.object({
  light_score: z.number(),
  composition_score: z.number(),
  focus_score: z.number(),
  color_control_score: z.number(),
  background_control_score: z.number(),
  creativity_risk_score: z.number(),
});

// This is a subset of the full UserProfileIndex, defined in src/types
const UserProfileIndexSchema = z.object({
  technical_score: z.number().optional(),
  dominant_genre: z.string().optional(),
  dominant_device: z.string().optional(),
}).optional();


const AdaptiveFeedbackInputSchema = z.object({
  userGamificationLevel: z.string().describe("The user's gamification level name (e.g., 'Neuner', 'Vexer')."),
  userProfileIndex: UserProfileIndexSchema.describe("The user's calculated photographic profile index. This is calculated on-demand and might be undefined."),
  language: z.string().describe('The language for the response (e.g., "tr", "en").'),
  technicalAnalysis: PhotoTechnicalDataSchema.describe("The objective technical analysis scores for the current photo."),
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

**CONTEXT ABOUT THE USER (Use this to tailor your feedback):**
- **Gamification Level:** {{{userGamificationLevel}}} (This shows their engagement with the app, from Neuner (beginner) to Vexer (expert)).
{{#if userProfileIndex}}
- **User's Photographic Profile:**
  - **Overall Technical Skill:** {{userProfileIndex.technical_score}}/10
  - **Preferred Genre:** {{userProfileIndex.dominant_genre}}
  - **Preferred Device:** {{userProfileIndex.dominant_device}}
{{else}}
- **User's Photographic Profile:** Not yet calculated. Provide general feedback.
{{/if}}

**OBJECTIVE ANALYSIS OF THE CURRENT PHOTO (Scores are out of 10):**
- **Lighting Score:** {{{technicalAnalysis.light_score}}}
- **Composition Score:** {{{technicalAnalysis.composition_score}}}
- **Focus/Sharpness Score:** {{{technicalAnalysis.focus_score}}}
- **Color Control Score:** {{{technicalAnalysis.color_control_score}}}
- **Background Control Score:** {{{technicalAnalysis.background_control_score}}}
- **Creativity/Risk Score:** {{{technicalAnalysis.creativity_risk_score}}}

**YOUR TASK:**
Write a concise, human-readable analysis. Structure your feedback into three distinct sections using Markdown for headers: **Işık**, **Kompozisyon**, and **Teknik**.

**RULES:**
1.  **Do NOT mention numeric scores in your feedback.** Use descriptive language (e.g., "excellent light control," "composition could be stronger").
2.  **Be a Mentor, Not a Machine:** Your tone should be professional, calm, and growth-oriented. Avoid generic AI phrases.
3.  **Personalize Your Feedback:**
    *   If the user has a profile, acknowledge it subtly. For example, if their dominant genre is 'Street', you could say, "Sokak fotoğrafçılığı tarzına uygun olarak, bu anı yakalaman harika."
    *   If their technical score is high, use more professional language. If it's low, be simpler and more encouraging.
    *   If the user's gamification level is high (e.g., Vexer), treat them like a peer. If it's low (e.g., Neuner), be more guiding.
4.  **Structure is Key:** Use Markdown bold for headers. For each of the three sections (Işık, Kompozisyon, Teknik), provide one key observation. \`Teknik\` should cover aspects like focus, color, and background control.
5.  **Keep it Concise:** Each section should be 1-2 sentences max. The entire feedback should be around 5-6 sentences total.
6.  **No Emojis.** Do not introduce yourself.

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

    