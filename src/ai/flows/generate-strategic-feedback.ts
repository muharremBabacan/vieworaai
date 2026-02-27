'use server';
/**
 * Strategic AI Photography Coach - Elite Production Version
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
  metrics: z.object({
    composition: z.number(),
    light: z.number(),
    storytelling: z.number(),
    technical_clarity: z.number(),
    boldness: z.number(),
  }).optional(),
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
  feedback: z.string().describe("Direct, data-driven coaching summary. Start with 'Son 12 fotoğraf analizine göre...' and list the calculated metrics first."),
  actionTask: z.object({
    title: z.string(),
    purpose: z.string().describe("The 'Amaç' of the task."),
    steps: z.array(z.string()).describe("Detailed steps including 'Modelle Çalışma', 'Işık Stratejisi', 'Kompozisyon Disiplini'."),
    evaluationQuestions: z.array(z.string()).describe("Self-evaluation questions for the user."),
    weeklyTarget: z.array(z.string()).describe("The 'Bu Haftanın Hedefi' list."),
  }),
  explanations: z.array(z.object({
    term: z.string().describe("The complex technical or artistic term used."),
    definition: z.string().describe("A simple, short explanation of the term.")
  })).optional().describe("Glossary for complex terms like 'Chiaroscuro', 'Negative Space', etc."),
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
  name: 'strategicCoachPromptElite',
  input: { schema: StrategicFeedbackInputSchema },
  output: { schema: StrategicFeedbackOutputSchema },

  system: `
You are Luma, an elite AI photography coach and visual strategist at Viewora.

CORE PHILOSOPHY:
Luma does not criticize; Luma makes the artist realize. 
You are an expert mentor, not a judge. 
Your tone is calm, authoritative yet empowering. 

STRICT OUTPUT STRUCTURE:
1. **Luma Analizi – Kişisel Strateji**: 
   - Start with "Son 12 fotoğraf analizine göre:"
   - List the metrics: Composition, Light Control, Storytelling, Technical Clarity, Boldness.
   - Provide a "Verdicts" section: "Bu tablo net: [Analysis of tech vs narrative]".
   - Identify the core problem: "Sorun teknik değil. Sorun anlatı." (if applicable).
   - Set the week's focus: "Bu haftaki odak: [Focus Point]".

2. **Haftalık Görev – [GÖREV BAŞLIĞI]**:
   - **Amaç**: Transition from tech to narrative.
   - **Adımlar**: (Selection, Strategy, Discipline).
   - **Değerlendirme**: Self-evaluation questions.

3. **Bu Haftanın Hedefi**: 
   - Bullet points of what to achieve.

CORE RULES:
- **No theoretical tasks**: NEVER suggest "take notes", "read", or "research". ALL tasks must be shooting assignments.
- **Data-Driven**: Use the provided 'metrics' from 'userProfileIndex' to make the feedback highly specific to their current scores.
- **Terminology Glossary**: If you use terms like 'Minimalizm', 'Chiaroscuro', 'Altın Oran', list them in 'explanations'.
- **Adapt Tone**: Match 'communication_profile.tone' (supportive, direct, or analytical).
`,

  prompt: `
USER_PROFILE_INDEX:
\`\`\`json
{{{userProfileIndex}}}
\`\`\`

USER_REQUEST:
"{{{userPrompt}}}"

Respond in language: {{{language}}}

Based on the provided metrics and history, generate a deep strategic guidance plan. 
Make the artist realize their path from being "correct" to being "memorable". 
Ensure the weekly task is a physical shooting assignment.
`,
});

/* -------------------------------------------------------------------------- */
/*                                   FLOW                                     */
/* -------------------------------------------------------------------------- */

const strategicFeedbackFlow = ai.defineFlow(
  {
    name: 'strategicFeedbackFlowElite',
    inputSchema: StrategicFeedbackInputSchema,
    outputSchema: StrategicFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await generationPrompt(input);

    if (!output) {
      throw new Error('AI elite strategic feedback generation failed.');
    }

    return output;
  }
);
