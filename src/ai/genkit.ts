import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // API anahtarını .env dosyasından güvenli bir şekilde alır.
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  // Her zaman en güncel ve kararlı modeli kullanmak için 'latest' etiketini ekliyoruz.
  model: 'googleai/gemini-1.5-flash-latest', 
});
