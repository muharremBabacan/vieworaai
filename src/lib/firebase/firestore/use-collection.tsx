'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  DocumentData,
  FirestoreError,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';
import { useAuth } from '@/lib/firebase/provider';

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
  const { currentUser } = useAuth();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 1️⃣ Query yoksa çık
    if (!query) {
      setIsLoading(false);
      return;
    }

    // 2️⃣ Auth gerekiyorsa ama yoksa bekle
    if (requireAuth && !currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    // 3️⃣ Dev memo check
    if (
      process.env.NODE_ENV === 'development' &&
      (query as any)?.__memo !== true
    ) {
      console.warn(
        '⚠ Firebase query is not memoized! Use useMemoFirebase.'
      );
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));

        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        console.error("🔥 RAW FIRESTORE ERROR:", err);
        console.error("🔥 Error Code:", err.code);
        console.error("🔥 Error Message:", err.message);

        // Path bilgisi ayıklamaya çalış
        let path = 'unknown';
        try {
          if ((query as any)?.path) {
            path = (query as any).path;
          } else if ((query as any)?._query?.path) {
            path = (query as any)._query.path.segments.join('/');
          }
        } catch {}

        console.error("🔥 Query Path:", path);

        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query, requireAuth, currentUser?.uid]);

  return { data, isLoading, error };
}