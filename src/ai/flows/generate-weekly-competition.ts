'use server';

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export type GenerateCompetitionInput = {
  levelStats: Record<string, number>;
  language: string;
};

export type CompetitionOutput = {
  title: string;
  description: string;
  theme: string;
  prize: string;
  targetLevel: string;
  imageHint: string;
};

export async function generateWeeklyCompetition(
  input: GenerateCompetitionInput
): Promise<CompetitionOutput> {
  const prompt = `
You are Luma, the Creative Director of Viewora. Your job is to design this week's official photography competition.

USER DISTRIBUTION:
${JSON.stringify(input.levelStats, null, 2)}

TASK:
1. Analyze the distribution. If most users are in 'Neuner', create a beginner-friendly but challenging competition. If there's a growing 'Sytner' or 'Omner' group, create something highly technical for them.
2. Choose a theme that is currently trending in the photography world (e.g., cinematic street, high-key portraits, macro nature).
3. The description must be professional, inspiring, and include 3 specific technical tips.
4. The prize should be proportional to the level difficulty.

Language: ${input.language || "tr"}

Return ONLY valid JSON:
{
  "title": "...",
  "description": "...",
  "theme": "...",
  "prize": "...",
  "targetLevel": "...",
  "imageHint": "..."
}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.8,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = res.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);

  } catch (e: any) {
    throw new Error("Weekly Competition generation failed: " + e.message);
  }
}
