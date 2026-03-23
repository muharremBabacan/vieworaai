'use server';

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export type GeneratedAcademyLesson = {
  title: string;
  learningObjective: string;
  theory: string;
  analysisCriteria: string[];
  practiceTask: string;
  auroNote: string;
  imageHint: string;
};

export async function generateAcademyLessons(input: {
  level: string;
  category: string;
  topics: string[];
  language?: string;
  count?: number;
}): Promise<GeneratedAcademyLesson[]> {
  const language = input.language || "tr";
  const count = input.count || 1;

  console.log(`[AI] ${input.level} - ${input.category} için ${count} ders üretiliyor...`);

  const prompt = `
You are Luma, the head instructor of Viewora Academy.

Generate EXACTLY ${count} structured photography mini-lessons for the following curriculum. 
IMPORTANT: If count is 1, return an array with exactly one object.

Level: ${input.level}
Category: ${input.category}

Topics to cover:
${input.topics.map(t => `- ${t}`).join('\n')}

Each lesson must include:
- title: Engaging and professional.
- learningObjective: One sentence (what will they learn?).
- theory: Clear explanation in 2–3 paragraphs.
- analysisCriteria: Exactly 3 technical points.
- practiceTask: A physical photography assignment.
- auroNote: Artistic or professional insight.
- imageHint: Highly specific 3-4 English keywords that represent the UNIQUE TOPIC of this lesson as a photograph. 
  DO NOT use generic "camera lens" or "photography" keywords unless specifically about lenses. 
  INSTEAD, create a scene (e.g., "Golden hour mountain silhouette", "Macro dew drop on green leaf", "Neon city lights blurred motion").

Language: ${language}

Return STRICT JSON as an array of objects matching the schema exactly.
`;

  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = res.text;
    if (!text) throw new Error("Empty response from AI");

    const output: GeneratedAcademyLesson[] = JSON.parse(text);
    console.log(`[AI] ${output.length} ders başarıyla üretildi.`);
    return output;
  } catch (error: any) {
    console.error("[AI] Lesson generation failed:", error);
    throw new Error("Lesson generation failed: " + error.message);
  }
}

export async function generateLessonImage(
  userPrompt: string
): Promise<string> {
  console.log(`[IMAGEN 3] İstek gönderiliyor: ${userPrompt}`);
  
  const finalPrompt = `Professional cinematic photography of ${userPrompt}, ultra-realistic, natural lighting, shot on 35mm lens, f/1.8, high detail, 8k resolution, artistic composition, clean background`;

  try {
    const res = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: finalPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: "16:9"
      }
    });

    const base64Image = res.generatedImages?.[0]?.image?.imageBytes;

    if (!base64Image) {
      console.error("[IMAGEN 3] Görsel verisi boş döndü.");
      throw new Error("Görsel üretilemedi, model boş yanıt döndü.");
    }

    return base64Image;
  } catch (error: any) {
    console.error("[IMAGEN 3] Üretim sırasında hata oluştu:", error.message);
    throw new Error(`Imagen 3 Hatası: ${error.message}`);
  }
}
