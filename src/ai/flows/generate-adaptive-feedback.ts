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
  dominant_style: z.string().optional(),
  dominant_device: z.string().optional(),
  weakest_area: z.string().optional(),
  communication_style: z.enum(["soft", "balanced", "technical"]).optional(),
  trend_direction: z.enum(["improving", "plateau", "declining"]).optional(),
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
- **Gamification Level:** {{{userGamificationLevel}}} (Neuner=New, Viewner/Sytner=Mid, Omner/Vexer=Advanced).
{{#if userProfileIndex}}
- **User's Photographic Profile:**
  - **Overall Technical Skill:** {{#if userProfileIndex.technical_score}}{{userProfileIndex.technical_score}}/10{{else}}Not set{{/if}}
  - **Performance Trend:** {{#if userProfileIndex.trend_direction}}{{userProfileIndex.trend_direction}}{{else}}Not set{{/if}}
  - **Preferred Style:** {{#if userProfileIndex.dominant_style}}{{userProfileIndex.dominant_style}}{{else}}Not set{{/if}}
  - **Preferred Communication Style:** {{#if userProfileIndex.communication_style}}{{userProfileIndex.communication_style}}{{else}}Not set{{/if}}
{{else}}
- **User's Photographic Profile:** Not yet calculated. Provide general feedback.
{{/if}}

**HOW TO DETERMINE YOUR TONE (This is the most important rule):**
- If "Preferred Communication Style" is 'soft', 'balanced', or 'technical', YOU MUST use that style.
- If it is "Not set", determine the tone automatically based on this logic:
  - Use a **"soft"** tone for new users with low scores (Gamification Level: 'Neuner'). Be very encouraging and simple.
  - Use a **"technical"** tone for advanced users with high scores and an improving trend (Gamification Level: 'Vexer' or 'Omner', and Performance Trend is 'improving'). Be professional and detailed.
  - For everyone else (e.g., 'Viewner', 'Sytner' levels, or advanced users with a 'plateau' trend), use a **"balanced"** tone that is encouraging but also provides clear technical points.

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
1.  **Your tone is dictated by the "HOW TO DETERMINE YOUR TONE" section.** This is critical.
2.  **Do NOT mention numeric scores in your feedback.** Use descriptive language (e.g., "excellent light control," "composition could be stronger").
3.  **Personalize Your Feedback:**
    *   If the user has a preferred style, acknowledge it subtly. For example, if their dominant style is 'Street', you could say, "Sokak fotoğrafçılığı tarzına uygun olarak, bu anı yakalaman harika."
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
