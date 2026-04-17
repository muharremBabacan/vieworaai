'use server';

import OpenAI from "openai";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { firebaseConfig } from "@/lib/firebase/config";

export type GeneratedAcademyLesson = {
  title: string;
  learningObjective: string;
  theory: string;
  analysisCriteria: string[];
  practiceTask: string;
  auroNote: string;
  imageHint: string;
};

export async function generateAcademyLessons(input: {
  level: string;
  category: string;
  topics: string[];
  language?: string;
  count?: number;
  seedLesson?: {
    title: string;
    type: string;
    description?: string;
    skills?: string[];
  };
}): Promise<GeneratedAcademyLesson[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[BuildTime] OPENAI_API_KEY missing - skipping lesson generation (Safe during Build).');
    if (process.env.NODE_ENV === 'production') return [];
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  // Initialize Firebase locally within the function
  const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(firebaseApp);

  const langMap: Record<string, string> = {
    tr: "Turkish", en: "English", es: "Spanish", fr: "French",
    de: "German", ru: "Russian", ar: "Arabic", zh: "Chinese", ja: "Japanese"
  };

  const language = langMap[input.language || "tr"] || input.language || "Turkish";
  const count = input.count || 1;

  console.log(`[AI] ${input.level} - ${input.category} için ${count} ders üretiliyor...`);

  // 1. FETCH CURRICULUM RULES FROM FIRESTORE
  let curriculum: any = {};
  try {
    const curriculumSnap = await getDoc(doc(db, "academy_curriculum", input.category));
    if (curriculumSnap.exists()) {
      curriculum = curriculumSnap.data();
      console.log("[AI] Curriculum rules loaded:", curriculum.rules);
    }
  } catch (err) {
    console.warn("[AI] Curriculum fetch failed, using defaults (Typical during Build or if Firestore restricted):", err);
  }

  // 2. MAP LEVEL TO PEDAGOGICAL STYLE
  const levelMap: Record<string, string> = {
    "Temel": "Beginner/Foundational - simple, visual, easy explanation",
    "Orta": "Intermediate/Practical - technique-focused, practical scenarios",
    "İleri": "Advanced/Technical - professional settings, artistic nuance",
    "Profesyonel": "Expert/Industry - commercial workflows, deep technicality"
  };

  // 3. CONSTRUCT TEACHING PROMPT
  const isAnchored = !!input.seedLesson;
  const targetTitle = input.seedLesson?.title || input.topics[0];
  const targetType = input.seedLesson?.type || "technical";

  const prompt = `
You are Luma, the head instructor of Viewora Academy. 
This is a REAL LESSON for professional photographers. Your goal is to TEACH, not describe a course.

ANCHOR:
${isAnchored ? `Target Lesson: "${targetTitle}" (Type: ${targetType})` : `General Topic: ${targetTitle}`}
${input.seedLesson?.description ? `Context/Focus: ${input.seedLesson.description}` : ""}
${input.seedLesson?.skills ? `Target Skills: ${input.seedLesson.skills.join(", ")}` : ""}

CONTEXT:
Level: ${levelMap[input.level] || input.level}
Category: ${input.category}
Topics to cover:
${input.topics.map(t => `- ${t}`).join('\n')}

STYLE & RULES:
- Teaching Style: ${curriculum.style || "teaching-focused"}
- Min Theory Length: ${curriculum.rules?.minTheoryLength || 5} paragraphs/blocks
- Use Real Examples: ${curriculum.rules?.realExamples ?? true}
- Avoid Generic Text: ${curriculum.rules?.noGenericText ?? true}

STRICT INSTRUCTIONS:
- Directly teach the concepts. Instead of saying "you will learn X", explain "X is used when...".
- Use professional photography terminology (F-stops, bokeh, dynamic range, composition rules).
- Be detailed. Each theory section must be a deep dive into the subject.
- Language: ${language}

JSON STRUCTURE (Return an array of ${count} objects):
- title: ${isAnchored ? `MUST BE EQUAL TO "${targetTitle}"` : "Engaging, specific title"}
- learningObjective: What will they MASTER after this lesson?
- theory: Comprehensive teaching content (detailed, non-generic)
- analysisCriteria: 3 specific points for AI image evaluation
- practiceTask: A specific photo assignment for the student
- auroNote: Professional tip or encouragement
- imageHint (3-4 English keywords for prompt, SEPARATED BY SPACES)

Return ONLY a valid JSON array.
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: "Professional Photography Instructor. Return ONLY valid JSON array. No markdown." },
        { role: "user", content: prompt }
      ],
    });

    const raw = res.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return (Array.isArray(parsed) ? parsed : (parsed.lessons || [])) as GeneratedAcademyLesson[];
  } catch (error) {
    console.error("[AI] Lesson generation error:", error);
    return [];
  }
}


// 🔥 IMAGE (DEĞİŞMEDİ - SAĞLAM)
export async function generateLessonImage(
  userPrompt: string
): Promise<{ success: boolean; imageUrl: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { success: false, imageUrl: "/fallback.jpg" };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  console.log("PROMPT:", userPrompt);

  const finalPrompt = `professional photography, ${userPrompt}, natural light, realistic, minimalist background`;

  try {
    const res = await (openai.images as any).generate({
      model: "gpt-image-1.5",
      prompt: finalPrompt,
      size: "1024x1024"
    });

    const img = res.data?.[0];

    if (!img) {
      console.error("[IMAGE] boş response");
      return { success: false, imageUrl: "/fallback.jpg" };
    }

    if (img.b64_json) {
      return {
        success: true,
        imageUrl: img.b64_json.startsWith('data:')
          ? img.b64_json
          : `data:image/png;base64,${img.b64_json}`
      };
    }

    if (img.url) {
      return {
        success: true,
        imageUrl: img.url
      };
    }

    console.error("[IMAGE] format tanınmadı");
    return { success: false, imageUrl: "/fallback.jpg" };

  } catch (error: any) {
    console.error("[IMAGE ERROR]:", error.message);
    return { success: false, imageUrl: "/fallback.jpg" };
  }
}