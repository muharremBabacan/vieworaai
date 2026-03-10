'use server'

/**
 * @fileOverview Günlük fotoğrafçılık dersi üretme AI akışı.
 */

import { ai } from '@/ai/genkit'
import { z } from 'genkit'
import { generateLessonImage } from '../lesson/generate-academy-lessons';

const InputSchema = z.object({
 level: z.enum(['Temel','Orta','İleri']),
 category: z.string()
})

const LessonSchema = z.object({
 title: z.string(),
 learningObjective: z.string(),
 theory: z.string(),
 analysisCriteria: z.array(z.string()).length(3),
 practiceTask: z.string(),
 auroNote: z.string(),
 imageHint: z.string()
})

const OutputSchema = z.array(LessonSchema).length(1)

const lessonPrompt = ai.definePrompt({
 name: "vieworaLessonGenerator",
 input: { schema: InputSchema },
 output: { schema: OutputSchema },
 prompt: `
Aşağıdaki müfredat için yapılandırılmış bir fotoğrafçılık mini dersi oluştur.

Seviye: {{{level}}}
Kategori: {{{category}}}

Ders şunları içermeli:
- title: Başlık
- learningObjective: Öğrenim hedefi
- theory: Teori (2-3 paragraf)
- analysisCriteria: Başarı kriterleri (Tam 3 adet)
- practiceTask: Pratik görevi
- auroNote: Uzman notu
- imageHint: Görsel için 3-4 İngilizce anahtar kelime

Dil: tr
`
})

export async function generateDailyLesson(input: z.infer<typeof InputSchema>) {
 const { output } = await lessonPrompt(input);

 if (!output || output.length === 0) throw new Error("Ders üretimi başarısız oldu.");

 const lesson = output[0];
 
 // Mevcut görsel üretim akışını kullanıyoruz
 const base64 = await generateLessonImage(lesson.imageHint);

 return {
  ...lesson,
  level: input.level,
  category: input.category,
  generatedImageBase64: base64,
  createdAt: new Date().toISOString()
 };
}
