import 'server-only'; // Tarayıcıya sızmasını engeller
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    // Bu eklenti, servis hesabı kimlik doğrulamasını otomatik olarak kullanır.
    vertexAI({
      // Proje ID'si ve konumu .env dosyasından okunacak
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1',
    }),
  ],
  // Modeli, eklenti adıyla birlikte ('eklentiAdi/modelAdi') belirtmek,
  // Genkit'in doğru eklentiyi kullanmasını sağlar ve çakışmaları önler.
  // 'gemini-1.5-pro', Vertex AI'daki güçlü ve çok modlu (görsel anlama) bir modeldir.
  model: 'vertexai/gemini-1.5-pro',
});
