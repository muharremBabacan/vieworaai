'use client';

import { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  DocumentData,
  FirestoreError,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';
import { useUser } from '@/lib/firebase/provider';
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
  const { user } = useUser();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!query || (requireAuth && !user?.uid)) {
      setIsLoading(false);
      setData(null);
      return;
    }

    setIsLoading(true);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

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
        if (err.code === 'permission-denied') {
          let path = 'unknown';
          try {
            path = (query as any)._query?.path?.segments?.join('/') || (query as any).path || 'unknown';
          } catch {}

          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: path,
          });

          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } 
        else if (err.code === 'failed-precondition') {
          const indexError = new Error(
            'Firestore composite index eksik. Arka planda dağıtılıyor, lütfen bekleyin.'
          );
          
          if (process.env.NODE_ENV === 'development') {
            const match = err.message.match(/https:\/\/console\.firebase\.google\.com\S+/);
            if (match) {
              console.warn('👉 BU SORGUNUN ÇALIŞMASI İÇİN INDEX OLUŞTURUN:', match[0]);
            }
          }

          setError(indexError);
        } 
        else {
          setError(err);
        }
        
        setIsLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query, requireAuth, user?.uid]);

  return { data, isLoading, error };
}
