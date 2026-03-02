import 'server-only';
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

/**
 * Genkit configuration for Viewora AI Coach.
 * Uses Vertex AI plugin with Gemini 2.0 Flash.
 * Authentication is handled via Application Default Credentials (ADC)
 * which is the standard for Google Cloud environments like Cloud Run and App Hosting.
 */
export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: 'studio-8632782825-fce99',
      location: 'us-central1',
    }),
  ],
  model: 'vertexai/gemini-2.0-flash-001',
});
