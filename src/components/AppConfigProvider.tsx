'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings } from '@/types';

interface AppConfigContextType {
  currencyName: string;
  isLoading: boolean;
}

const AppConfigContext = createContext<AppConfigContextType>({
  currencyName: 'Pix',
  isLoading: true,
});

export const useAppConfig = () => useContext(AppConfigContext);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const configRef = useMemoFirebase(() => (firestore ? doc(firestore, 'app_settings', 'config') : null), [firestore]);
  const { data: config, isLoading } = useDoc<AppSettings>(configRef);

  const value = {
    currencyName: config?.currencyName || 'Pix',
    isLoading,
  };

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}
