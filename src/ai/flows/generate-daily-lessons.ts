'use server';
/**
 * @fileOverview AI flow for generating daily photography lessons.
 *
 * This file defines a Genkit flow that connects to a Google AI model
 * to generate a set of five photography lessons based on a detailed prompt.
 * The flow is designed to be triggered, for instance, by an admin action,
 * to populate the Viewora Academy with fresh, dynamic content.
 *
 * - generateDailyLessons: The main exported function that initiates the lesson generation flow.
 * - GeneratedLesson: The TypeScript type definition for a single lesson object returned by the AI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single generated lesson, based on the user's prompt format.
// This ensures the AI's output is structured and type-safe.
const GeneratedLessonSchema = z.object({
  category: z.string().describe("The category of the lesson (e.g., 'Portre', 'Manzara', 'Sokak Fotoğrafçılığı', 'Teknik')."),
  title: z.string().describe('The title of the lesson.'),
  learningObjective: z.string().describe("What skill the user will gain (composition, ISO, lighting, etc.)."),
  theory: z.string().describe("Explain the topic in its simplest form, in 3-4 friendly sentences."),
  analysisCriteria: z.array(z.string()).length(3).describe("List 3 technical criteria for a photo to be considered 'successful' according to this lesson."),
  practiceTask: z.string().describe("Give the user a specific shooting task."),
  auroNote: z.string().describe("Explain why this analysis will give the user a professional perspective."),
  imageHint: z.string().describe("Provide 1-2 English keywords for finding a suitable image for this lesson (e.g., 'portrait lighting', 'landscape composition').")
});

// The final output of the flow is an array of lesson objects.
const GenerateLessonsOutputSchema = z.array(GeneratedLessonSchema);
export type GeneratedLesson = z.infer<typeof GeneratedLessonSchema>;

/**
 * The main function to be called from the application to trigger the lesson generation process.
 * It invokes the Genkit flow and returns a promise that resolves to an array of generated lessons.
 */
export async function generateDailyLessons(): Promise<GeneratedLesson[]> {
    return generateLessonsFlow();
}

// Define the prompt for the AI model, specifying the desired output schema.
const generationPrompt = ai.definePrompt({
    name: 'dailyLessonsPrompt',
    output: { schema: GenerateLessonsOutputSchema },
    prompt: `You are the head instructor of Viewora AI Coach. Prepare a professional training module for the Beşiktaş Public Education Center (BHEM) project.

Your task is to generate FIVE (5) distinct and diverse photography mini-lessons. The topics should be varied, covering different aspects of photography like composition, lighting, technique, and different genres (portrait, landscape, street, etc.).

For each lesson, strictly follow this JSON format and provide the content in Turkish:

{
  "category": "A relevant category for the lesson (e.g., 'Portre', 'Manzara', 'Sokak Fotoğrafçılığı', 'Teknik').",
  "title": "A compelling title for the lesson.",
  "learningObjective": "A concise learning objective explaining the skill the user will gain.",
  "theory": "The main educational content. Explain the topic simply in 3-4 solution-oriented sentences.",
  "analysisCriteria": [
    "A technical criterion for success.",
    "A second technical criterion for success.",
    "A third technical criterion for success."
  ],
  "practiceTask": "A specific, actionable shooting task for the user (e.g., 'Now take a selfie with the sun behind you and upload it for analysis').",
  "auroNote": "The 'Auro Note'. Explain why this specific analysis will provide a professional perspective to the user.",
  "imageHint": "Provide 1-2 English keywords for finding a suitable image for this lesson (e.g., 'portrait lighting', 'landscape composition')."
}

Ensure the output is a valid JSON array containing exactly five lesson objects.
`,
});

// Define the Genkit flow that orchestrates the AI call.
const generateLessonsFlow = ai.defineFlow(
    {
        name: 'generateLessonsFlow',
        outputSchema: GenerateLessonsOutputSchema,
    },
    async () => {
        // Execute the prompt and await the structured output.
        const { output } = await generationPrompt();
        // Return the generated lessons, or an empty array if the output is null.
        return output || [];
    }
);
