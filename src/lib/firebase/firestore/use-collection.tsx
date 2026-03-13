'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  DocumentData,
  FirestoreError,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useUser } from '@/lib/firebase/provider';

export type WithId<T> = T & { id: string };

interface UseCollectionOptions {
  requireAuth?: boolean;
}

export function useCollection<T = any>(
  query: Query<DocumentData> | null | undefined,
  options: UseCollectionOptions = {}
): {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
} {

  const { requireAuth = false } = options;
  const { user } = useUser();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {

    if (!query || (requireAuth && !user?.uid)) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      query,

      (snapshot: QuerySnapshot<DocumentData>) => {

        const results = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));

        setData(results);
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

        console.error('Firestore useCollection error:', err);

        if (err.code === 'failed-precondition') {
          setError(
            new Error(
              'Veritabanı indeksleri hazırlanıyor. Lütfen birkaç dakika sonra tekrar deneyin.'
            )
          );
        } else {
          setError(err);
        }

        setIsLoading(false);
      }
    );

    return () => unsubscribe();

  }, [query, requireAuth, user?.uid]);

  return { data, isLoading, error };
}