'use server'

import { ai } from '@/ai/genkit'
import { z } from 'genkit'

import { db, storage } from '@/lib/firebase'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'

import { generateLessonImage } from '../image/generateLessonImages'

const InputSchema = z.object({
 level:z.enum(['Temel','Orta','İleri']),
 category:z.string()
})

const LessonSchema = z.object({

 title:z.string(),
 learningObjective:z.string(),
 theory:z.string(),

 analysisCriteria:z.array(z.string()).length(3),

 practiceTask:z.string(),
 authorNote:z.string(),

 imageHint:z.string()

})

const OutputSchema = z.array(LessonSchema).length(1)

const lessonPrompt = ai.definePrompt({

 name:"vieworaLessonGenerator",

 input:{schema:InputSchema},
 output:{schema:OutputSchema},

 prompt:`

Generate ONE photography lesson.

Return JSON only.

{
"title":"",
"learningObjective":"",
"theory":"",
"analysisCriteria":["","",""],
"practiceTask":"",
"authorNote":"",
"imageHint":"two keyword phrase"
}

`

})

export async function generateDailyLesson(input:z.infer<typeof InputSchema>){

 const {output} = await lessonPrompt(input)

 if(!output) throw new Error("Lesson generation failed")

 const lesson = output[0]

 const imagePrompt = `
 photography education illustration
 ${lesson.imageHint}
 clean background
 minimal infographic style
 `

 const base64 = await generateLessonImage(imagePrompt)

 const lessonId = crypto.randomUUID()

 const storageRef = ref(storage,`academy-lessons/${lessonId}.jpg`)

 await uploadString(storageRef,base64,"base64")

 const imageUrl = await getDownloadURL(storageRef)

 const lessonDoc = {

  ...lesson,

  level:input.level,
  category:input.category,

  imageUrl,

  createdAt:serverTimestamp()

 }

 await setDoc(doc(collection(db,"academy_lessons"),lessonId),lessonDoc)

 return lessonDoc

}