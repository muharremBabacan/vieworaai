'use server';
/**
 * AI flow for generating structured photography lessons for Viewora Academy.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/* -------------------------------------------------------------------------- */
/*                               INPUT SCHEMA                                 */
/* -------------------------------------------------------------------------- */

const GenerateLessonsInputSchema = z.object({
  level: z.enum(['Temel', 'Orta', 'İleri']),
  category: z
    .string()
    .optional()
    .describe(
      "Specific curriculum category. If not provided, lessons must be diverse within the selected level."
    ),
  language: z
    .string()
    .describe('Language code for the output (e.g., "tr", "en").'),
});

export type GenerateLessonsInput = z.infer<
  typeof GenerateLessonsInputSchema
>;

/* -------------------------------------------------------------------------- */
/*                               OUTPUT SCHEMA                                */
/* -------------------------------------------------------------------------- */

const GeneratedLessonSchema = z.object({
  level: z
    .enum(['Temel', 'Orta', 'İleri'])
    .describe("Must match requested level exactly."),
  category: z
    .string()
    .describe("Specific curriculum category name."),
  title: z
    .string()
    .describe("Specific and technical subtopic title."),
  learningObjective: z
    .string()
    .describe("Clear and measurable skill outcome."),
  theory: z
    .string()
    .describe(
      "3–4 practical sentences including at least one concrete technical reference (camera settings, lens focal length, lighting direction, etc.)."
    ),
  analysisCriteria: z
    .array(z.string())
    .length(3)
    .describe(
      "Three measurable technical criteria for evaluating photo success."
    ),
  practiceTask: z
    .string()
    .describe("Clear and actionable shooting assignment."),
  auroNote: z
    .string()
    .describe(
      "Explain how this analysis provides a professional-level perspective."
    ),
  imageHint: z
    .string()
    .describe(
      "Exactly 2 concrete, searchable English photography keywords. No abstract terms. No sentences."
    ),
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
  name: 'structuredCurriculumPromptV2',
  input: { schema: GenerateLessonsInputSchema },
  output: { schema: GenerateLessonsOutputSchema },
  prompt: `
You are Luma, the Head Instructor of Viewora.

Generate EXACTLY FIVE (5) distinct mini-lessons in {{{language}}}
for the **{{{level}}}** level based strictly on the curriculum below.

{{#if category}}
IMPORTANT: All five lessons MUST belong to the '{{{category}}}' category.
{{else}}
The five lessons must be diverse and cover DIFFERENT categories within the selected level.
{{/if}}

CRITICAL RULES:
- All five lessons must cover DIFFERENT subtopics.
- No repetition of techniques.
- No overlapping concepts.
- Avoid generic or motivational filler language.
- Include at least ONE concrete technical reference in the theory 
  (camera setting, aperture value, shutter speed, ISO, lens focal length, lighting direction, etc.).

LEVEL BEHAVIOR:
- 'Temel': Simple explanations but still include one technical reference.
- 'Orta': Include situational comparison or decision-making insight.
- 'İleri': Include professional workflow, commercial value, or advanced execution insight.

CURRICULUM:

TEMEL:
- Fotoğrafçılığa Giriş
- Pozlama Temelleri
- Netlik ve Odaklama
- Temel Kompozisyon
- Işık Bilgisi

ORTA:
- Tür Bazlı Çekim Teknikleri
- İleri Pozlama Teknikleri
- Işık Yönetimi
- Görsel Hikâye Anlatımı
- Post-Prodüksiyon Temelleri

İLERİ:
- Uzmanlık Alanı Derinleşme
- Profesyonel Işık Kurulumu
- Gelişmiş Teknikler
- Sanatsal Kimlik ve Stil
- Ticari ve Marka Konumlandırma

STRICT OUTPUT RULES:
- Return ONLY valid JSON.
- Do NOT include markdown.
- Do NOT wrap in code blocks.
- Output must be a JSON array containing EXACTLY five lesson objects.

Each object must follow this structure:

{
  "level": "Must match {{{level}}}",
  "category": "Specific curriculum category",
  "title": "Technical and specific title",
  "learningObjective": "Clear measurable outcome",
  "theory": "3–4 sentences including at least one technical reference",
  "analysisCriteria": [
    "Concrete measurable criterion",
    "Second measurable criterion",
    "Third measurable criterion"
  ],
  "practiceTask": "Actionable assignment",
  "auroNote": "Professional perspective explanation",
  "imageHint": "EXACTLY 2 concrete English keywords describing a visible subject or technique (e.g., 'portrait side light', 'golden hour landscape'). No abstract words."
}

Ensure:
- imageHint is exactly 2 keywords or a 2-word phrase.
- No abstract words like 'creative', 'concept', 'example'.
- No repetition across lessons.

Return only the JSON array.
`,
});

/* -------------------------------------------------------------------------- */
/*                                   FLOW                                     */
/* -------------------------------------------------------------------------- */

const generateLessonsFlow = ai.defineFlow(
  {
    name: 'generateLessonsFlowV2',
    inputSchema: GenerateLessonsInputSchema,
    outputSchema: GenerateLessonsOutputSchema,
  },
  async (input) => {
    const { output } = await generationPrompt(input);

    if (!output) {
      throw new Error('AI lesson generation failed: empty output.');
    }

    return output;
  }
);
