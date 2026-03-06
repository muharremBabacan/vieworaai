import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { GeneratedLesson } from '@/ai/flows/generateLessons';

export async function saveLessons(lessons: GeneratedLesson[]) {

  const lessonCollection = collection(db, "academy_lessons");

  for (const lesson of lessons) {

    await addDoc(lessonCollection, {
      ...lesson,

      is_free: true,
      token_cost: 0,

      createdAt: serverTimestamp()
    });

  }
}