
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import { useLocale } from 'next-intl';
import type { User, Photo } from '@/types';
import { executePhotoAnalysisFlow, type FlowResult } from '../services/photo-flow';

export type AnalyzerStatus = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';

export function usePhotoAnalyzer() {
  const locale = useLocale();
  const { user } = useUser();
  const firestore = useFirestore();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalyzerStatus>('idle');
  const [analysisResult, setAnalysisResult] = useState<Photo | null>(null);
  
  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);
  
  // Guest Handling
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestLastUsed, setGuestLastUsed] = useState<number | null>(null);
  const GUEST_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGuestId(localStorage.getItem('guest_id'));
      const last = localStorage.getItem('guest_last_analysis_at');
      if (last) setGuestLastUsed(parseInt(last, 10));
    }
  }, []);

  const guestUsed = useMemo(() => {
    if (!guestLastUsed) return false;
    return (Date.now() - guestLastUsed) < GUEST_COOLDOWN;
  }, [guestLastUsed]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const reset = useCallback(() => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setAnalysisResult(null);
    setStatus('idle');
  }, [preview]);

  const handleAction = async (analyze = false): Promise<FlowResult | null> => {
    if (!file || !firestore) return null;

    setStatus(analyze ? 'analyzing' : 'uploading');

    const result = await executePhotoAnalysisFlow({
      file,
      analyze,
      user,
      userProfile: userProfile || null,
      firestore,
      locale,
      guestId,
      guestUsed,
      currentTier: userProfile?.tier || 'start'
    });

    switch (result.type) {
      case 'success':
        setAnalysisResult(result.data);
        setStatus('done');
        break;
      case 'upload_only':
        reset();
        break;
      case 'error':
        setStatus('error');
        break;
      case 'resolution_error':
        setStatus('error');
        break;
      case 'marketing_required':
        setStatus('idle');
        break;
    }

    return result;
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: (files: File[]) => {
      if (files.length === 0) return;
      const f = files[0];
      setFile(f);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(f));
      setStatus('idle');
    },
    noClick: true,
    noKeyboard: true,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] }
  });

  return {
    status,
    file,
    preview,
    analysisResult,
    user,
    userProfile,
    isProfileLoading,
    guestId,
    setGuestLastUsed,
    getRootProps,
    getInputProps,
    open,
    handleAction,
    reset
  };
}

