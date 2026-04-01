'use server';

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export type AdaptiveInput = {
  language: string;
  userLevel: string;
  genre: string;
  scene: string;
  dominant_subject: string;
  tags: string[];
  technical: {
    light_score: number;
    composition_score: number;
    technical_clarity_score: number;
    storytelling_score?: number;
    boldness_score?: number;
  };
};

export async function generateAdaptiveFeedback(input: AdaptiveInput) {
  const prompt = `
You are Luma, Viewora's visual mentor.
Use the scene, subject, and tags to understand the image context.

GENRE: ${input.genre}
SCENE: ${input.scene}
SUBJECT: ${input.dominant_subject}

TAGS:
${input.tags.map(t => `- ${t}`).join("\n")}

TECHNICAL DATA:
Light: ${input.technical.light_score}
Composition: ${input.technical.composition_score}
Clarity: ${input.technical.technical_clarity_score}
Storytelling: ${input.technical.storytelling_score || 0}
Boldness: ${input.technical.boldness_score || 0}

Structure feedback:
- Işık
- Kompozisyon
- Teknik

Never invent themes unrelated to tags.
Respond in ${input.language}.

Return ONLY valid JSON:
{
  "feedback": "..."
}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = res.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);

  } catch (e: any) {
    throw new Error("Luma adaptive feedback failed: " + e.message);
  }
}