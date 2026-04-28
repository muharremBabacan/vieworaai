'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * PageContent formerly held the login UI for root /.
 * Now it redirects to /login to ensure UI consistency and single-entry auth.
 */
export default function PageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
