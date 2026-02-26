
'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, DocumentData, FirestoreError, QuerySnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { useAuth } from '@/lib/firebase/provider';
import { FirestorePermissionError } from '@/lib/firebase/errors';

export type WithId<T> = T & { id: string };

export function useCollection<T = any>(query: any): { 
  data: WithId<T>[] | null; 
  isLoading: boolean; 
  error: any 
} {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    // 1. Guard: Auth veya Query yoksa dur
    if (!currentUser?.uid || !query) {
      setIsLoading(false);
      return;
    }

    // 2. Dev-only Memoization Check
    if (process.env.NODE_ENV === 'development' && !query.__memo) {
      console.warn("Firebase query is not memoized! Use useMemoFirebase.");
    }

    setIsLoading(true);

    // 3. Gerçek Zamanlı Dinleyici
    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results = snapshot.docs.map((doc) => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        
        setData(results);
        setIsLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        // Zengin içerikli izin hatası oluşturulur ve yayılır
        let path = 'unknown';
        try {
            // Path bilgisini Query nesnesinden ayıkla
            if (query.path) {
                path = query.path;
            } else if (query._query && query._query.path) {
                path = query._query.path.segments.join('/');
            }
        } catch (e) {}

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: path,
        });

        setError(contextualError);
        setIsLoading(false);

        // Global dinleyiciye gönderilir
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    // Cleanup: Bileşen kapandığında veya query değiştiğinde dinlemeyi kes
    return () => unsubscribe();
  }, [query, currentUser?.uid]);

  return { data, isLoading, error };
}
