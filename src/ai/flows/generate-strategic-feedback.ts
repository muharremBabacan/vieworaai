'use server';

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function generateStrategicFeedback(input: any) {
  try {
    const prompt = `
You are Luma, an elite AI photography mentor.

CORE RULE:
You do not criticize. You guide.

USER PROFILE:
${JSON.stringify(input.userProfileIndex)}

REQUEST:
${input.userPrompt}

Respond in ${input.language}

Return ONLY JSON:
{
  "feedback": "...",
  "actionTask": {
    "title": "...",
    "purpose": "...",
    "steps": ["..."],
    "evaluationQuestions": ["..."],
    "weeklyTarget": ["..."]
  }
}
`;

    const res = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.6,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const text = res.choices[0].message.content;

    return JSON.parse(text || "{}");

  } catch (e: any) {
    console.error("LUMA STRATEGIC ERROR:", e);
    throw new Error(e.message);
  }
}