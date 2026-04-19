import { initializeFirebase } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { GeneratedAcademyLesson } from '@/ai/flows/lesson/generate-academy-lessons';

export async function saveLessons(lessons: GeneratedAcademyLesson[]) {

  const { firestore } = initializeFirebase();

  if (!firestore) {
    throw new Error("Firestore not initialized");
  }

  const lessonCollection = collection(firestore, "academy_lessons");

  for (const lesson of lessons) {

    await addDoc(lessonCollection, {
      ...lesson,

      is_free: true,
      token_cost: 0,

      createdAt: serverTimestamp()
    });

  }
}