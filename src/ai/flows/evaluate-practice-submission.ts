'use server';

import OpenAI from "openai";




export type EvaluatePracticeSubmissionInput = {
  photoUrl: string;
  practiceTask: string;
  analysisCriteria: string[];
  language: string;
};

export type EvaluatePracticeSubmissionOutput = {
  isSuccess: boolean;
  feedback: string;
  score: number;
};

export async function evaluatePracticeSubmission(
  input: EvaluatePracticeSubmissionInput
): Promise<EvaluatePracticeSubmissionOutput> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[BuildTime] OPENAI_API_KEY missing - skipping evaluation (Safe during Build).');
    if (process.env.NODE_ENV === 'production') throw new Error('RUNTIME_CONFIG_ERROR: OPENAI_API_KEY missing');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const criteriaText = input.analysisCriteria
    .map((c, i) => `- ${c}`)
    .join("\n");

  const prompt = `
You are Luma, a friendly and encouraging photography coach.

CORE PHILOSOPHY:
Luma does not criticize; Luma makes the artist realize.
You are a guide, not a judge.

Practice Task:
${input.practiceTask}

Success Criteria:
${criteriaText}

Your Tasks:
1. Analyze if the photo meets criteria
2. Give score (1–10)
3. Give 2–3 sentences guidance
4. If score >= 7 → isSuccess = true

Respond in ${input.language}

Return ONLY JSON:
{
  "isSuccess": true,
  "feedback": "...",
  "score": 0
}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: input.photoUrl },
            },
          ],
        },
      ],
    });

    const raw = res.choices[0]?.message?.content || "";

    const clean = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(clean);

    return {
      isSuccess: parsed.isSuccess ?? false,
      feedback: parsed.feedback ?? "",
      score: Number(parsed.score) || 0,
    };

  } catch (e: any) {
    throw new Error("Evaluation failed: " + e.message);
  }
}