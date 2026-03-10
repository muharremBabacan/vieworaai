
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  DocumentData,
  FirestoreError,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
  const [isLoading, setIsLoading] = useState<boolean>(!!query);
  const [error, setError] = useState<Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Sorgu yoksa veya yetki gerekip kullanıcı yoksa dinleyiciyi başlatma
    if (!query || (requireAuth && !user?.uid)) {
      setData(null);
      setIsLoading(false);
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
        // Çıkış yaparken oluşan yetki hatasını yakala
        const auth = getAuth();
        if (err.code === 'permission-denied' && !auth.currentUser) {
          setData(null);
          setIsLoading(false);
          return;
        }

        // We emit a specialized error for the developer overlay instead of a simple console.error
        // which prevents confusing duplicate error states in Next.js.
        if (err.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: 'collection_query',
          });

          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } 
        else if (err.code === 'failed-precondition') {
          const indexError = new Error(
            'Veritabanı indeksleri hazırlanıyor. Lütfen birkaç dakika sonra tekrar deneyin.'
          );
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
