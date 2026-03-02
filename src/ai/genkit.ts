import 'server-only';
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1',
    }),
  ],
  // 'gemini-1.5-flash' görsel analizler için en hızlı ve kararlı modeldir.
  model: 'vertexai/gemini-1.5-flash',
});
