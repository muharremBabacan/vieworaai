'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PhotoAnalysisInputSchema = z.object({
  photoUrl: z.string().url(),
  language: z.string(),
  tier: z.enum(['start','pro','master'])
});
export type PhotoAnalysisInput = z.infer<typeof PhotoAnalysisInputSchema>;

const VisualMarkerSchema = z.object({
  type: z.enum(["subject","distraction","light_direction"]),
  box_2d: z.array(z.number()).length(4),
  label: z.string()
});

const PhotoAnalysisOutputSchema = z.object({
  genre: z.string(),
  scene: z.string(),
  dominant_subject: z.string(),

  light_score: z.number().min(0).max(10),
  composition_score: z.number().min(0).max(10),
  technical_clarity_score: z.number().min(0).max(10),

  storytelling_score: z.number().min(0).max(10).optional(),
  boldness_score: z.number().min(0).max(10).optional(),

  visual_markers: z.array(VisualMarkerSchema).optional(),
  style_analysis: z.string().optional(),

  tags: z.array(z.string()).max(4),
  short_neutral_analysis: z.string()
});

export type PhotoAnalysisOutput = z.infer<typeof PhotoAnalysisOutputSchema>;

export async function generatePhotoAnalysis(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisOutput> {
  return analysisFlow(input);
}

const analysisPrompt = ai.definePrompt({
  name:'photoAnalysisPromptV2',
  input:{schema:PhotoAnalysisInputSchema},
  output:{schema:PhotoAnalysisOutputSchema},
  config:{temperature:0.2},
  prompt:`
You are Luma, Viewora's professional photography analysis AI.

TASK:
Analyze the photo and produce structured evaluation.

TAGS RULE:
Generate max 4 tags describing the scene or subject
(e.g., portrait, landscape, street, macro, architecture, food).

SCENE:
Describe the environment briefly.

DOMINANT_SUBJECT:
Identify the main subject.

Respond in language: {{{language}}}

Analyze photo:
{{media url=photoUrl}}
`
});

const analysisFlow = ai.defineFlow(
{
name:'photoAnalysisFlow',
inputSchema:PhotoAnalysisInputSchema,
outputSchema:PhotoAnalysisOutputSchema
},
async(input)=>{
const {output}=await analysisPrompt(input);
if(!output) throw new Error("AI analysis failed");
return output;
}
);