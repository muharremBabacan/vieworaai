'use server';

import { generatePhotoAnalysis } from '@/ai/flows/analyze-photo-and-suggest-improvements';
import { generateAdaptiveFeedback } from '@/ai/flows/generate-adaptive-feedback';

export async function analyzeAndCommentPhoto(
  photoUrl: string,
  language: string,
  tier: 'start' | 'pro' | 'master',
  userLevel: string
) {

  const analysis = await generatePhotoAnalysis({
    photoUrl,
    language,
    tier
  });

  const feedback = await generateAdaptiveFeedback({
    language,
    userLevel,

    genre: analysis.genre,
    scene: analysis.scene,
    dominant_subject: analysis.dominant_subject,
    tags: analysis.tags,

    technical: {
      light_score: analysis.light_score,
      composition_score: analysis.composition_score,
      technical_clarity_score: analysis.technical_clarity_score,
      storytelling_score: analysis.storytelling_score,
      boldness_score: analysis.boldness_score
    }
  });

  return {
    analysis,
    feedback: feedback.feedback
  };
}