'use server';
/**
 * @fileOverview A photo analysis AI agent that provides feedback and ratings.
 *
 * - analyzePhotoAndSuggestImprovements - A function that handles the photo analysis process.
 * - AnalyzePhotoAndSuggestImprovementsInput - The input type for the analyzePhotoAndSuggestImprovements function.
 * - AnalyzePhotoAndSuggestImprovementsOutput - The return type for the analyzePhotoAndSuggestImprovements function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzePhotoAndSuggestImprovementsInputSchema = z.object({
  photoUrl: z
    .string()
    .url()
    .describe(
      "A publicly accessible HTTPS URL of the photo to analyze."
    ),
});
export type AnalyzePhotoAndSuggestImprovementsInput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsInputSchema>;

const AnalyzePhotoAndSuggestImprovementsOutputSchema = z.object({
  analysis: z.string().describe('Provide a comprehensive, constructive, and friendly analysis of the photo, as if you were a photography coach. Discuss the strengths and weaknesses of the image in Turkish.'),
  improvements: z
    .array(z.string())
    .describe('Provide a list of 3 concrete, actionable suggestions for improvement in Turkish.'),
  rating: z
    .object({
      lighting: z.number().min(1).max(10).describe('Rate the lighting on a scale of 1-10.'),
      composition: z.number().min(1).max(10).describe('Rate the composition on a scale of 1-10.'),
      emotion: z.number().min(1).max(10).describe('Rate the emotional impact or storytelling on a scale of 1-10.'),
      overall: z.number().min(1).max(10).describe('Provide an overall rating for the photo on a scale of 1-10, based on the other criteria.'),
    })
    .describe('Provide ratings for the photo based on the specified criteria.'),
  tags: z.array(z.string()).max(10).describe('Provide up to 10 relevant tags in Turkish for the photo\'s content, style, and mood (e.g., "portre", "manzara", "sokak fotoğrafçılığı", "siyah beyaz", "minimalist", "mutlu").'),
  cameraType: z.enum(['Profesyonel', 'Mobil', 'Bilinmiyor']).describe("Fotoğrafın muhtemelen profesyonel bir kamera (DSLR, Aynasız) ile mi yoksa bir cep telefonu ile mi çekildiğini belirleyin. Anlaşılması imkansızsa 'Bilinmiyor' kullanın."),
  cameraMake: z.string().describe("Tahmin edilen kamera markası (örn: 'Apple', 'Sony', 'Canon'). Emin değilseniz 'Bilinmiyor' kullanın."),
  cameraModel: z.string().describe("Tahmin edilen kamera modeli (örn: 'iPhone 15 Pro', 'A7 IV', 'EOS R5'). Emin değilseniz 'Bilinmiyor' kullanın."),
});
export type AnalyzePhotoAndSuggestImprovementsOutput = z.infer<typeof AnalyzePhotoAndSuggestImprovementsOutputSchema>;

// The main function that the application calls.
export async function analyzePhotoAndSuggestImprovements(
  input: AnalyzePhotoAndSuggestImprovementsInput
): Promise<AnalyzePhotoAndSuggestImprovementsOutput> {
  return analysisFlow(input);
}

const analysisPrompt = ai.definePrompt({
  name: 'photoAnalysisPrompt',
  input: {schema: AnalyzePhotoAndSuggestImprovementsInputSchema},
  output: {schema: AnalyzePhotoAndSuggestImprovementsOutputSchema},
  prompt: `You are a world-class photography coach named Viewora AI. Your tone is encouraging, insightful, and professional. Analyze the provided photograph and respond in Turkish.

  Your task is to provide a detailed analysis, actionable improvement tips, a rating, and detailed camera information.

  **Kamera Analizi:** Alan derinliği, görüntü kalitesi, lens bozulması gibi görsel ipuçlarına dayanarak aşağıdaki alanları doldur:
  - \`cameraType\`: Fotoğrafın 'Profesyonel' bir kamera mı yoksa 'Mobil' bir cihazla mı çekildiğini belirle.
  - \`cameraMake\`: Kameranın markasını tahmin et (örn: 'Apple', 'Sony', 'Canon').
  - \`cameraModel\`: Kameranın modelini tahmin et (örn: 'iPhone 15 Pro', 'A7 IV', 'EOS R5').
  Marka veya modelden emin değilsen, ilgili alan için 'Bilinmiyor' değerini kullan.

  **IMPORTANT INSTRUCTIONS for the 'tags' field:**
  1.  Generate tags related ONLY to photography concepts. These include:
      *   **Genre:** (MUST BE THE FIRST TAG) e.g., "Portre", "Manzara", "Sokak", "Makro", "Mimari", "Soyut".
      *   **Style/Technique:** e.g., "Siyah Beyaz", "Minimalist", "Uzun Pozlama", "Alan Derinliği".
      *   **Composition:** e.g., "Simetri", "Öncü Çizgiler", "Negatif Alan".
      *   **Lighting:** e.g., "Sert Işık", "Yumuşak Işık", "Altın Saat", "Ters Işık".
      *   **Mood/Emotion:** e.g., "Huzurlu", "Dramatik", "Neşeli", "Gizemli".
  2.  **DO NOT** add tags describing physical objects or people in the photo (e.g., "kadın", "ağaç", "yüzük", "deniz"). Focus strictly on photographic attributes.
  3.  Provide up to 10 relevant tags in Turkish.

  Analyze the photo provided: {{media url=photoUrl}}`,
});

const analysisFlow = ai.defineFlow(
  {
    name: 'analysisFlow',
    inputSchema: AnalyzePhotoAndSuggestImprovementsInputSchema,
    outputSchema: AnalyzePhotoAndSuggestImprovementsOutputSchema,
  },
  async (input) => {
    const {output} = await analysisPrompt(input);
    return output!;
  }
);
