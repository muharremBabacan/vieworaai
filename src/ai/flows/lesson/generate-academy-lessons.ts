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

const OutputSchema = z.array(LessonSchema).length(10); 

export type GeneratedAcademyLesson = z.infer<typeof LessonSchema>;

/* ================= LESSON GENERATION FLOW ================= */

export async function generateAcademyLessons(
  input: z.infer<typeof InputSchema>
): Promise<GeneratedAcademyLesson[]> {
  const { output } = await lessonPrompt(input);
  if (!output) throw new Error("Lesson generation failed");
  return output;
}

const lessonPrompt = ai.definePrompt({
  name: "academy-lessons-generator",
  input: { schema: InputSchema },
  output: { schema: OutputSchema },

  prompt: `
You are Luma, the head instructor of Viewora Academy.

Generate EXACTLY 10 structured photography mini-lessons for the following curriculum:

Level: {{{level}}}
Category: {{{category}}}

Topics to cover (Use these as reference for the 10 lessons):
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
- imageHint: 2-3 English keywords for a cover image.

Language: {{{language}}}
`,
});

/* ================= IMAGE GENERATION ENGINE (IMAGEN 3.0) ================= */

export async function generateLessonImage(
  userPrompt: string
): Promise<string> {
  const finalPrompt = `Professional photograph of ${userPrompt}, natural lighting, realistic photography, 8k resolution`;

  const result = await ai.generate({
    model: "vertexai/imagen-3.0-generate-001",
    prompt: finalPrompt,
  });

  const base64 = result.media?.data;
  if (!base64) throw new Error("Imagen 3.0 image generation failed.");
  return base64;
}
