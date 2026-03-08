'use server'

import { initializeApp, getApps } from "firebase/app"
import { getAI, getGenerativeModel } from "firebase/ai"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export async function generateLessonImage(prompt: string) {

  const ai = getAI(app)

  const model = getGenerativeModel(ai, {
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  })

  const result = await model.generateContent(prompt)

  const parts = result.response.candidates?.[0]?.content?.parts

  const imagePart = parts?.find((p: any) => p.inlineData)

  const base64 = imagePart?.inlineData?.data

  if (!base64) {
    console.error(result)
    throw new Error("Image generation failed")
  }

  return base64
}