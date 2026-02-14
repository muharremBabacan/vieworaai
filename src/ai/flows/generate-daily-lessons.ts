'use server';
/**
 * @fileOverview AI flow for generating daily photography lessons based on a structured curriculum.
 *
 * This file defines a Genkit flow that connects to a Google AI model
 * to generate a set of five photography lessons based on a detailed, multi-level curriculum.
 * The flow is designed to be triggered by an admin action to populate the Viewora Academy
 * with fresh, dynamic, and structured content.
 *
 * - generateDailyLessons: The main exported function that initiates the lesson generation flow.
 * - GeneratedLesson: The TypeScript type definition for a single lesson object returned by the AI.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for a single generated lesson, based on the user's provided curriculum.
// This ensures the AI's output is structured and type-safe.
const GeneratedLessonSchema = z.object({
  level: z.string().describe("The level of the lesson. Must be one of: 'Temel', 'Orta', 'İleri'."),
  category: z.string().describe("The specific category from the curriculum (e.g., 'Pozlama Temelleri', 'Görsel Hikâye Anlatımı', 'Profesyonel Işık Kurulumu')."),
  title: z.string().describe('The title of the lesson, corresponding to a sub-point in the curriculum.'),
  learningObjective: z.string().describe("What skill the user will gain from this specific lesson."),
  theory: z.string().describe("Explain the lesson's topic in its simplest form, in 3-4 friendly and solution-oriented sentences."),
  analysisCriteria: z.array(z.string()).length(3).describe("List 3 technical criteria for a photo to be considered 'successful' according to this lesson."),
  practiceTask: z.string().describe("Give the user a specific, actionable shooting task related to the lesson."),
  auroNote: z.string().describe("The 'Auro Note'. Explain why this specific analysis will provide a professional perspective to the user."),
  imageHint: z.string().describe("Provide 1-2 relevant English keywords for finding a suitable stock photo for this lesson (e.g., 'aperture f-stop', 'leading lines composition').")
});

// The final output of the flow is an array of lesson objects.
const GenerateLessonsOutputSchema = z.array(GeneratedLessonSchema);
export type GeneratedLesson = z.infer<typeof GeneratedLessonSchema>;

/**
 * The main function to be called from the application to trigger the lesson generation process.
 * It invokes the Genkit flow and returns a promise that resolves to an array of generated lessons.
 */
export async function generateDailyLessons(): Promise<GeneratedLesson[]> {
    return generateLessonsFlow();
}

// Define the prompt for the AI model, specifying the desired output schema.
const generationPrompt = ai.definePrompt({
    name: 'structuredCurriculumPrompt',
    output: { schema: GenerateLessonsOutputSchema },
    prompt: `You are the head instructor of Viewora AI Coach. Your task is to generate FIVE (5) distinct mini-lessons in TURKISH, based on the structured curriculum provided below.

Ensure the generated lessons are diverse, covering different levels (Temel, Orta, İleri) and different categories within those levels.

**CURRICULUM:**

📸 **TEMEL SEVİYE (Foundation)**
Amaç: Kamera kontrolü + ışık + temel kompozisyon hakimiyeti.
- **Fotoğrafçılığa Giriş:** Fotoğraf makinesi türleri, Sensör, Lens türleri, Odak uzaklığı, Çekim modları.
- **Pozlama Temelleri:** Diyafram, Enstantane, ISO, Pozlama üçgeni, Histogram okuma.
- **Netlik ve Odaklama:** Manuel/Oto odak, Netleme noktaları, Alan derinliği, Hareketli obje netleme.
- **Temel Kompozisyon:** Üçler kuralı, Kadrajlama, Simetri, Negatif alan, Ufuk çizgisi.
- **Işık Bilgisi:** Doğal ışık, Altın saat, Sert / yumuşak ışık, Gölge kullanımı, Reflektör.

📷 **ORTA SEVİYE (Applied Control)**
Amaç: Tür bazlı teknik kontrol + bilinçli estetik üretim.
- **Tür Bazlı Çekim Teknikleri:** Manzara, Portre, Sokak, Gece, Makro başlangıç.
- **İleri Pozlama Teknikleri:** Uzun pozlama, HDR, Bracketing, Pan tekniği, Hareket dondurma.
- **Işık Yönetimi:** Yan ışık, Ters ışık, Siluet, Basit yapay ışık, Flaş temelleri.
- **Görsel Hikâye Anlatımı:** Seri fotoğraf, Duygu yakalama, Çerçeve içinde çerçeve, Katmanlı kompozisyon.
- **Post-Prodüksiyon Temelleri:** RAW vs JPEG, Renk düzeltme, Kontrast, Kırpma, Netlik.

🎯 **İLERİ SEVİYE (Mastery & Specialization)**
Amaç: Uzmanlaşma + ticari değer + sanatsal kimlik.
- **Uzmanlık Alanı Derinleşme:** Spor, Moda, Drone, Astrofotoğraf, Profesyonel makro.
- **Profesyonel Işık Kurulumu:** Stüdyo şemaları, Softbox, Rim light, 3 nokta aydınlatma, Dramatic lighting.
- **Gelişmiş Teknikler:** Focus stacking, Light painting, High speed, Çoklu pozlama, Kreatif filtre.
- **Sanatsal Kimlik ve Stil:** Tarz oluşturma, Renk paleti, Minimal vs maksimal, Konsept üretimi.
- **Ticari ve Marka Konumlandırma:** Niş seçimi, Portföy stratejisi, Fiyatlandırma, Müşteri iletişimi.

---

For each of the FIVE lessons, strictly follow this JSON format and provide the content in Turkish:

{
  "level": "The level name: 'Temel', 'Orta', or 'İleri'.",
  "category": "The specific category name from the curriculum (e.g., 'Pozlama Temelleri', 'Görsel Hikâye Anlatımı').",
  "title": "A compelling title for a specific sub-point within the category (e.g., 'Diyafram ve Alan Derinliği İlişkisi').",
  "learningObjective": "A concise learning objective for this specific title.",
  "theory": "Explain the topic simply in 3-4 solution-oriented sentences.",
  "analysisCriteria": [
    "A technical criterion for success.",
    "A second technical criterion.",
    "A third technical criterion."
  ],
  "practiceTask": "A specific, actionable shooting task for the user.",
  "auroNote": "The 'Auro Note'. Explain why this analysis will provide a professional perspective.",
  "imageHint": "Provide 1-2 relevant English keywords for finding a suitable image (e.g., 'aperture f-stop', 'portrait side light')."
}

Ensure the output is a valid JSON array containing exactly five lesson objects.
`,
});

// Define the Genkit flow that orchestrates the AI call.
const generateLessonsFlow = ai.defineFlow(
    {
        name: 'generateLessonsFlow',
        outputSchema: GenerateLessonsOutputSchema,
    },
    async () => {
        // Execute the prompt and await the structured output.
        const { output } = await generationPrompt();
        // Return the generated lessons, or an empty array if the output is null.
        return output || [];
    }
);
