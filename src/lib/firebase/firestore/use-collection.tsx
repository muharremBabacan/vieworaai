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
import { useUser } from '@/lib/firebase/client-provider';
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
  const { user, isFirebaseReady } = useUser();

  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Loop Protection: Query Signature
  // Firestore objects change references on every query() call.
  const querySignature = useMemo(() => {
    if (!queryObj) return null;
    try {
      // Try to get internal query info for stabilization
      const q = (queryObj as any)._query || (queryObj as any).query;
      if (q) {
        // Path + Filters + Orders + Limit
        const parts = [
          q.path?.toString() || '',
          JSON.stringify(q.filters || []),
          JSON.stringify(q.explicitOrderBy || []),
          q.limit || 'no-limit'
        ];
        return parts.join('|');
      }
      // Fallback for document references or other structures
      return (queryObj as any).path || (queryObj as any).toString(); 
    } catch (e) {
      return 'static-query-fallback'; 
    }
  }, [queryObj]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (!queryObj || (requireAuth && !isFirebaseReady)) {
      if (data !== null) {
        setData(null);
        setIsLoading(false);
      }
      return;
    }

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
      // Permission errors are common during auth transitions, keep them silent unless persistent
      if (err?.code !== 'permission-denied') {
        console.error('Firestore useCollection error:', err);
      }
      setError(err instanceof Error ? err : new Error(err?.message || 'Firestore connection error'));
      setIsLoading(false);
    };

    if (realtime) {
      unsubscribe = onSnapshot(queryObj, processSnapshot, handleError);
    } else {
      getDocs(queryObj).then(processSnapshot).catch(handleError);
    }

    return () => {
      if (realtime) unsubscribe();
    };

  }, [querySignature, requireAuth, isFirebaseReady, realtime]);

  return { data, isLoading, error };
}