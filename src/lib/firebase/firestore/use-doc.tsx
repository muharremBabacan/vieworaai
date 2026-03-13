'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {

  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {

    if (!memoizedDocRef) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedDocRef,

      (snapshot: DocumentSnapshot<DocumentData>) => {

        if (snapshot.exists()) {
          setData({
            ...(snapshot.data() as T),
            id: snapshot.id,
          });
        } else {
          setData(null);
        }

        setIsLoading(false);
      },

      (err: FirestoreError) => {

        const auth = getAuth();

        // Logout sırasında gelen permission hatasını ignore et
        if (err.code === 'permission-denied' && !auth.currentUser) {
          setData(null);
          setIsLoading(false);
          return;
        }

        console.error('Firestore useDoc error:', err);

        setError(err);
        setData(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();

  }, [memoizedDocRef]);

  return {
    data,
    isLoading,
    error,
  };
}