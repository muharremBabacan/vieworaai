'use server';
/**
 * @fileOverview A tiered photo analysis AI agent.
 *
 * - generatePhotoAnalysis - Handles analysis depth based on user tier.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PhotoAnalysisInputSchema = z.object({
  photoUrl: z.string().url().describe("A publicly accessible HTTPS URL of the photo."),
  language: z.string().describe('Response language (tr, en).'),
  tier: z.enum(['start', 'pro', 'master']).describe("The analysis package depth."),
});
export type PhotoAnalysisInput = z.infer<typeof PhotoAnalysisInputSchema>;

const VisualMarkerSchema = z.object({
  type: z.enum(["subject", "distraction", "light_direction"]),
  box_2d: z.array(z.number()).length(4).describe("[ymin, xmin, ymax, xmax] normalized 0-1000"),
  label: z.string(),
});

const PhotoAnalysisOutputSchema = z.object({
  genre: z.string(),
  // Core Metrics
  light_score: z.number().min(0).max(10),
  composition_score: z.number().min(0).max(10),
  technical_clarity_score: z.number().min(0).max(10),
  
  // Pro/Master Metrics (Optional for Start)
  storytelling_score: z.number().min(0).max(10).optional(),
  boldness_score: z.number().min(0).max(10).optional(),
  
  // Master features
  visual_markers: z.array(VisualMarkerSchema).optional(),
  style_analysis: z.string().optional(),
  
  tags: z.array(z.string()).max(4),
  short_neutral_analysis: z.string(),
});
export type PhotoAnalysisOutput = z.infer<typeof PhotoAnalysisOutputSchema>;

export async function generatePhotoAnalysis(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisOutput> {
  return analysisFlow(input);
}

const analysisPrompt = ai.definePrompt({
  name: 'photoAnalysisTieredPrompt',
  input: {schema: PhotoAnalysisInputSchema},
  output: {schema: PhotoAnalysisOutputSchema},
  config: { temperature: 0.2 },
  prompt: `You are Luma, Viewora's professional photography guide.

TIER RULES (Current Tier: {{{tier}}}):

1. IF tier is 'start':
   - Analyze ONLY: Light, Composition, Technical Clarity.
   - Provide a short comment (max 2 sentences).
   - Metrics: Set storytelling_score and boldness_score to 0.

2. IF tier is 'pro':
   - Analyze ALL 5 Metrics: Light, Composition, Technical Clarity, Storytelling, Boldness.
   - Provide a coaching-style comment (3-4 sentences) using the "realization" tone.

3. IF tier is 'master':
   - Analyze ALL 5 Metrics + Visual Markers + Style Analysis.
   - visual_markers: Identify the main subject and any distractions using [ymin, xmin, ymax, xmax] coordinates.
   - style_analysis: Describe the artist's visible style (e.g., "High contrast, centered composition").

TONE RULE: Luma does not criticize; Luma makes the artist realize.

Respond in language: {{{language}}}
Analyze photo: {{media url=photoUrl}}`,
});

const analysisFlow = ai.defineFlow(
  {
    name: 'photoAnalysisTieredFlow',
    inputSchema: PhotoAnalysisInputSchema,
    outputSchema: PhotoAnalysisOutputSchema,
  },
  async (input) => {
    const {output} = await analysisPrompt(input);
    if (!output) throw new Error('AI analysis failed.');
    return output;
  }
);
