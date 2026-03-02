'use server';
/**
 * @fileOverview A photo analysis AI agent that provides objective technical data.
 *
 * - generatePhotoAnalysis - A function that handles the photo analysis process.
 * - PhotoAnalysisInput - The input type for the generatePhotoAnalysis function.
 * - PhotoAnalysisOutput - The return type for the generatePhotoAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PhotoAnalysisInputSchema = z.object({
  photoUrl: z
    .string()
    .url()
    .describe(
      "A publicly accessible HTTPS URL of the photo to analyze."
    ),
  language: z.string().describe('The language for the response (e.g., "tr", "en").'),
});
export type PhotoAnalysisInput = z.infer<typeof PhotoAnalysisInputSchema>;

const PhotoAnalysisOutputSchema = z.object({
  device_estimation: z.enum(["mobile", "entry_dslr", "mirrorless", "pro_dslr", "unknown"]),
  genre: z.enum(["portrait", "street", "landscape", "macro", "architecture", "documentary", "other"]),
  light_score: z.number().min(0).max(10),
  composition_score: z.number().min(0).max(10),
  focus_score: z.number().min(0).max(10),
  color_control_score: z.number().min(0).max(10),
  background_control_score: z.number().min(0).max(10),
  creativity_risk_score: z.number().min(0).max(10),
  technical_level_estimation: z.enum(["beginner", "lower_intermediate", "intermediate", "advanced"]),
  tags: z.array(z.string()).max(4).describe("Up to 4 descriptive tags about the photo style or subject (e.g., 'Golden Hour', 'Minimalist', 'Sharp Focus')."),
  error_flags: z.object({
    overexposed: z.boolean(),
    underexposed: z.boolean(),
    cluttered_background: z.boolean(),
    weak_subject_isolation: z.boolean(),
    horizon_misalignment: z.boolean(),
  }),
  short_neutral_analysis: z.string().describe("maximum 2 short sentences focusing on guidance"),
});
export type PhotoAnalysisOutput = z.infer<typeof PhotoAnalysisOutputSchema>;

// The main function that the application calls.
export async function generatePhotoAnalysis(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisOutput> {
  return analysisFlow(input);
}

const analysisPrompt = ai.definePrompt({
  name: 'photoAnalysisJsonPrompt',
  input: {schema: PhotoAnalysisInputSchema},
  output: {schema: PhotoAnalysisOutputSchema},
  config: {
    temperature: 0.2,
  },
  prompt: `You are Luma, a professional photography guide.

CRITICAL TONE RULE: 
Luma does not criticize; Luma makes the artist realize. 
You are a guide, not a judge. 
Instead of saying "The background is bad", say "If the background is simplified, the core feeling becomes more visible."
Avoid negative labels. Focus on potential and enhancement.

Analyze the uploaded image strictly and objectively for technical data, but keep the 'short_neutral_analysis' guidance-oriented.

Return ONLY valid JSON. Do not write explanations outside JSON.

Generate exactly 4 tags that best describe the photo's mood, style, or specific content in language: {{{language}}}.

Respond in language: {{{language}}}

Analyze the photo provided: {{media url=photoUrl}}`,
});

const analysisFlow = ai.defineFlow(
  {
    name: 'photoAnalysisJsonFlow',
    inputSchema: PhotoAnalysisInputSchema,
    outputSchema: PhotoAnalysisOutputSchema,
  },
  async (input) => {
    const {output} = await analysisPrompt(input);
    if (!output) {
      throw new Error('Yapay zeka fotoğraf analiz çıktısı üretemedi. Lütfen görselin erişilebilir olduğundan emin olun.');
    }
    return output;
  }
);
