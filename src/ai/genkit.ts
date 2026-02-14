'use client';

import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    vertexAI({
      // Proje ID'si .env dosyasından alınır.
      // Bu plugin, Google Cloud ortamlarında (Cloud Run, GKE, vb.)
      // servis hesabı üzerinden otomatik olarak kimlik doğrulaması yapar.
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1', // Vertex AI için varsayılan ve genel bir bölge
    }),
  ],
  // Vertex AI üzerinde çalışan, güçlü ve çok modlu (multimodal) model.
  // "Not Found" hatalarını önlemek için modelin tam yolu kullanılıyor.
  model: 'publishers/google/models/gemini-1.5-pro-preview',
});
