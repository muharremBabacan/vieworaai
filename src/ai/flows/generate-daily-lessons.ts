'use server';
/**
 * AI flow for generating structured photography lessons for Viewora Academy
 * and automatically saving them to Firestore with generated images.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import { db } from '@/lib/firebase';
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp
} from 'firebase/firestore';

import { generateLessonImages } from '@/ai/flows/generateLessonImages';

/* -------------------------------------------------------------------------- */
/*                               INPUT SCHEMA                                 */
/* -------------------------------------------------------------------------- */

const GenerateLessonsInputSchema = z.object({
  level: z.enum(['Temel', 'Orta', 'İleri']),
  category: z.string().optional(),
  language: z.string(),
});

export type GenerateLessonsInput = z.infer<typeof GenerateLessonsInputSchema>;

/* -------------------------------------------------------------------------- */
/*                               OUTPUT SCHEMA                                */
/* -------------------------------------------------------------------------- */

const GeneratedLessonSchema = z.object({
  level: z.enum(['Temel', 'Orta', 'İleri']),
  category: z.string(),
  title: z.string(),
  learningObjective: z.string(),
  theory: z.string(),
  analysisCriteria: z.array(z.string()).length(3),
  practiceTask: z.string(),
  authorNote: z.string(),
  imageHint: z.string(),
  tags: z.array(z.string()).optional(),

  imagePrompts: z.object({
    cover: z.string(),
    goodExample1: z.string(),
    goodExample2: z.string(),
    badExample: z.string(),
    analysis: z.string(),
  }),
});

const GenerateLessonsOutputSchema = z.array(GeneratedLessonSchema);

export type GeneratedLesson = z.infer<typeof GeneratedLessonSchema>;

/* -------------------------------------------------------------------------- */
/*                                MAIN EXPORT                                 */
/* -------------------------------------------------------------------------- */

export async function generateDailyLessons(
  input: GenerateLessonsInput
): Promise<GeneratedLesson[]> {
  return generateLessonsFlow(input);
}

/* -------------------------------------------------------------------------- */
/*                                  PROMPT                                    */
/* -------------------------------------------------------------------------- */

const generationPrompt = ai.definePrompt({
  name: 'structuredCurriculumPromptV3',
  input: { schema: GenerateLessonsInputSchema },
  output: { schema: GenerateLessonsOutputSchema },

  prompt: `
You are Luma, the Head Instructor of Viewora.

Generate EXACTLY FIVE (5) photography mini-lessons.

Return JSON only.

Structure:

{
 "level": "...",
 "category": "...",
 "title": "...",
 "learningObjective": "...",
 "theory": "...",
 "analysisCriteria": ["...", "...", "..."],
 "practiceTask": "...",
 "authorNote": "...",
 "imageHint": "two keyword phrase",
 "tags": ["photography","composition"],

 "imagePrompts": {
   "cover": "...",
   "goodExample1": "...",
   "goodExample2": "...",
   "badExample": "...",
   "analysis": "..."
 }
}

Image prompt rules:
- English prompts
- Real photography scene
- Include lighting, lens or environment
`,
});

/* -------------------------------------------------------------------------- */
/*                           FIRESTORE SAVE FUNCTION                          */
/* -------------------------------------------------------------------------- */

async function saveLessonsToFirestore(lessons: any[]) {

  const batch = writeBatch(db);
  const lessonCollection = collection(db, 'academy_lessons');

  lessons.forEach((lesson) => {

    const lessonRef = doc(lessonCollection);

    batch.set(lessonRef, {
      ...lesson,

      is_free: true,
      token_cost: 0,

      createdAt: serverTimestamp(),
    });

  });

  await batch.commit();
}

/* -------------------------------------------------------------------------- */
/*                                   FLOW                                     */
/* -------------------------------------------------------------------------- */

const generateLessonsFlow = ai.defineFlow(
  {
    name: 'generateLessonsFlowV3',
    inputSchema: GenerateLessonsInputSchema,
    outputSchema: GenerateLessonsOutputSchema,
  },

  async (input) => {

    const { output } = await generationPrompt(input);

    if (!output) {
      throw new Error('AI lesson generation failed.');
    }

    const lessonsWithImages = [];

    for (const lesson of output) {

      const lessonId = crypto.randomUUID();

      const images = await generateLessonImages(
        lesson.imagePrompts,
        lessonId
      );

      lessonsWithImages.push({
        ...lesson,
        images,
      });
    }

    await saveLessonsToFirestore(lessonsWithImages);

    return lessonsWithImages;
  }
);