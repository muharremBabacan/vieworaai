import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit configuration for Viewora AI Coach.
 * Uses Vertex AI for reasoning and Google AI for specialized tasks like Image generation.
 */
export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: 'studio-8632782825-fce99',
      location: 'us-central1',
    }),
    googleAI(),
  ],
  model: 'vertexai/gemini-2.0-flash-001',
});
