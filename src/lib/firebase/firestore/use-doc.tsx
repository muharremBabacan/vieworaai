'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  getDoc,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { serializeData } from '@/lib/utils';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

interface UseDocOptions {
  realtime?: boolean;
}

export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
  options: UseDocOptions = {}
): UseDocResult<T> {
  const { realtime = true } = options;

  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (!memoizedDocRef) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const processSnapshot = (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        setData({
          ...(serializeData(snapshot.data()) as T),
          id: snapshot.id,
        });
      } else {
        setData(null);
      }
      setIsLoading(false);
    };

    const handleError = (err: FirestoreError) => {
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
    };

    if (realtime) {
      unsubscribe = onSnapshot(memoizedDocRef, processSnapshot, handleError);
    } else {
      getDoc(memoizedDocRef)
        .then(processSnapshot)
        .catch(handleError);
    }

    return () => {
      if (realtime) unsubscribe();
    };

  }, [memoizedDocRef, realtime]);

  return {
    data,
    isLoading,
    error,
  };
}