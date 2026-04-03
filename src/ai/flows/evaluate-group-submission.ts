'use server';

import OpenAI from "openai";
import { PhotoAnalysis } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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

export async function evaluateGroupSubmission(
  input: EvaluateGroupSubmissionInput
): Promise<EvaluateGroupSubmissionOutput> {
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
- Fotoğrafın seviyesini ve kalitesini objektif olarak belirlemek

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

    return {
      analysis: {
        genre: parsed.analysis?.genre || parsed.genre || "",
        scene: parsed.analysis?.scene || parsed.scene || "",
        dominant_subject: parsed.analysis?.dominant_subject || parsed.dominant_subject || "",
        light_score: Number(parsed.analysis?.light_score || parsed.light_score) || 0,
        composition_score: Number(parsed.analysis?.composition_score || parsed.composition_score) || 0,
        technical_clarity_score: Number(parsed.analysis?.technical_clarity_score || parsed.technical_clarity_score) || 0,
        storytelling_score: Number(parsed.analysis?.storytelling_score || parsed.storytelling_score) || 0,
        boldness_score: Number(parsed.analysis?.boldness_score || parsed.boldness_score) || 0,
        tags: Array.isArray(parsed.analysis?.tags || parsed.tags) ? (parsed.analysis?.tags || parsed.tags).slice(0, 4) : [],
        short_neutral_analysis: parsed.analysis?.short_neutral_analysis || parsed.short_neutral_analysis || "",
      },
      evaluation: {
        isSuccess: parsed.evaluation?.isSuccess ?? true,
        feedback: parsed.evaluation?.feedback || parsed.evaluation?.comment || "",
        score: Number(parsed.evaluation?.score) || 0,
        technicalPoints: Array.isArray(parsed.evaluation?.technicalPoints) ? parsed.evaluation.technicalPoints : []
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
