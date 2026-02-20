import 'server-only'; // Tarayıcıya sızmasını engeller
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    // Bu eklenti, servis hesabı kimlik doğrulamasını otomatik olarak kullanır.
    vertexAI({
      // Proje ID'si ve konumu .env dosyasından okunacak
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-east4', // 'us-central1' yerine bunu yazın
    }),
  ],
  // Modeli, eklenti adıyla birlikte ('eklentiAdi/modelAdi') belirtmek,
  // Genkit'in doğru eklentiyi kullanmasını sağlar ve çakışmaları önler.
  // 'gemini-2.0-flash-001', Vertex AI'daki güçlü ve çok modlu (görsel anlama) bir modeldir.
  model: 'vertexai/gemini-2.0-flash-001',
});
