'use client';

import { FirebaseClientProvider } from '@/lib/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { ClientLayout } from '@/app/[locale]/client-layout';
import { AppConfigProvider } from '@/components/AppConfigProvider';
import { PushProvider } from '@/components/providers/PushProvider';
import React from 'react';


/**
 * A Client Component wrapper for all providers.
 * This resolves the issue of having client-side logic directly in the server-side RootLayout.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <PushProvider>
        <AppConfigProvider>
          <ClientLayout>{children}</ClientLayout>
          <Toaster />
        </AppConfigProvider>
      </PushProvider>
    </FirebaseClientProvider>
  );
}
