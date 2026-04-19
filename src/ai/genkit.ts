import { genkit } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit configuration for Viewora AI Coach.
 * Uses OpenAI (gpt-4.1-mini) for reasoning and Google AI for specialized tasks.
 */

let aiInstance: ReturnType<typeof genkit> | null = null;

/**
 * 🤖 Lazy initialization of Genkit.
 * Prevents side effects and credential validation during Build Time.
 */
export function getAi() {
  if (aiInstance) return aiInstance;

  aiInstance = genkit({
    plugins: [
      openAI(), // Defaults to OPENAI_API_KEY env var
      googleAI(),
    ],
    model: 'openai/gpt-4.1-mini',
  });

  return aiInstance;
}
