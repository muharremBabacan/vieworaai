'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  getDocs,
  DocumentData,
  FirestoreError,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useUser } from '@/lib/firebase/provider';
import { serializeData } from '@/lib/utils';

export type WithId<T> = T & { id: string };

interface UseCollectionOptions {
  requireAuth?: boolean;
  realtime?: boolean;
}

export function useCollection<T = any>(
  queryObj: Query<DocumentData> | null | undefined,
  options: UseCollectionOptions = {}
): {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
} {

  const { requireAuth = false, realtime = true } = options;
  const { user } = useUser();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (!queryObj || (requireAuth && !user?.uid)) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const processSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      const results = snapshot.docs.map((doc) => ({
        ...(serializeData(doc.data()) as T),
        id: doc.id,
      }));

      setData(results);
      setIsLoading(false);
    };

    const handleError = (err: FirestoreError | any) => {
      const auth = getAuth();

      // Logout sırasında gelen permission hatasını ignore et
      if (err.code === 'permission-denied' && !auth.currentUser) {
        setData(null);
        setIsLoading(false);
        return;
      }

      console.error('Firestore useCollection error:', err);

      if (err.code === 'failed-precondition') {
        setError(
          new Error(
            'Veritabanı indeksleri hazırlanıyor. Lütfen birkaç dakika sonra tekrar deneyin.'
          )
        );
      } else {
        setError(err instanceof Error ? err : new Error(err.message || 'Firestore connection error'));
      }

      setIsLoading(false);
    };

    if (realtime) {
      unsubscribe = onSnapshot(queryObj, processSnapshot, handleError);
    } else {
      getDocs(queryObj)
        .then(processSnapshot)
        .catch(handleError);
    }

    return () => {
      if (realtime) unsubscribe();
    };

  }, [queryObj, requireAuth, user?.uid, realtime]);

  return { data, isLoading, error };
}