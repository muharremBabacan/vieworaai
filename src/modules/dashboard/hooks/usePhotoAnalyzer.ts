
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUser, useFirestore, useDoc, useMemoFirebase, useStorage } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import { useLocale } from 'next-intl';
import type { User, Photo } from '@/types';
import { executePhotoAnalysisFlow, type FlowResult, TIER_COSTS } from '../services/photo-flow';

export type AnalyzerStatus = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';

export function usePhotoAnalyzer() {
  const locale = useLocale();
  const { user, uid, auth } = useUser(); // 🛡️ Get auth and consistent uid
  const firestore = useFirestore();
  const storage = useStorage();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalyzerStatus>('idle');
  const [analysisResult, setAnalysisResult] = useState<Photo | null>(null);
  
  const userDocRef = useMemoFirebase(
    () => {
      // 🛡️ MÜHÜR: Sadece istemci tarafında auth gerçekse veriye dokun
      if (uid && firestore && auth?.currentUser?.uid === uid) {
        return doc(firestore, 'users', uid);
      }
      return null;
    },
    [uid, firestore, auth?.currentUser]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userDocRef);
  
  const [guestAnalysisCount, setGuestAnalysisCount] = useState<number>(0);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestPix, setGuestPix] = useState<number>(0);
  const [guestLastUsed, setGuestLastUsed] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const count = localStorage.getItem('guest_analysis_count');
      setGuestAnalysisCount(count ? parseInt(count, 10) : 0);
      
      setGuestId(localStorage.getItem('guest_id'));
      
      const pix = localStorage.getItem('guest_pix');
      setGuestPix(pix ? parseInt(pix, 10) : 0);

      const last = localStorage.getItem('guest_last_analysis_at');
      if (last) setGuestLastUsed(parseInt(last, 10));
    }
  }, []);

  const GUEST_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 Days in ms

  const guestLimitReached = useMemo(() => {
    if (user) return false;
    if (!guestLastUsed) return false;
    const timeSinceLast = Date.now() - guestLastUsed;
    return timeSinceLast < GUEST_COOLDOWN;
  }, [user, guestLastUsed]);

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
    if (!file) return null;

    // 🛡️ GUEST LIMIT CHECK
    if (!user && analyze && guestLimitReached) {
      return { type: 'error', code: 'GUEST_LIMIT_REACHED', message: 'Guest limit reached' };
    }

    setStatus(analyze ? 'analyzing' : 'uploading');

    let result: FlowResult;
    try {
      result = await executePhotoAnalysisFlow({
        file,
        analyze,
        user,
        userProfile: userProfile || null,
        locale,
        uid,
        guestId,
        guestPix: guestPix,
        currentTier: userProfile?.tier || 'start'
      });
    } catch (e: any) {
      console.error('🔥 [usePhotoAnalyzer] CRITICAL FLOW ERROR:', e);
      setStatus('error');
      return { type: 'error', code: 'UNEXPECTED_ERROR', message: e.message };
    }

    switch (result.type) {
      case 'success':
        // Set Guest Last Used Timestamp
        if (!user && analyze) {
          const now = Date.now();
          localStorage.setItem('guest_last_analysis_at', now.toString());
          setGuestLastUsed(now);
        }
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
    guestPix,
    setGuestPix,
    setGuestLastUsed,
    getRootProps,
    getInputProps,
    open,
    handleAction,
    reset
  };
}

