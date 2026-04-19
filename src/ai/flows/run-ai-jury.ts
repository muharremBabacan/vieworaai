'use server';

import OpenAI from "openai";




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
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[BuildTime] OPENAI_API_KEY missing - skipping jury (Safe during Build).');
    if (process.env.NODE_ENV === 'production') throw new Error('RUNTIME_CONFIG_ERROR: OPENAI_API_KEY missing');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
  
  const langMap: Record<string, string> = {
    tr: "Turkish",
    en: "English"
  };
  const fullLanguage = langMap[input.language] || input.language;

  const systemPrompt = `
Sen profesyonel bir fotoğraf yarışması jürisisin.
İşin: Fotoğrafları adil, objektif ve profesyonel kriterlere göre (Kompozisyon, Işık, Teknik, Anlatım) değerlendirmek.

MANDATORY RULES:
1. Respond ONLY in valid JSON format.
2. Provide evaluations for ALL provided photos.
3. Ranking must include exactly the top 3 photos.
4. All text (comments, reasons) must be in the following language: ${fullLanguage}.
5. Do not include any conversational text or explanations outside the JSON.
`;

  const userPrompt = `
YARIŞMA BİLGİLERİ:
Konu: "${input.theme}"
Açıklama: "${input.description}"

GÖREV:
- Fotoğrafları birbirleriyle kıyasla.
- Her fotoğrafa 0-100 arası bir puan ver.
- İlk 3 fotoğrafı belirle.

JSON FORMAT:
{
  "evaluations": [
    { "photo_id": "id", "score": 0-100, "comment": "string" }
  ],
  "ranking": [
    { "position": 1, "photo_id": "id", "reason": "string" },
    { "position": 2, "photo_id": "id", "reason": "string" },
    { "position": 3, "photo_id": "id", "reason": "string" }
  ]
}

IDs of images provided below: ${input.photos.map(p => p.id).join(", ")}
`;

  // Helper to run a single completion
  const singleRun = async () => {
    const res = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3, // Lower temperature for more consistent JSON
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            ...input.photos.map(p => ({
              type: "image_url" as const,
              image_url: { url: p.url, detail: "low" as const },
            })),
          ],
        },
      ],
    });

    const raw = res.choices[0]?.message?.content || "";
    try {
      // Clean potential markdown blocks just in case, though json_object mode usually avoids them
      const clean = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(clean) as RunAiJuryOutput;
    } catch (parseError: any) {
      console.error("[AI Jury] JSON Parse Error. Raw content:", raw);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
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
