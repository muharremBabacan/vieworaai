'use client';

import { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  DocumentData,
  FirestoreError,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';
import { useAuth } from '@/lib/firebase/provider';
import { FirestorePermissionError } from '@/lib/firebase/errors';
import { errorEmitter } from '@/lib/firebase/error-emitter';

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
  const { user } = useAuth();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Synchronous cleanup of previous listener to avoid internal assertion errors
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!query) {
      setIsLoading(false);
      setData(null);
      return;
    }

    if (requireAuth && !user?.uid) {
      setIsLoading(false);
      setData(null);
      return;
    }

    if (
      process.env.NODE_ENV === 'development' &&
      (query as any)?.__memo !== true
    ) {
      console.warn(
        '⚠ Firebase query is not memoized! Use useMemoFirebase to avoid redundant listeners.'
      );
    }

    setIsLoading(true);

    try {
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
          console.error("🔥 FIRESTORE ERROR:", err.code, err.message);

          let path = 'unknown';
          try {
            if ((query as any)?.path) {
              path = (query as any).path;
            } else if ((query as any)?._query?.path) {
              path = (query as any)._query.path.segments.join('/');
            }
          } catch {}

          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: path,
          });

          setError(contextualError);
          setIsLoading(false);
          errorEmitter.emit('permission-error', contextualError);
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (e) {
      console.error("🔥 Snapshot setup failed:", e);
      setIsLoading(false);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query, requireAuth, user?.uid]);

  return { data, isLoading, error };
}