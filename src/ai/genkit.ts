import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { googleAI } from '@genkit-ai/google-genai';
import { getServiceAccount } from '@/lib/firebase/admin-init';

/**
 * Genkit configuration for Viewora AI Coach.
 * Uses Vertex AI for reasoning and Google AI for specialized tasks like Image generation.
 */

let aiInstance: ReturnType<typeof genkit> | null = null;

/**
 * 🤖 Lazy initialization of Genkit.
 * Prevents side effects and credential validation during Build Time.
 */
export function getAi() {
  if (aiInstance) return aiInstance;

  const serviceAccount = getServiceAccount();
  
  const vertexConfig: any = {
    projectId: 'studio-8632782825-fce99',
    location: 'us-central1',
  };

  // 🛡️ Only add credentials if they exist (expectedly missing during App Hosting build)
  if (serviceAccount) {
    vertexConfig.googleAuthOptions = {
      credentials: serviceAccount
    };
  } else {
    console.warn('[Genkit] Initializing without service account credentials (Build Time Mode).');
  }

  aiInstance = genkit({
    plugins: [
      vertexAI(vertexConfig),
      googleAI(),
    ],
    model: 'vertexai/gemini-2.0-flash-001',
  });

  return aiInstance;
}
