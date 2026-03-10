'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/lib/firebase/provider';
import { initializeFirebase } from './init'; // Döngüsel bağımlılığı önlemek için doğrudan sibling'den al

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // İstemci tarafında Firebase'i bir kez başlatır.
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp!}
      auth={firebaseServices.auth!}
      firestore={firebaseServices.firestore!}
      storage={firebaseServices.storage!}
    >
      {children}
    </FirebaseProvider>
  );
}
