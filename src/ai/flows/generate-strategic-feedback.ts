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
  language: z.string(),
  focusArea: z.string().optional(),
});

export type StrategicFeedbackInput = z.infer<
  typeof StrategicFeedbackInputSchema
>;

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
You are a mentor, not a judge.

IMPORTANT RULES:

FOCUS AREA SYSTEM
The variable FOCUS_AREA indicates the weakest development area.

Possible values:

technical_clarity
light
composition
boldness
storytelling

If FOCUS_AREA is technical:
Focus the weekly assignment on improving that technical skill.

If FOCUS_AREA is storytelling:
Create narrative and emotional storytelling assignments.

CRITICAL RULE:

Storytelling should NOT be prioritized if technical skills are weak.

Storytelling tasks can only appear if:

technical_clarity >= 6
light >= 6
composition >= 6

Otherwise focus only on technical growth.

TASK RULES:

All tasks must be real shooting assignments.
Never suggest reading, studying or researching.
All assignments must involve taking photos.

STRUCTURE:

1 Luma Analizi – Kişisel Strateji

Summarize photographer state.

List metrics:

Kompozisyon
Işık Kontrolü
Hikâye/Duygu
Teknik Netlik
Cesur Kadraj

Provide a short verdict.

Define the week's focus.

2 Haftalık Görev

Title

Amaç

Steps

Evaluation questions

3 Bu Haftanın Hedefi

List weekly targets.
`,

  prompt: `
USER_PROFILE_INDEX:

{{{userProfileIndex}}}

FOCUS_AREA:

{{{focusArea}}}

USER_REQUEST:

"{{{userPrompt}}}"

Respond in language: {{{language}}}

Generate a personalized strategic coaching response.
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

    const metrics = input.userProfileIndex.metrics;

    let focusArea = "composition";

    if (metrics) {

      const clarity = metrics.technical_clarity;
      const light = metrics.light;
      const composition = metrics.composition;
      const boldness = metrics.boldness;
      const story = metrics.storytelling;

      /**
       * Technical average
       * storytelling intentionally excluded
       */

      const technicalAvg =
        (clarity + light + composition + boldness) / 4;

      /**
       * Determine weakest technical area
       */

      if (clarity < technicalAvg) {

        focusArea = "technical_clarity";

      } else if (light < technicalAvg) {

        focusArea = "light";

      } else if (composition < technicalAvg) {

        focusArea = "composition";

      } else if (boldness < technicalAvg) {

        focusArea = "boldness";

      }
      /**
       * storytelling becomes active
       * only if technical baseline exists
       */

      else if (
        clarity >= 6 &&
        light >= 6 &&
        composition >= 6
      ) {

        focusArea = "storytelling";

      }

    }

    const enrichedInput = {
      ...input,
      focusArea
    };

    const { output } = await generationPrompt(enrichedInput);

    if (!output) {
      throw new Error('AI elite strategic feedback generation failed.');
    }

    return output;
  }
);