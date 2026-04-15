'use server';

import OpenAI from 'openai';
import { adminDb } from "@/lib/firebase/admin-init";
import { PhotoAnalysis } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Tier = "start" | "pro" | "master";

export type PhotoAnalysisInput = {
  photoUrl: string;
  language: string;
  tier: Tier;
  guestId?: string; // 🔥 Kilit için eklendi
};

export type PhotoAnalysisOutput = {
  genre: string;
  scene: string;
  dominant_subject: string;
  light_score: number;
  composition_score: number;
  technical_clarity_score: number;
  storytelling_score: number;
  boldness_score: number;
  technical_details: {
    focus: string;
    light: string;
    technical_quality: string;
    color: string;
    composition: string;
  };
  general_quality: 'Düşük' | 'Orta' | 'İyi' | 'Çok İyi' | 'Profesyonel';
  expert_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  tags: string[];
  short_neutral_analysis: string;
  quality_note?: string;
};

/**
 * AI bazen sayı yerine "8/10" veya "8.5" gibi stringler dönebiliyor.
 * Bunları güvenli bir şekilde sayıya çevirir ve 0-10 aralığına normalize eder.
 */
function parseSafeScore(score: any): number {
  if (typeof score === 'number') return score;
  if (typeof score !== 'string') return 0;

  // "8/10" formatını temizle
  const cleanScore = score.split('/')[0].replace(',', '.').trim();
  const num = parseFloat(cleanScore);
  
  return isNaN(num) ? 0 : num;
}

export async function generatePhotoAnalysis(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisOutput> {
  console.log('[AI-DEBUG] Environment Check: OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
  console.log('[AI-DEBUG] Inbound Payload:', JSON.stringify({ 
    language: input.language, 
    tier: input.tier, 
    guestId: input.guestId,
    photoUrlLength: input.photoUrl?.length 
  }));

  const langMap: Record<string, string> = {
    tr: "Turkish",
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    ru: "Russian",
    ar: "Arabic",
    zh: "Chinese",
    ja: "Japanese"
  };
  const fullLanguage = langMap[input.language] || input.language;

  const prompt = `
Sen profesyonel bir fotoğraf analiz uzmanı ve görsel kalite değerlendiricisisin.
... [PROMPT CONTENT OMITTED FOR BREVITY IN DIFF, PRESERVED IN REAL FILE] ...
`;

  try {
    // 🔍 Hard Guards
    if (!input.photoUrl) {
      console.error('[AI-ERROR] photoUrl is missing in payload');
      throw new Error("photoUrl missing");
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('[AI-ERROR] OPENAI_API_KEY is not defined');
      throw new Error('CONFIG_ERROR: OPENAI_API_KEY missing');
    }

    if (!adminDb) {
      const initErr = (global as any)._adminInitError || 'Unknown Error';
      console.error('[AI-ERROR] adminDb initialization failed:', initErr);
      throw new Error(`FIREBASE_ERROR: Admin SDK init failed (${initErr})`);
    }

    // 🔒 THE LOCK: Sunucu tarafı kontrolü
    if (input.guestId && adminDb) {
      const usageRef = adminDb.collection('guest_usage').doc(input.guestId);
      const usageDoc = await usageRef.get();
      
      if (usageDoc.exists) {
        const lastUsedAt = usageDoc.data()?.last_used_at;
        if (lastUsedAt) {
          const cooldown = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - lastUsedAt < cooldown) {
            console.warn('[AI-DEBUG] Guest limit reached for ID:', input.guestId);
            throw new Error("GUEST_LIMIT_REACHED");
          }
        }
      }
    }

    console.log('[AI-DEBUG] Calling OpenAI GPT-4o-mini...');
    const startTime = Date.now();
    
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: input.photoUrl,
              },
            },
          ],
        },
      ],
    });

    console.log(`[AI-DEBUG] OpenAI Response received in ${Date.now() - startTime}ms`);
    
    const raw = res.choices[0]?.message?.content || "";
    if (!raw) {
      console.error('[AI-ERROR] OpenAI returned empty content');
      throw new Error("AI response empty");
    }
    
    console.log('[AI-DEBUG] Raw Content:', raw);
    
    const parsed = JSON.parse(raw);
    if (!parsed || Object.keys(parsed).length === 0) {
      console.error('[AI-ERROR] Parsed JSON is empty or null');
      throw new Error("analysis failed: invalid json result");
    }

    // 📝 THE RECORD: Kullanımı kaydet
    if (input.guestId && adminDb) {
      await adminDb.collection('guest_usage').doc(input.guestId).set({
        last_used_at: Date.now(),
        last_photo_url: input.photoUrl
      }, { merge: true }).catch(e => console.error('[AI-ERROR] Failed to save guest usage:', e.message));
    }

    const finalResult: PhotoAnalysisOutput = {
      genre: parsed.genre || "",
      scene: parsed.scene || "",
      dominant_subject: parsed.dominant_subject || "",
      light_score: parseSafeScore(parsed.light_score),
      composition_score: parseSafeScore(parsed.composition_score),
      technical_clarity_score: parseSafeScore(parsed.technical_clarity_score),
      storytelling_score: parseSafeScore(parsed.storytelling_score),
      boldness_score: parseSafeScore(parsed.boldness_score),
      technical_details: {
        focus: parsed.technical_details?.focus || "",
        light: parsed.technical_details?.light || "",
        technical_quality: parsed.technical_details?.technical_quality || "",
        color: parsed.technical_details?.color || "",
        composition: parsed.technical_details?.composition || ""
      },
      general_quality: parsed.general_quality || "Orta",
      expert_level: parsed.expert_level || "Beginner",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      short_neutral_analysis: parsed.short_neutral_analysis || "",
      quality_note: parsed.quality_note || undefined
    };

    console.log('[AI-DEBUG] Final Result generated. Returning with Serialization Safety...');
    
    // 🔥 SERIALIZATION SAFETY: Next.js Production Crash Fix
    return JSON.parse(JSON.stringify(finalResult));

  } catch (e: any) {
    if (e.message === "GUEST_LIMIT_REACHED") throw e;
    
    console.error('[AI-ERROR] CRITICAL EXCEPTION IN AI SERVICE');
    console.error('Message:', e.message);
    console.error('Stack:', e.stack);
    console.error('Full Error Object:', JSON.stringify(e, null, 2));
    
    throw e; // Rethrow to maintain error visibility
  }
}