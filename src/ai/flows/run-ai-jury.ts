'use server';

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export type JuryPhotoInput = {
  id: string;
  url: string;
};

export type RunAiJuryInput = {
  photos: JuryPhotoInput[];
  theme: string;
  description: string;
  language: string;
};

export type JuryEvaluation = {
  photo_id: string;
  score: number;
  comment: string;
};

export type JuryRanking = {
  position: number;
  photo_id: string;
  reason: string;
};

export type RunAiJuryOutput = {
  evaluations: JuryEvaluation[];
  ranking: JuryRanking[];
};

/**
 * AI Jury Flow.
 * Evaluates photos, ranks top 3, and runs twice to average scores (Bias Reduction).
 */
export async function runAiJury(
  input: RunAiJuryInput
): Promise<RunAiJuryOutput> {
  
  const langMap: Record<string, string> = {
    tr: "Turkish",
    en: "English"
  };
  const fullLanguage = langMap[input.language] || input.language;

  const prompt = `
Sen profesyonel bir fotoğraf yarışması jürisisin.

Amaç:
- Fotoğrafları adil ve objektif şekilde değerlendirmek
- İlk 3 fotoğrafı belirlemek
- Kararlarını kısa ve net şekilde açıklamak

YARIŞMA BİLGİLERİ:
Konu: "${input.theme}"
Açıklama: "${input.description}"

KURALLAR:
- Duygusal değil, profesyonel ol
- Gereksiz uzun yazma
- Fotoğrafları birbirleriyle kıyasla
- Sadece verilen kriterlere göre değerlendir (Kompozisyon, Işık kullanımı, Teknik kalite, Anlatım / etki)

Respond ONLY in the following language: ${fullLanguage}

ÇIKTI FORMATI (JSON):
{
  "evaluations": [
    {
      "photo_id": "id",
      "score": 0-100,
      "comment": "kısa yorum"
    }
  ],
  "ranking": [
    { "position": 1, "photo_id": "id", "reason": "neden 1. olduğu" },
    { "position": 2, "photo_id": "id", "reason": "neden 2. olduğu" },
    { "position": 3, "photo_id": "id", "reason": "neden 3. olduğu" }
  ]
}

DEĞERLENDİRİLECEK FOTOĞRAFLAR:
`;

  // Helper to run a single completion
  const singleRun = async () => {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...input.photos.map(p => ({
              type: "image_url" as const,
              image_url: { url: p.url, detail: "low" as const }, // Use low detail for batch if many photos
            })),
            { type: "text", text: `\n\nIDs mapped to images in order: ${input.photos.map(p => p.id).join(", ")}` }
          ],
        },
      ],
    });

    const raw = res.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as RunAiJuryOutput;
  };

  try {
    // 🛡️ Double-Run Average Strategy (Bonus)
    const [run1, run2] = await Promise.all([singleRun(), singleRun()]);

    // Average the evaluations
    const averagedEvaluations: JuryEvaluation[] = input.photos.map(p => {
      const e1 = run1.evaluations.find(e => e.photo_id === p.id);
      const e2 = run2.evaluations.find(e => e.photo_id === p.id);
      
      const score1 = e1?.score || 0;
      const score2 = e2?.score || 0;

      return {
        photo_id: p.id,
        score: (score1 + score2) / 2,
        comment: e1?.comment || e2?.comment || ""
      };
    });

    // Re-rank based on averaged scores
    const sorted = [...averagedEvaluations].sort((a, b) => b.score - a.score);
    const top3 = sorted.slice(0, 3);

    const averagedRanking: JuryRanking[] = top3.map((e, index) => {
        // Try to find reason from original runs
        const r1 = run1.ranking.find(r => r.photo_id === e.photo_id);
        const r2 = run2.ranking.find(r => r.photo_id === e.photo_id);
        
        return {
            position: index + 1,
            photo_id: e.photo_id,
            reason: r1?.reason || r2?.reason || "High averaged score across multiple evaluation passes."
        };
    });

    return {
      evaluations: averagedEvaluations,
      ranking: averagedRanking
    };

  } catch (e: any) {
    throw new Error("AI Jury failed: " + e.message);
  }
}
