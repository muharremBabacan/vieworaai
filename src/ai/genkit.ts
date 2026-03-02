import 'server-only';
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    vertexAI({ location: 'us-central1' }),
  ],
  model: 'vertexai/gemini-2.0-flash-001',
});
