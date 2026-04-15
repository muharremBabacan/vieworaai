'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { serializeData, deepCompare } from '@/lib/utils';

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

  // Loop Protection: Query Signature
  // Firestore objelerinin referansı her renderda değişebilir. 
  // Ama path ve query yapısı aynıysa listener'ı yeniden başlatmamalıyız.
  const querySignature = useMemo(() => {
    if (!queryObj) return null;
    try {
      // Query'nin iç yapısını string olarak alarak unique bir ID oluşturuyoruz
      return (queryObj as any)._query?.toString() || 'unknown-query';
    } catch (e) {
      return Math.random().toString(); // Fallback
    }
  }, [queryObj]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (!queryObj || (requireAuth && !user?.uid)) {
      if (data !== null) setData(null);
      setIsLoading(false);
      return;
    }

    // DEBUG: Listener start
    console.debug(`[useCollection] Starting ${realtime ? 'realtime' : 'one-time'} fetch for:`, querySignature);

    setIsLoading(true);
    setError(null);

    const processSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      const results = snapshot.docs.map((doc) => ({
        ...(serializeData(doc.data()) as T),
        id: doc.id,
      }));

      // LOOP PROTECTION: Sadece veri gerçekten değiştiyse state update yap
      setData(prev => {
        if (deepCompare(prev, results)) return prev;
        return results;
      });
      setIsLoading(false);
    };

    const handleError = (err: FirestoreError | any) => {
      const auth = getAuth();
      if (err?.code === 'permission-denied' && !auth.currentUser) {
        setData(null);
        setIsLoading(false);
        return;
      }

      console.error('Firestore useCollection error:', err);
      setError(err instanceof Error ? err : new Error(err?.message || 'Firestore connection error'));
      setIsLoading(false);
    };

    if (realtime) {
      unsubscribe = onSnapshot(queryObj, processSnapshot, handleError);
    } else {
      getDocs(queryObj).then(processSnapshot).catch(handleError);
    }

    return () => {
      if (realtime) {
         console.debug(`[useCollection] Unsubscribing from:`, querySignature);
         unsubscribe();
      }
    };

  // querySignature sayesinde queryObj referansı değişse bile listeleyici bozulmaz
  }, [querySignature, requireAuth, user?.uid, realtime]);

  return { data, isLoading, error };
}