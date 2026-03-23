'use server';

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Tier = "start" | "pro" | "master";

export type PhotoAnalysisInput = {
  photoUrl: string;
  language: string;
  tier: Tier;
};

export type PhotoAnalysisOutput = {
  genre: string;
  scene: string;
  dominant_subject: string;
  light_score: number;
  composition_score: number;
  technical_clarity_score: number;
  tags: string[];
  short_neutral_analysis: string;
};

export async function generatePhotoAnalysis(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisOutput> {

  const prompt = `
You are Luma, Viewora's professional photography analysis AI.

TASK:
Analyze the image professionally. Be precise, constructive and encouraging.

RULES:
- Score between 0 and 10
- Max 4 tags
- Keep explanation concise but insightful

Respond in ${input.language}

Return ONLY valid JSON:
{
  "genre": "...",
  "scene": "...",
  "dominant_subject": "...",
  "light_score": 0,
  "composition_score": 0,
  "technical_clarity_score": 0,
  "tags": ["...", "..."],
  "short_neutral_analysis": "..."
}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: input.photoUrl,
              },
            },
          ],
        },
      ],
    });

    const raw = res.choices[0]?.message?.content || "";

    // 🔥 JSON güvenli parse
    const clean = raw.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(clean);

    // 🔥 güvenlik fallback
    return {
      genre: parsed.genre || "",
      scene: parsed.scene || "",
      dominant_subject: parsed.dominant_subject || "",
      light_score: Number(parsed.light_score) || 0,
      composition_score: Number(parsed.composition_score) || 0,
      technical_clarity_score: Number(parsed.technical_clarity_score) || 0,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [],
      short_neutral_analysis: parsed.short_neutral_analysis || "",
    };

  } catch (e: any) {
    throw new Error("AI analysis failed: " + e.message);
  }
}