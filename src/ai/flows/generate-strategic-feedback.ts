
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
  profile_index_score: z.number().optional(),
});

const StrategicFeedbackInputSchema = z.object({
    userPrompt: z.string(),
    userProfileIndex: UserProfileIndexSchema,
    language: z.string().describe('The language for the response (e.g., "tr", "en").'),
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
  explanations: z.array(z.object({
    term: z.string().describe("The complex technical or artistic term used."),
    definition: z.string().describe("A simple, short explanation of the term.")
  })).optional().describe("Glossary for complex terms like 'Minimalism', 'Chiaroscuro', etc."),
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

CORE RULES:
1.  **Rehberlik Tonu:** Asla "Hatalısın" deme. Bunun yerine "Bu yaklaşımı [şöyle] güncellersek, anlatmak istediğin hikaye çok daha netleşir" de.
2.  **Fotoğraf Odaklı Görevler:** 'actionTask' alanı ASLA 'not al', 'yaz', 'araştır' veya 'teori çalış' gibi pratik olmayan ödevler içermemelidir. Ödevler her zaman 'bir fotoğraf çekme' (shooting assignment) görevi olmalıdır.
3.  **Terim Açıklamaları (Glossary):** Feedback içerisinde 'Minimalizm', 'Yüksek Kontrast', 'Altın Oran', 'Chiaroscuro', 'ISO' gibi herkesin bilmeyebileceği teknik veya sanatsal terimler kullanırsan, bunları 'explanations' listesinde mutlaka kısa ve anlaşılır şekilde açıkla.
4.  **Adapt Tone:** Match 'communication_profile.tone' but always stay within the guide persona.
5.  **Adjust Depth:** Match 'dominant_technical_level'.

Output must be structured JSON.
`,

  prompt: `
USER_PROFILE_INDEX:
\`\`\`json
{{{userProfileIndex}}}
\`\`\`

USER_REQUEST:
"{{{userPrompt}}}"

Respond in language: {{{language}}}

Generate strategic guidance and one photo-based action task in Turkish. 
Make the artist realize their path to mastery. Explain complex terms if used.
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
