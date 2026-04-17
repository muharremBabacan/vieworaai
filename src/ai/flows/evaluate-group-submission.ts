'use server';

import OpenAI from "openai";
import { PhotoAnalysis } from "@/types";




export type EvaluateGroupSubmissionInput = {
  photoUrl: string;
  assignmentTitle: string;
  assignmentDescription: string;
  language: string;
};

export type EvaluateGroupSubmissionOutput = {
  analysis: PhotoAnalysis;
  evaluation: {
    isSuccess: boolean;
    feedback: string;
    score: number;
    technicalPoints: string[];
  };
};

/**
 * AI bazen sayı yerine "8/10" veya "8.5" gibi stringler dönebiliyor.
 * Bunları güvenli bir şekilde sayıya çevirir.
 */
function parseSafeScore(score: any): number {
  if (typeof score === 'number') return score;
  if (typeof score !== 'string') return 0;
  const cleanScore = score.split('/')[0].replace(',', '.').trim();
  const num = parseFloat(cleanScore);
  return isNaN(num) ? 0 : num;
}

export async function evaluateGroupSubmission(
  input: EvaluateGroupSubmissionInput
): Promise<EvaluateGroupSubmissionOutput> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[BuildTime] OPENAI_API_KEY missing - skipping group evaluation (Safe during Build).');
    if (process.env.NODE_ENV === 'production') {
      return {
        analysis: { genre: "", scene: "", dominant_subject: "", light_score: 0, composition_score: 0, technical_clarity_score: 0, storytelling_score: 0, boldness_score: 0, tags: [], short_neutral_analysis: "Runtime configuration error." },
        evaluation: { isSuccess: false, feedback: "OpenAI API key missing.", score: 0, technicalPoints: [] }
      };
    }
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

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
You are Luma, Viewora's professional photography instructor and competition director.
Sen profesyonel bir fotoğraf analiz uzmanı ve görsel kalite değerlendiricisisin.

Amaç:
- Fotoğrafı teknik ve estetik açıdan yüksek doğrulukla analiz etmek
- "${input.assignmentTitle}" ödevi kapsamında başarısını değerlendirmek
- Fotoğrafın seviyesini ve kalinesini objektif olarak belirlemek

ÖDEV BAĞLAMI:
Başlık: "${input.assignmentTitle}"
Açıklama: "${input.assignmentDescription || ""}"

KRATERLER (ÖZELLİKLE DİKKAT ET):
- Netlik (focus accuracy)
- Motion blur (hareket bulanıklığı)
- Noise / grain (kumlanma)
- Compression artefacts (sıkıştırma bozulmaları)
- Işık dengesi (pozlama, dynamic range)
- Kompozisyon dengesi
- Renk doğruluğu

TON: Profesyonel, Net, Saygılı.
DİL: ${fullLanguage}

ÇIKTI FORMATI (JSON):
{
  "analysis": {
    "light_score": 0-10,
    "composition_score": 0-10,
    "technical_clarity_score": 0-10,
    "storytelling_score": 0-10,
    "boldness_score": 0-10,
    "technical_details": {
      "focus": "Netlik analizi...",
      "light": "Işık analizi...",
      "technical_quality": "Teknik kalite analizi...",
      "color": "Renk analizi...",
      "composition": "Kompozisyon analizi..."
    },
    "general_quality": "Düşük | Orta | İyi | Çok İyi | Profesyonel",
    "expert_level": "Beginner | Intermediate | Advanced | Expert",
    "genre": "...",
    "scene": "...",
    "dominant_subject": "...",
    "tags": ["tag1", "tag2"],
    "short_neutral_analysis": "Ödevle uyumunu da içeren profesyonel özet",
    "quality_note": "Kalite uyarısı (opsiyonel)"
  },
  "evaluation": {
    "isSuccess": true,
    "feedback": "Yarışma/Ödev kriterlerine göre detaylı eğitmen yorumu (3-4 cümle)",
    "score": 0-100,
    "technicalPoints": ["Öne çıkan 1. teknik özellik", "Öne çıkan 2. teknik özellik"]
  }
}

Analyze the photo:
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
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

    const raw = res.choices[0]?.message?.content || "";
    
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("AI JSON Parse Error:", raw);
      return {
        analysis: { genre: "Unknown", scene: "Unknown", dominant_subject: "Unknown", light_score: 0, composition_score: 0, technical_clarity_score: 0, storytelling_score: 0, boldness_score: 0, tags: [], short_neutral_analysis: "Analiz sırasında teknik bir sorun oluştu." },
        evaluation: { isSuccess: false, feedback: "Üzgünüz, yapay zeka bu görseli şu an analiz edemedi. Lütfen daha sonra tekrar deneyin.", score: 0, technicalPoints: [] }
      };
    }

    const aiAnalysis = parsed.analysis || parsed;
    const aiEvaluation = parsed.evaluation || {};

    return {
      analysis: {
        genre: aiAnalysis.genre || "",
        scene: aiAnalysis.scene || "",
        dominant_subject: aiAnalysis.dominant_subject || "",
        light_score: parseSafeScore(aiAnalysis.light_score),
        composition_score: parseSafeScore(aiAnalysis.composition_score),
        technical_clarity_score: parseSafeScore(aiAnalysis.technical_clarity_score),
        storytelling_score: parseSafeScore(aiAnalysis.storytelling_score),
        boldness_score: parseSafeScore(aiAnalysis.boldness_score),
        tags: Array.isArray(aiAnalysis.tags) ? aiAnalysis.tags.slice(0, 4) : [],
        short_neutral_analysis: aiAnalysis.short_neutral_analysis || "",
        technical_details: aiAnalysis.technical_details || {
          focus: "", light: "", technical_quality: "", color: "", composition: ""
        },
        general_quality: aiAnalysis.general_quality || "Orta",
        expert_level: aiAnalysis.expert_level || "Beginner",
        quality_note: aiAnalysis.quality_note
      },
      evaluation: {
        isSuccess: aiEvaluation.isSuccess ?? true,
        feedback: aiEvaluation.feedback || aiEvaluation.comment || "",
        score: parseSafeScore(aiEvaluation.score),
        technicalPoints: Array.isArray(aiEvaluation.technicalPoints) ? aiEvaluation.technicalPoints : []
      }
    };

  } catch (e: any) {
    console.error("AI Flow Failure:", e);
    return {
      analysis: { genre: "", scene: "", dominant_subject: "", light_score: 0, composition_score: 0, technical_clarity_score: 0, storytelling_score: 0, boldness_score: 0, tags: [], short_neutral_analysis: "" },
      evaluation: { isSuccess: false, feedback: "Teknik bir hata nedeniyle analiz yapılamadı.", score: 0, technicalPoints: [] }
    };
  }
}
