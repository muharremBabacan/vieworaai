'use server';
/**
 * @fileOverview A photo analysis AI agent that provides objective technical and artistic data.
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
  // Core 5 Metrics aligned with Profile Index
  light_score: z.number().min(0).max(10).describe("Exposure balance, quality and direction of light."),
  composition_score: z.number().min(0).max(10).describe("Rule of thirds, balance, leading lines and framing."),
  storytelling_score: z.number().min(0).max(10).describe("Narrative depth, emotion and the story being told."),
  technical_clarity_score: z.number().min(0).max(10).describe("Focus, sharpness and digital noise control."),
  boldness_score: z.number().min(0).max(10).describe("Artistic risk-taking, unique perspective and daring choices."),
  
  // Secondary technical data
  color_control_score: z.number().min(0).max(10),
  background_control_score: z.number().min(0).max(10),
  
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

Analyze the uploaded image strictly and objectively for both technical and artistic data.

METRIC GUIDELINES:
- light_score: Balance of shadows and highlights.
- composition_score: Structural harmony.
- storytelling_score: Does the image evoke a feeling or narrative?
- technical_clarity_score: Sharpness and technical execution.
- boldness_score: How much did the artist push the boundaries?

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
