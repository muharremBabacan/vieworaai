'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DocumentReference,
  onSnapshot,
  getDoc,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { serializeData, deepCompare } from '@/lib/utils';
import { useUser } from '@/lib/firebase/client-provider';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

interface UseDocOptions {
  realtime?: boolean;
  requireAuth?: boolean;
}

export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
  options: UseDocOptions = {}
): UseDocResult<T> {
  const { realtime = true, requireAuth = false } = options;
  const { isFirebaseReady } = useUser();

  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  // Loop Protection: Doc Signature
  const docSignature = useMemo(() => {
    if (!memoizedDocRef) return null;
    return memoizedDocRef.path; // Doc path is stable and uniquely identifies the document
  }, [memoizedDocRef]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (!memoizedDocRef || (requireAuth && !isFirebaseReady)) {
      if (data !== null) {
        setData(null);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    const processSnapshot = (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const result = {
          ...(serializeData(snapshot.data()) as T),
          id: snapshot.id,
        };
        
        // LOOP PROTECTION: Sadece veri gerçekten değiştiyse state update yap
        setData(prev => {
          if (deepCompare(prev, result)) return prev;
          return result;
        });
      } else {
        setData(null);
      }
      setIsLoading(false);
    };

    const handleError = (err: FirestoreError) => {
      // Permission errors are common during auth transitions, keep them silent unless persistent
      if (err?.code !== 'permission-denied') {
        console.error('Firestore useDoc error:', err);
      }
      setError(err);
      setData(null);
      setIsLoading(false);
    };

    if (realtime) {
      unsubscribe = onSnapshot(memoizedDocRef, processSnapshot, handleError);
    } else {
      getDoc(memoizedDocRef).then(processSnapshot).catch(handleError);
    }

    return () => {
      if (realtime) unsubscribe();
    };

  // docSignature kullanarak referans değişimlerinden kaynaklanan loop'u önlüyoruz
  }, [docSignature, realtime, requireAuth, isFirebaseReady]);

  return {
    data,
    isLoading,
    error,
  };
}