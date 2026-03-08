
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
  technical: z.object({
    composition: number,
    light: number,
    technical_clarity: number,
    boldness: number,
    storytelling: number,
  }).optional(),
  activity_signals: z.object({
    learning_score: number,
    competition_score: number,
    exhibition_score: number,
    group_activity_score: number,
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
  language: z.string(),
  focusArea: z.string().optional(),
});

export type StrategicFeedbackInput = z.infer<typeof StrategicFeedbackInputSchema>;

const StrategicFeedbackOutputSchema = z.object({
  feedback: z.string(),
  actionTask: z.object({
    title: z.string(),
    purpose: z.string(),
    steps: z.array(z.string()),
    evaluationQuestions: z.array(z.string()),
    weeklyTarget: z.array(z.string()),
  }),
  explanations: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    })
  ).optional(),
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
  name: 'strategicCoachPromptElite',
  input: { schema: StrategicFeedbackInputSchema },
  output: { schema: StrategicFeedbackOutputSchema },
  system: `
You are Luma, an elite AI photography coach and visual strategist at Viewora.

CORE PHILOSOPHY:
Luma does not criticize; Luma makes the artist realize.
You are a mentor, not a judge.

INDEX ANALYSIS RULES:
You receive a two-layer profile index:
1. Technical Layer: Raw AI analysis metrics.
2. Activity Signals: Behavioral discipline (Academy, Groups, etc.)

STRATEGY ENGINE:
- If technical metrics are low (< 5), focus on fundamental technical assignments.
- If technical is high (> 7) but activity_signals.competition_score is low, push them to join a competition.
- If activity_signals.group_activity_score is low, suggest a collaborative group task.
- Use the 'tone' and 'explanation_depth' from the communication_profile to shape your language.

TASK RULES:
All tasks must be real shooting assignments. All assignments must involve taking photos.

STRUCTURE:
1. Luma Analysis – Personal Strategy (Tone-aware summary)
2. Weekly Task (Title, Purpose, Steps, Evaluation Questions)
3. This Week's Target (Clear measurable goal)
`,
  prompt: `
USER_PROFILE_INDEX:
{{{userProfileIndex}}}

FOCUS_AREA:
{{{focusArea}}}

USER_REQUEST:
"{{{userPrompt}}}"

Respond in language: {{{language}}}

Generate a personalized strategic coaching response based on both technical skill and behavioral signals.
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
    const technical = input.userProfileIndex.technical;
    let focusArea = "composition";

    if (technical) {
      const { composition, light, technical_clarity, boldness, storytelling } = technical;
      const metrics = [
        { key: 'composition', val: composition },
        { key: 'light', val: light },
        { key: 'technical_clarity', val: technical_clarity },
        { key: 'boldness', val: boldness },
        { key: 'storytelling', val: storytelling }
      ];
      // En düşük teknik alanı bul
      focusArea = metrics.sort((a, b) => a.val - b.val)[0].key;
    }

    const enrichedInput = { ...input, focusArea };
    const { output } = await generationPrompt(enrichedInput);
    if (!output) throw new Error('AI elite strategic feedback generation failed.');
    return output;
  }
);
