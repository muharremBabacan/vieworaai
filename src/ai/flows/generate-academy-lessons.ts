'use server';
/**
 * Viewora Academy AI Lesson Generator
 * Generates structured photography lessons and image prompts.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

/* ================= INPUT ================= */

const InputSchema = z.object({
  level: z.string(),
  category: z.string(),
  topics: z.array(z.string()),
  language: z.string().default("tr"),
});

/* ================= LESSON STRUCTURE ================= */

const LessonSchema = z.object({
  title: z.string(),
  learningObjective: z.string(),
  theory: z.string(),
  analysisCriteria: z.array(z.string()).length(3),
  practiceTask: z.string(),
  auroNote: z.string(),
  imageHint: z.string(),
});

const OutputSchema = z.array(LessonSchema).length(1);

export type GeneratedAcademyLesson = z.infer<typeof LessonSchema>;

/* ================= PROMPT ================= */

const lessonPrompt = ai.definePrompt({
  name: "academy-lessons-generator",
  input: { schema: InputSchema },
  output: { schema: OutputSchema },

  prompt: `
You are Luma, the head instructor of Viewora Academy.

Generate EXACTLY 1 structured photography mini-lessons.

Level: {{{level}}}
Category: {{{category}}}

Topics to cover:
{{#each topics}}
- {{{this}}}
{{/each}}

Each lesson must include:

title:
Engaging and professional lesson title.

learningObjective:
One sentence explaining what the student will learn.

theory:
Clear explanation of the concept in 2–3 paragraphs.

analysisCriteria:
Exactly 3 specific technical points to evaluate a photo.

practiceTask:
A real-world photography assignment for the student.

auroNote:
A short artistic or professional insight about why this concept matters.

imageHint:
2–3 English keywords describing a photography scene suitable for a cover image.
Example: "portrait golden hour"

Language: {{{language}}}

Return ONLY a JSON array containing exactly 1 lessons.
`,
});

/* ================= FLOW ================= */

export async function generateAcademyLessons(
  input: z.infer<typeof InputSchema>
): Promise<GeneratedAcademyLesson[]> {
  const { output } = await lessonPrompt(input);

  if (!output) {
    throw new Error("Lesson generation failed");
  }

  return output;
}

/* ================= IMAGE GENERATION ================= */

/**
 * Generates a base64 encoded cover image for a lesson.
 */
export async function generateLessonImage(
  imageHint: string
): Promise<string> {

  const result = await ai.generate({
    model: "vertexai/imagen-3.0-generate-001",

    prompt: `
Professional DSLR photograph of ${imageHint},
natural lighting,
shallow depth of field,
realistic photography,
8k ultra realistic
`
  });

  const base64 = result.media?.data;

  if (!base64) {
    throw new Error("Image generation failed");
  }

  return base64;
}