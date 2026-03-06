
'use server';
/**
 * @fileOverview Viewora Academy Lesson Generator.
 * 
 * - generateAcademyLessons - Generates 10 structured photography lessons based on a category.
 * - generateLessonImage - Generates a professional cover image for a lesson.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

/* ================= INPUT SCHEMA ================= */

const GenerateAcademyLessonsInputSchema = z.object({
  level: z.string(),
  category: z.string(),
  topics: z.array(z.string()),
  language: z.string().default("tr")
});

export type GenerateAcademyLessonsInput = z.infer<
  typeof GenerateAcademyLessonsInputSchema
>;

/* ================= OUTPUT SCHEMA ================= */

const LessonSchema = z.object({
  title: z.string(),
  learningObjective: z.string(),
  theory: z.string(),
  analysisCriteria: z.array(z.string()).length(3),
  practiceTask: z.string(),
  auroNote: z.string(),
  imageHint: z.string()
});

const GenerateAcademyLessonsOutputSchema = z.array(LessonSchema).length(10);

export type GeneratedAcademyLesson = z.infer<typeof LessonSchema>;

/* ================= PROMPTS ================= */

const academyLessonsPrompt = ai.definePrompt({
  name: "generate-academy-lessons-prompt",
  input: { schema: GenerateAcademyLessonsInputSchema },
  output: { schema: GenerateAcademyLessonsOutputSchema },
  prompt: `You are Luma, the Academic Dean of Viewora Academy.

Generate EXACTLY 10 high-quality photography mini-lessons for the following:

Level: {{{level}}}
Category: {{{category}}}

Core Topics to Cover:
{{#each topics}}
- {{{this}}}
{{/each}}

Rules:
- Each lesson must be unique and focused on a specific sub-topic.
- Language: {{{language}}} (usually Turkish).
- imageHint must contain exactly 2-3 English keywords describing the visual concept.
- Theory should be educational and professional (2-3 paragraphs).
- auroNote should mention how this specific skill helps the user save Pix or earn more rewards.

Return ONLY a JSON array of 10 objects.`
});

/* ================= FLOWS ================= */

export const generateAcademyLessonsFlow = ai.defineFlow(
  {
    name: "generateAcademyLessonsFlow",
    inputSchema: GenerateAcademyLessonsInputSchema,
    outputSchema: GenerateAcademyLessonsOutputSchema
  },
  async (input) => {
    const { output } = await academyLessonsPrompt(input);
    if (!output) {
      throw new Error("AI lesson generation failed.");
    }
    return output;
  }
);

/* ================= SERVER ACTIONS ================= */

/**
 * Generates 10 lesson drafts for the admin to preview.
 */
export async function generateAcademyLessons(input: GenerateAcademyLessonsInput) {
  return generateAcademyLessonsFlow(input);
}

/**
 * Generates a professional photography image (base64) using Imagen 3.
 */
export async function generateLessonImage(imageHint: string): Promise<string> {
  const result = await ai.generate({
    model: "vertexai/imagen-3.0-generate-001",
    prompt: `A high-quality, professional photography shot demonstrating ${imageHint}. Cinematic lighting, clear focus, 8k resolution, realistic style.`,
  });

  const base64 = result.media?.data;
  if (!base64) {
    throw new Error("Image generation failed");
  }
  return base64;
}
