'use client';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // API anahtarını .env dosyasından güvenli bir şekilde alır.
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  // Görsel analiz için standart ve kararlı model.
  // Genkit'in modeli tanıması için 'googleai/' öneki gereklidir.
  model: 'googleai/gemini-pro-vision',
});
