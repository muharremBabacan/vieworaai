import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { googleAI } from '@genkit-ai/google-genai';
import { getServiceAccount } from '@/lib/firebase/admin-init';

/**
 * Genkit configuration for Viewora AI Coach.
 * Uses Vertex AI for reasoning and Google AI for specialized tasks like Image generation.
 */

const serviceAccount = getServiceAccount();

let vertexConfig: any = {
  projectId: 'studio-8632782825-fce99',
  location: 'us-central1',
};

// 🛠️ Securely pass credentials from Env or File using shared logic
if (serviceAccount) {
  vertexConfig.googleAuthOptions = {
    credentials: serviceAccount
  };
}

export const ai = genkit({
  plugins: [
    vertexAI(vertexConfig),
    googleAI(),
  ],
  model: 'vertexai/gemini-2.0-flash-001',
});
