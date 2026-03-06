import { ai } from "@/ai/genkit";
import { initializeFirebase } from "@/lib/firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

const { storage } = initializeFirebase();

type ImagePrompts = {
  cover: string;
  goodExample1: string;
  goodExample2: string;
  badExample: string;
  analysis: string;
};

type LessonImages = {
  cover: string;
  goodExample1: string;
  goodExample2: string;
  badExample: string;
  analysis: string;
};

async function generateAndUpload(
  prompt: string,
  lessonId: string,
  name: string
): Promise<string> {

  if (!storage) {
    throw new Error("Storage not initialized");
  }

  // Imagen model ile image üret
  const result = await ai.generate({
    model: "vertexai/imagen-3.0-generate-001",
    prompt,
  });

  const base64 = result.media?.data;

  if (!base64) {
    throw new Error("Image generation failed");
  }

  const storageRef = ref(
    storage,
    `academy-lessons/${lessonId}/${name}.jpg`
  );

  await uploadString(storageRef, base64, "base64");

  const url = await getDownloadURL(storageRef);

  return url;
}

export async function generateLessonImages(
  prompts: ImagePrompts,
  lessonId: string
): Promise<LessonImages> {

  const cover = await generateAndUpload(
    prompts.cover,
    lessonId,
    "cover"
  );

  const goodExample1 = await generateAndUpload(
    prompts.goodExample1,
    lessonId,
    "good1"
  );

  const goodExample2 = await generateAndUpload(
    prompts.goodExample2,
    lessonId,
    "good2"
  );

  const badExample = await generateAndUpload(
    prompts.badExample,
    lessonId,
    "bad"
  );

  const analysis = await generateAndUpload(
    prompts.analysis,
    lessonId,
    "analysis"
  );

  return {
    cover,
    goodExample1,
    goodExample2,
    badExample,
    analysis,
  };
}