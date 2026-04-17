'use server'

/**
 * @fileOverview Günlük fotoğrafçılık dersi üretme OpenAI akışı.
 */

import OpenAI from "openai";
import { generateLessonImage } from '../lesson/generate-academy-lessons';




export type GenerateDailyLessonInput = {
  level: 'Temel' | 'Orta' | 'İleri';
  category: string;
  language?: string;
};

export async function generateDailyLesson(input: GenerateDailyLessonInput) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[BuildTime] OPENAI_API_KEY missing - skipping lesson generation (Safe during Build).');
    if (process.env.NODE_ENV === 'production') return null;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  const prompt = `
Aşağıdaki müfredat için yapılandırılmış bir fotoğrafçılık mini dersi oluştur.

Seviye: ${input.level}
Kategori: ${input.category}

Ders şunları içermeli:
- title: Başlık
- learningObjective: Öğrenim hedefi
- theory: Teori (2-3 paragraf)
- analysisCriteria: Başarı kriterleri (Tam 3 adet)
- practiceTask: Pratik görevi
- auroNote: Uzman notu
- imageHint: Görsel için 3-4 İngilizce anahtar kelime

Dil: ${input.language || "tr"}

Return ONLY valid JSON array with 1 object:
[{
  "title": "...",
  "learningObjective": "...",
  "theory": "...",
  "analysisCriteria": ["...", "...", "..."],
  "practiceTask": "...",
  "auroNote": "...",
  "imageHint": "..."
}]
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = res.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const output = JSON.parse(clean);

    if (!output || output.length === 0) return null;

    const lesson = output[0];
    
    // Mevcut görsel üretim akışını kullanıyoruz
    const result = await generateLessonImage(lesson.imageHint);
    const base64 = result.success ? result.imageUrl : null;

    return {
      ...lesson,
      level: input.level,
      category: input.category,
      generatedImageBase64: base64,
      createdAt: new Date().toISOString()
    };

  } catch (e: any) {
    console.error("Daily Lesson Generation failed:", e);
    return null;
  }
}
