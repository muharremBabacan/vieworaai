'use server';
/**
 * Viewora Academy AI Content Engine
 * Model: Google Imagen 3.0 (imagen-3.0-generate-001)
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

/* ================= INPUT SCHEMA ================= */

const InputSchema = z.object({
  level: z.string(),
  category: z.string(),
  topics: z.array(z.string()),
  language: z.string().default("tr"),
  count: z.number().default(1),
});

/* ================= LESSON SCHEMA ================= */

const LessonSchema = z.object({
  title: z.string(),
  learningObjective: z.string(),
  theory: z.string(),
  analysisCriteria: z.array(z.string()).length(3),
  practiceTask: z.string(),
  auroNote: z.string(),
  imageHint: z.string(),
});

const OutputSchema = z.array(LessonSchema); 

export type GeneratedAcademyLesson = z.infer<typeof LessonSchema>;

/* ================= LESSON GENERATION FLOW ================= */

export async function generateAcademyLessons(
  input: z.infer<typeof InputSchema>
): Promise<GeneratedAcademyLesson[]> {
  console.log(`[AI] ${input.level} - ${input.category} için ${input.count} ders üretiliyor...`);
  // Explicitly tell the model to return an array of exactly X items
  const { output } = await lessonPrompt(input);
  if (!output) throw new Error("Lesson generation failed");
  console.log(`[AI] ${output.length} ders başarıyla üretildi.`);
  return output;
}

const lessonPrompt = ai.definePrompt({
  name: "academy-lessons-generator",
  input: { schema: InputSchema },
  output: { schema: OutputSchema },

  prompt: `
You are Luma, the head instructor of Viewora Academy.

Generate EXACTLY {{{count}}} structured photography mini-lessons for the following curriculum. 
IMPORTANT: If count is 1, return an array with exactly one object.

Level: {{{level}}}
Category: {{{category}}}

Topics to cover:
{{#each topics}}
- {{{this}}}
{{/each}}

Each lesson must include:
- title: Engaging and professional.
- learningObjective: One sentence (what will they learn?).
- theory: Clear explanation in 2–3 paragraphs.
- analysisCriteria: Exactly 3 technical points.
- practiceTask: A physical photography assignment.
- auroNote: Artistic or professional insight.
- imageHint: 2-3 English keywords for a cover image. (This will be used as a prompt for Imagen 3)

Language: {{{language}}}
`,
});

/* ================= IMAGE GENERATION ENGINE (IMAGEN 3.0) ================= */

export async function generateLessonImage(
  userPrompt: string
): Promise<string> {
  console.log(`[IMAGEN 3.0] İstek gönderiliyor: ${userPrompt}`);
  
  const finalPrompt = `Professional photograph of ${userPrompt}, natural lighting, realistic photography, 8k resolution, high quality, commercial photography style, clean composition`;

  try {
    const result = await ai.generate({
      model: "vertexai/imagen-3.0-generate-001",
      prompt: finalPrompt,
    });

    const mediaUrl = result.media?.url;

    if (!mediaUrl) {
      console.error("[IMAGEN 3.0] Görsel verisi boş döndü.");
      throw new Error("Görsel üretilemedi, model boş yanıt döndü.");
    }

    const dataSizeKb = Math.round(mediaUrl.length / 1024);
    console.log(`[IMAGEN 3.0] Görsel başarıyla üretildi. Veri Boyutu: ${dataSizeKb} KB`);

    if (mediaUrl.includes('base64,')) {
      return mediaUrl.split('base64,')[1];
    }

    return mediaUrl;
  } catch (error: any) {
    console.error("[IMAGEN 3.0] Üretim sırasında hata oluştu:", error.message);
    throw new Error(`Imagen 3.0 Hatası: ${error.message}`);
  }
}
