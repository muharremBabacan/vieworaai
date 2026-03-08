'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const PhotoTechnicalSchema = z.object({
  light_score:z.number(),
  composition_score:z.number(),
  technical_clarity_score:z.number(),
  storytelling_score:z.number().optional(),
  boldness_score:z.number().optional()
});

const AdaptiveInputSchema=z.object({
  language:z.string(),
  userLevel:z.string(),

  genre:z.string(),
  scene:z.string(),
  dominant_subject:z.string(),
  tags:z.array(z.string()),

  technical:PhotoTechnicalSchema
});

export type AdaptiveInput=z.infer<typeof AdaptiveInputSchema>;

const AdaptiveOutputSchema=z.object({
  feedback:z.string()
});

export async function generateAdaptiveFeedback(
input:AdaptiveInput
){
return flow(input);
}

const prompt=ai.definePrompt({
name:'adaptiveLumaPromptV2',
input:{schema:AdaptiveInputSchema},
output:{schema:AdaptiveOutputSchema},

system:`
You are Luma, Viewora's visual mentor.

Use the scene, subject and tags to understand the image context.

Structure feedback:

Işık
Kompozisyon
Teknik

Never invent themes unrelated to tags.
`,

prompt:`

GENRE: {{{genre}}}
SCENE: {{{scene}}}
SUBJECT: {{{dominant_subject}}}

TAGS:
{{#each tags}}
- {{this}}
{{/each}}

TECHNICAL DATA:
Light: {{{technical.light_score}}}
Composition: {{{technical.composition_score}}}
Clarity: {{{technical.technical_clarity_score}}}
Storytelling: {{{technical.storytelling_score}}}
Boldness: {{{technical.boldness_score}}}

Respond in {{{language}}}.
`
});

const flow=ai.defineFlow(
{
name:'adaptiveLumaFlowV2',
inputSchema:AdaptiveInputSchema,
outputSchema:AdaptiveOutputSchema
},
async(input)=>{
const {output}=await prompt(input);
if(!output) throw new Error("Luma feedback failed");
return output;
}
);