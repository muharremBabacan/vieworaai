'use server';
/**
 * @fileOverview AI flow for generating structured photography lessons based on a curriculum.
 * 
 * - generateAcademyLessons - Generates 10 structured lessons for a specific category.
 * - generateLessonImage - Server-side image generation for academy lessons.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateAcademyLessonsInputSchema = z.object({
  level: z.enum(['Temel', 'Orta', 'İleri']),
  category: z.string(),
  topics: z.array(z.string()).describe("Specific topics from the curriculum to base the lessons on."),
  language: z.string().default('tr'),
});

export type GenerateAcademyLessonsInput = z.infer<typeof GenerateAcademyLessonsInputSchema>;

const AcademyLessonSchema = z.object({
  title: z.string(),
  learningObjective: z.string(),
  theory: z.string(),
  analysisCriteria: z.array(z.string()).length(3),
  practiceTask: z.string(),
  auroNote: z.string(),
  imageHint: z.string().describe("2-3 English keywords for generating a representative photography image."),
});

const GenerateAcademyLessonsOutputSchema = z.array(AcademyLessonSchema).length(10);

export type GeneratedAcademyLesson = z.infer<typeof AcademyLessonSchema>;

export async function generateAcademyLessons(
  input: GenerateAcademyLessonsInput
): Promise<GeneratedAcademyLesson[]> {
  return academyLessonsFlow(input);
}

/**
 * Generates an image using Imagen model on the server.
 * Returns the base64 data of the generated image.
 */
export async function generateLessonImage(hint: string): Promise<string> {
  const result = await ai.generate({
    model: 'vertexai/imagen-3.0-generate-001',
    prompt: `Professional photography of: ${hint}. Realistic, high resolution, stunning composition.`,
  });

  const base64 = result.media?.data;
  if (!base64) throw new Error("Görsel üretilemedi");
  return base64;
}

const academyLessonsPrompt = ai.definePrompt({
  name: 'academyLessonsGenerator',
  input: { schema: GenerateAcademyLessonsInputSchema },
  output: { schema: AcademyLessonSchema }, // Define single lesson schema for mapping if needed, or stick to array
  prompt: `
You are Luma, the Academic Dean of Viewora Academy. 
Your task is to generate EXACTLY 10 high-quality, professional photography mini-lessons.

CONTEXT:
Level: {{{level}}}
Category: {{{category}}}
Curriculum Topics: 
{{#each topics}}
- {{{this}}}
{{/each}}

INSTRUCTIONS:
1. Create 10 distinct lessons based on the provided topics. 
2. Each lesson must be structured for a mobile learning experience.
3. Tone: Professional, guiding, and encouraging.
4. Language: Respond in {{{language}}}.
5. 'imageHint': Provide exactly 2 English keywords that describe a photo which would perfectly illustrate this lesson's concept.

Structure per lesson:
- title: A catchy and descriptive title.
- learningObjective: What will the student achieve? (1-2 sentences)
- theory: The core concept explained clearly. (2-3 paragraphs)
- analysisCriteria: 3 specific technical criteria Luma AI will use to judge the student's submission.
- practiceTask: A physical shooting assignment for the student.
- auroNote: A tip about the artistic or technical depth of the shot.

Return JSON array of 10 lessons.
`,
});

const academyLessonsFlow = ai.defineFlow(
  {
    name: 'academyLessonsFlow',
    inputSchema: GenerateAcademyLessonsInputSchema,
    outputSchema: GenerateAcademyLessonsOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: academyLessonsPrompt(input),
      output: { schema: GenerateAcademyLessonsOutputSchema }
    });
    
    if (!output) throw new Error('AI lesson generation failed.');
    return output;
  }
);
