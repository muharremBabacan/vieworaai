'use server';

import OpenAI from "openai";




export type ModerateSubmissionInput = {
  photoUrl: string;
  assignmentTitle?: string;
  assignmentDescription?: string;
  language: string;
};

export type ModerateSubmissionOutput = {
  safe: boolean;
  appropriate: boolean;
  should_analyze: boolean;
  message: string;
};

/**
 * AI Content Moderator and Curator Assistant.
 * Checks for safety and competition appropriateness.
 */
export async function moderateSubmission(
  input: ModerateSubmissionInput
): Promise<ModerateSubmissionOutput> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[BuildTime] OPENAI_API_KEY missing - skipping moderation (Safe during Build).');
    if (process.env.NODE_ENV === 'production') {
      return {
        safe: true,
        appropriate: true,
        should_analyze: false,
        message: "Runtime configuration error."
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
Sen bir fotoğraf platformunda içerik denetleyici ve küratör yardımcısısın.

Amaç:
- Fotoğrafın güvenli olup olmadığını kontrol etmek
- Yarışma kurallarına uygunluğunu değerlendirmek
- Uygunsa analiz sürecine izin vermek

BAĞLAM:
Yarışma/Ödev Başlığı: "${input.assignmentTitle || "Genel Galeri"}"
Yarışma/Ödev Açıklaması: "${input.assignmentDescription || "Genel paylaşım kuralları."}"

KURALLAR:
- Kesin ve objektif karar ver
- Nazik ama net ol
- Gereksiz uzun yazma
- Asla saldırgan dil kullanma

KONTROL ADIMLARI:

1. GÜVENLİK KONTROLÜ
Aşağıdaki içerikler varsa "unsafe" olarak işaretle:
- Müstehcen / cinsel içerik
- Şiddet / kan / rahatsız edici sahneler
- Nefret söylemi / saldırgan içerik

2. YARIŞMA UYGUNLUĞU
Fotoğraf:
- Belirtilen tema ile uyumlu mu?
- Teknik olarak kabul edilebilir mi? (çok bulanık, tamamen karanlık vs. olmamalı)
- İçerik olarak yarışmaya uygun mu?

3. KARAR

Respond ONLY in the following language: ${fullLanguage}

ÇIKTI FORMATI (JSON):
{
  "safe": true | false,
  "appropriate": true | false,
  "should_analyze": true | false,
  "message": "kullanıcıya gösterilecek nazik mesaj"
}

MESAJ KURALLARI (Dil: ${fullLanguage}):
- Eğer uygun değilse: "Yarışmaya uygun bir fotoğraf seçmeniz gerekiyor. Lütfen tema ile uyumlu ve genel kurallara uygun bir fotoğraf yükleyin."
- Eğer güvenli değilse: "Yüklediğiniz içerik platform kurallarına uygun değil. Lütfen farklı bir fotoğraf deneyin."
- Eğer uygunsa: "Fotoğrafınız analiz için uygun."

Analyze the photo:
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" }, // 🔥 Enforce JSON
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
      console.error("Moderation JSON Parse Error:", raw);
      return {
        safe: true,
        appropriate: true,
        should_analyze: false,
        message: "Yapay zeka moderasyonu şu an yapılamadı. Lütfen teknik bir sorun olduğunu bildirin."
      };
    }

    return {
      safe: parsed.safe ?? true,
      appropriate: parsed.appropriate ?? true,
      should_analyze: parsed.should_analyze ?? false,
      message: parsed.message || "Kontrol tamamlandı."
    };

  } catch (e: any) {
    console.error("Moderation Flow Failure:", e);
    return {
      safe: true,
      appropriate: true,
      should_analyze: false,
      message: "Yapay zeka servisine şu an erişilemiyor."
    };
  }
}
