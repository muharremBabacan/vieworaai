import 'server-only';
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: 'studio-8632782825-fce99',
      location: 'us-central1',
      googleAuth: auth,
    }),
  ],
  model: 'vertexai/gemini-2.0-flash-001',
});