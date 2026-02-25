'use server';
/**
 * @fileOverview AI flow for generating strategic weekly photography competitions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateCompetitionInputSchema = z.object({
  levelStats: z.record(z.string(), z.number()).describe("Map of level names to user counts."),
  language: z.string().default("tr"),
});

export type GenerateCompetitionInput = z.infer<typeof GenerateCompetitionInputSchema>;

const CompetitionOutputSchema = z.object({
  title: z.string().describe("A catchy and professional competition title."),
  description: z.string().describe("Detailed rules and creative direction for the competition."),
  theme: z.string().describe("The core technical or artistic theme (e.g., 'Minimalism', 'Night Portrait')."),
  prize: z.string().describe("A motivating prize (e.g., '250 Auro + Featured Profile')."),
  targetLevel: z.string().describe("The most suitable level based on stats (Neuner, Viewner, Sytner, Omner, Vexer)."),
  imageHint: z.string().describe("2-3 English keywords for a photography style image."),
});

export type CompetitionOutput = z.infer<typeof CompetitionOutputSchema>;

export async function generateWeeklyCompetition(
  input: GenerateCompetitionInput
): Promise<CompetitionOutput> {
  return competitionFlow(input);
}

const competitionPrompt = ai.definePrompt({
  name: 'generateWeeklyCompetitionPrompt',
  input: { schema: GenerateCompetitionInputSchema },
  output: { schema: CompetitionOutputSchema },
  prompt: `
You are Luma, the Creative Director of Viewora. Your job is to design this week's official photography competition.

USER DISTRIBUTION:
{{{levelStats}}}

TASK:
1. Analyze the distribution. If most users are in 'Neuner', create a beginner-friendly but challenging competition. If there's a growing 'Sytner' or 'Omner' group, create something highly technical for them.
2. Choose a theme that is currently trending in the photography world (e.g., cinematic street, high-key portraits, macro nature).
3. The description must be professional, inspiring, and include 3 specific technical tips.
4. The prize should be proportional to the level difficulty.

Return ONLY JSON. Language: {{{language}}}
`,
});

const competitionFlow = ai.defineFlow(
  {
    name: 'generateWeeklyCompetitionFlow',
    inputSchema: GenerateCompetitionInputSchema,
    outputSchema: CompetitionOutputSchema,
  },
  async (input) => {
    const { output } = await competitionPrompt(input);
    if (!output) throw new Error('AI competition generation failed.');
    return output;
  }
);
