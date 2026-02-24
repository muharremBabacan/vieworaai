'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/lib/firebase/error-emitter';
import { FirestorePermissionError } from '@/lib/firebase/errors';
import { useAuth } from '@/lib/firebase/provider';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useCollection<T = any>(
  memoizedTargetRefOrQuery:
    | ((CollectionReference<DocumentData> | Query<DocumentData>) & {
        __memo?: boolean;
      })
    | null
    | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const auth = useAuth();

  useEffect(() => {
    // 🔥 EN KRİTİK GUARD — AUTH GELMEDEN QUERY YOK
    if (!auth.currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    if (!memoizedTargetRefOrQuery) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];

        snapshot.docs.forEach((doc) => {
          results.push({ ...(doc.data() as T), id: doc.id });
        });

        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        let path = 'unknown';
        if (memoizedTargetRefOrQuery && 'path' in memoizedTargetRefOrQuery) {
          path = (memoizedTargetRefOrQuery as CollectionReference).path;
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery, auth.currentUser?.uid]);

  if (memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(
      memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase'
    );
  }

  return { data, isLoading, error };
}
