import 'dotenv/config'

import { initializeApp, getApps } from "firebase/app"
import { getAI, getGenerativeModel } from "firebase/ai"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

async function run() {

  const ai = getAI(app)

  const model = getGenerativeModel(ai,{
    model:"imagen-3.0-generate-001"
  })

  const prompt =
  "minimal educational illustration of camera sensor pixels explaining megapixel resolution"

  const result = await model.generateContent(prompt)

  console.log("MODEL RESPONSE:")
  console.log(result)

}

run()