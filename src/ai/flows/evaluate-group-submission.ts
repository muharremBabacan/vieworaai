'use server';

import OpenAI from "openai";
import { PhotoAnalysis } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export type EvaluateGroupSubmissionInput = {
  photoUrl: string;
  assignmentTitle: string;
  assignmentDescription: string;
  language: string;
};

export type EvaluateGroupSubmissionOutput = {
  analysis: PhotoAnalysis;
  evaluation: {
    isSuccess: boolean;
    feedback: string;
    score: number;
    technicalPoints: string[];
  };
};

export async function evaluateGroupSubmission(
  input: EvaluateGroupSubmissionInput
): Promise<EvaluateGroupSubmissionOutput> {
  const langMap: Record<string, string> = {
    tr: "Turkish",
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    ru: "Russian",
    ar: "Arabic",
    zh: "Chinese",
    ja: "Japanese"
  };
  const fullLanguage = langMap[input.language] || input.language;

  const prompt = `
You are Luma, Viewora's professional photography instructor and competition director.
Your task is to evaluate a student's photo submission for a SPECIFIC GROUP ASSIGNMENT or COMPETITION.

TITLE: "${input.assignmentTitle}"
OBJECTIVE/THEME: "${input.assignmentDescription}"

UNIFIED ANALYSIS & EVALUATION TASK:
1. Provide a standard technical analysis (PhotoAnalysis).
2. Provide a rigorous thematic evaluation against the assignment/competition goals.

RULES:
- Be precise, constructive, and encouraging.
- If this is a competition entry, be more rigorous in your thematic check.
- TECHNICAL COMPATIBILITY (CRITICAL): Does the photo strictly respect the theme of the assignment or competition?

Respond ONLY in the following language: ${fullLanguage}

Return ONLY valid JSON with this structure:
{
  "analysis": {
    "genre": "...",
    "scene": "...",
    "dominant_subject": "...",
    "light_score": 0,
    "composition_score": 0,
    "technical_clarity_score": 0,
    "tags": ["...", "..."],
    "short_neutral_analysis": "..."
  },
  "evaluation": {
    "isSuccess": true,
    "feedback": "...",
    "score": 0,
    "technicalPoints": ["point 1", "point 2", "point 3"]
  }
}

Analyze the photo:
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
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
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      analysis: {
        genre: parsed.analysis?.genre || "",
        scene: parsed.analysis?.scene || "",
        dominant_subject: parsed.analysis?.dominant_subject || "",
        light_score: Number(parsed.analysis?.light_score) || 0,
        composition_score: Number(parsed.analysis?.composition_score) || 0,
        technical_clarity_score: Number(parsed.analysis?.technical_clarity_score) || 0,
        tags: Array.isArray(parsed.analysis?.tags) ? parsed.analysis.tags.slice(0, 4) : [],
        short_neutral_analysis: parsed.analysis?.short_neutral_analysis || "",
      },
      evaluation: {
        isSuccess: parsed.evaluation?.isSuccess ?? false,
        feedback: parsed.evaluation?.feedback || "",
        score: Number(parsed.evaluation?.score) || 0,
        technicalPoints: Array.isArray(parsed.evaluation?.technicalPoints) ? parsed.evaluation.technicalPoints.slice(0, 3) : [],
      }
    };

  } catch (e: any) {
    throw new Error("UI Analysis & Evaluation failed: " + e.message);
  }
}
