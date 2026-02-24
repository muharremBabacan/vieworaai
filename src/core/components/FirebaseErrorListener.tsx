'use client';

import { useEffect } from 'react';
import { useToast } from '@/shared/hooks/use-toast';
import { errorEmitter } from '@/lib/firebase/error-emitter';

/**
 * A client-side component that listens for globally emitted events
 * and displays them as toasts. It's placed inside the FirebaseProvider
 * to ensure it's always active within the authenticated app context.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    // Define the handler function
    const handlePermissionError = (error: Error) => {
      // In a real app, you might log this to a service like Sentry
      // For development, we throw it to make it visible in the Next.js overlay
      if (process.env.NODE_ENV === 'development') {
        // This makes the detailed error visible in the dev overlay
        throw error;
      } else {
        // In production, show a generic toast
        toast({
          variant: "destructive",
          title: "İzin Hatası",
          description: "Bu işlemi yapmak için yetkiniz yok.",
        });
      }
    };

    // Subscribe to the 'permission-error' event
    errorEmitter.on('permission-error', handlePermissionError);

    // Cleanup: Unsubscribe when the component unmounts
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]); // Dependency array includes toast to ensure it has the latest context

  return null; // This component does not render anything itself
}
