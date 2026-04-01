import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { googleAI } from '@genkit-ai/google-genai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Genkit configuration for Viewora AI Coach.
 * Uses Vertex AI for reasoning and Google AI for specialized tasks like Image generation.
 */

let vertexConfig: any = {
  projectId: 'studio-8632782825-fce99',
  location: 'us-central1',
};

// 🛠️ Fix: If GOOGLE_APPLICATION_CREDENTIALS is broken (%cd% error), 
// try to use the local serviceAccount.json manually.
const localSA = path.join(process.cwd(), 'serviceAccount.json');
if (fs.existsSync(localSA)) {
  try {
    const sa = JSON.parse(fs.readFileSync(localSA, 'utf8'));
    vertexConfig.googleAuthOptions = {
        credentials: sa
    };
  } catch (e) {
    console.error('Failed to load serviceAccount.json for Genkit:', e);
  }
}

export const ai = genkit({
  plugins: [
    vertexAI(vertexConfig),
    googleAI(),
  ],
  model: 'vertexai/gemini-2.0-flash-001',
});
