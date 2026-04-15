'use client';

import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  getDoc,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { serializeData, deepCompare } from '@/lib/utils';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

interface UseDocOptions {
  realtime?: boolean;
}

export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
  options: UseDocOptions = {}
): UseDocResult<T> {
  const { realtime = true } = options;

  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  // Loop Protection: Doc Signature
  const docSignature = useMemo(() => {
    if (!memoizedDocRef) return null;
    return memoizedDocRef.path; // Doc path is stable
  }, [memoizedDocRef]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (!memoizedDocRef) {
      if (data !== null) setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // DEBUG: Listener start
    console.debug(`[useDoc] Starting ${realtime ? 'realtime' : 'one-time'} fetch for:`, docSignature);

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
      const auth = getAuth();
      if (err.code === 'permission-denied' && !auth.currentUser) {
        setData(null);
        setIsLoading(false);
        return;
      }

      console.error('Firestore useDoc error:', err);
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
      if (realtime) {
        console.debug(`[useDoc] Unsubscribing from:`, docSignature);
        unsubscribe();
      }
    };

  // docSignature kullanarak referans değişimlerinden kaynaklanan loop'u önlüyoruz
  }, [docSignature, realtime]);

  return {
    data,
    isLoading,
    error,
  };
}