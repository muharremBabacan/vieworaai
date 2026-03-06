'use server';
/**
 * @fileOverview AI flow for generating structured photography lessons for Viewora Academy.
 * This flow is a pure generator and does not interact with Firebase directly.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

/* ================= INPUT ================= */

const InputSchema = z.object({
  level: z.string(),
  category: z.string(),
  topics: z.array(z.string()),
  language: z.string().default('tr')
});

/* ================= LESSON SCHEMA ================= */

const LessonSchema = z.object({
  title: z.string(),
  learningObjective: z.string(),
  theory: z.string(),
  analysisCriteria: z.array(z.string()).length(3),
  practiceTask: z.string(),
  auroNote: z.string(),
  imageHint: z.string()
});

const OutputSchema = z.array(LessonSchema).length(10);

export type GeneratedAcademyLesson = z.infer<typeof LessonSchema>;

/* ================= PROMPT ================= */

const lessonPrompt = ai.definePrompt({
  name: "academy-lessons-generator",
  input: { schema: InputSchema },
  output: { schema: OutputSchema },

  prompt: `
You are Luma, the head instructor of Viewora Academy.

Generate EXACTLY 10 photography mini lessons.

Level: {{{level}}}
Category: {{{category}}}

Topics to cover:
{{#each topics}}
- {{{this}}}
{{/each}}

Each lesson must include:
- title: Engaging and professional
- learningObjective: What will they learn? (1 sentence)
- theory: Clear, concise explanation (2-3 paragraphs)
- analysisCriteria: 3 specific technical points to look for in a photo
- practiceTask: A physical shooting assignment
- auroNote: A tip about why this matters artistically
- imageHint: 3-4 English keywords for generating a cover image (e.g. "portrait golden hour bokeh")

Respond in language: {{{language}}}
Return as a JSON array.
`
});

/* ================= MAIN FLOW ================= */

export async function generateAcademyLessons(input: z.infer<typeof InputSchema>): Promise<GeneratedAcademyLesson[]> {
  return academyLessonsFlow(input);
}

const academyLessonsFlow = ai.defineFlow(
  {
    name: 'academyLessonsFlow',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    const { output } = await lessonPrompt(input);
    if (!output) {
      throw new Error("Lesson generation failed");
    }
    return output;
  }
);

/* ================= IMAGE GENERATION ================= */

/**
 * Generates a base64 image string for a given hint.
 */
export async function generateLessonImage(imageHint: string): Promise<string> {
  const result = await ai.generate({
    model: "vertexai/imagen-3.0-generate-001",
    prompt: `Professional high-quality photography showing: ${imageHint}. Realistic, cinematic lighting, sharp focus.`,
  });

  const base64 = result.media?.data;
  if (!base64) {
    throw new Error("Image generation failed");
  }

  return base64;
}
