import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { getAdminStorage } from '@/lib/firebase/admin-init';

// Define the schema using Zod for 100% type safety
const PhotoAnalysisSchema = z.object({
  light_score: z.number(),
  composition_score: z.number(),
  technical_clarity_score: z.number(),
  storytelling_score: z.number(),
  boldness_score: z.number(),
  tags: z.array(z.string()),
  summary: z.string()
});

/**
 * Perform AI analysis on a photo using OpenAI Vision API.
 */
export async function performAiAnalysis(
  imageUrl: string, 
  photoId: string, 
  filePath?: string, 
  isGuest?: boolean,
  onboardingResults?: any
): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ [AI-LOGIC] OPENAI_API_KEY is missing in production!');
    throw new Error('OPENAI_API_KEY_MISSING');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log('🤖 [AI-LOGIC] Starting modern analysis for', photoId);

  // 1. Generate Signed URL for secure access
  let analysisUrl = imageUrl;
  try {
    const bucket = getAdminStorage();
    
    // 🛠️ FIX: Use explicit filePath if provided, otherwise fallback to parsing (robustly)
    let pathInBucket = filePath;
    if (!pathInBucket) {
      // Robust extraction: find /o/ then extract until ?
      const oIndex = imageUrl.indexOf('/o/');
      if (oIndex !== -1) {
        const afterO = imageUrl.substring(oIndex + 3);
        const queryIndex = afterO.indexOf('?');
        pathInBucket = decodeURIComponent(queryIndex !== -1 ? afterO.substring(0, queryIndex) : afterO);
      } else {
        pathInBucket = imageUrl.split(`${bucket.name}/`)[1];
      }
    }

    if (pathInBucket) {
      const file = bucket.file(pathInBucket);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000 // 15 mins
      });
      analysisUrl = url;
      console.log('✅ [AI-LOGIC] Signed URL generated');
    }
  } catch (e: any) {
    console.warn('⚠️ [AI-LOGIC] Failed to get signed URL, using direct:', e.message);
  }

  try {
    const aiCallStart = Date.now();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `You are a professional photography coach based in Turkey. Analyze this photo technically and artistically.
              You MUST return a JSON object with strictly these keys and types:
              - genre (string in Turkish, e.g. 'Sokak Fotoğrafçılığı')
              - scene (string in Turkish, e.g. 'Gece Pazarı')
              - dominant_subject (string in Turkish: main focus)
              - light_score (float 0-10)
              - composition_score (float 0-10)
              - technical_clarity_score (float 0-10)
              - storytelling_score (float 0-10)
              - boldness_score (float 0-10)
              - technical_details (object: { focus, light, technical_quality, color, composition }) - exactly 1 concise sentence each IN TURKISH
              - general_quality (enum: 'Düşük' | 'Orta' | 'İyi' | 'Çok İyi' | 'Profesyonel')
              - expert_level (enum: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert')
              - tags (array of strings: exactly 5 relevant tags in Turkish, NO hashtags)
              - short_neutral_analysis (detailed Turkish critique, exactly 3-4 professional sentences)
              - quality_note (string in Turkish: constructive tip for improvement)
              
              CRITICAL: 
              1. Every string value must be in Turkish.
              2. Do not include hashtags in the tags array.
              3. Ensure 'technical_details' object is fully populated.
              4. Be objective and professional.
              ${isGuest ? "5. IMPORTANT: This is a GUEST user. In 'short_neutral_analysis', do NOT be generic. Mention one specific strength (like light or colors) and one area for improvement based on THIS specific photo. Use an EXTRA ENCOURAGING, nurturing tone. Convey that they have a 'hidden talent' and with just a little help from Viewora Academy to fix that specific weakness, they could easily be ready for our exhibitions and competitions. Make them feel seen and talented." : ""}
              ${(!isGuest && onboardingResults) ? `5. USER CONTEXT: The user is a registered member.
                 - Interest: ${onboardingResults.interest}
                 - Device: ${onboardingResults.device_type}
                 - Level: ${onboardingResults.technical_level}
                 - Motivation: ${onboardingResults.motivation}
                 
                 In 'short_neutral_analysis', adjust your tone and technical depth. If 'technical_level' is 'beginner', be more teaching and encouraging. If 'advanced', be highly technical and result-oriented.
                 Also, if their interest matches this photo, give them a 'High Potential' boost in the feedback.
                 If they have low scores in something (like composition), suggest they check the Viewora Academy lessons related to ${onboardingResults.approach || 'composition'}.
                 ` : ""}
              `
            },
            { type: "image_url", image_url: { url: analysisUrl } }
          ],
        },
      ],
      response_format: { type: "json_object" }
    });

    const aiCallDuration = Date.now() - aiCallStart;
    console.log(`⏱️ [AI-LOGIC] OpenAI API Response received in ${aiCallDuration}ms`);

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('AI_NO_CONTENT_RETURNED');
    }

    const parsedData = JSON.parse(content);
    console.log('✅ [AI-LOGIC] Full Professional Analysis parsed successfully');
    return parsedData;
    
  } catch (openaiError: any) {
    console.error('🔥 [AI-LOGIC] OpenAI API Error:', openaiError.message);
    throw openaiError;
  }
}

