
'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, doc, writeBatch, increment, orderBy } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { useToast } from '@/shared/hooks/use-toast';

import type { Photo, User, Exhibition, UserTier } from '@/types';
import { generatePhotoAnalysis } from '@/ai/flows/analysis/analyze-photo-and-suggest-improvements';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Trash2, ArrowLeftRight, Star, Lock, ChevronRight, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAppConfig } from '@/components/AppConfigProvider';

const handleToggleExhibition = async (photo: Photo) => {
  if (!user || !userProfile || !firestore) return;
  
  if (photo.isSubmittedToExhibition) {
      setIsProcessing(true);
      try {
          const batch = writeBatch(firestore);
          batch.delete(doc(firestore, 'public_photos', photo.id));
          batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: false, exhibitionId: null });
          await batch.commit();
          toast({ title: "Sergiden çekildi" });
          setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: false, exhibitionId: null } : null);
      } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
      return;
  }

  if (!targetExhibitionId) { toast({ title: "Sergi Seçin" }); return; }
  const SUBMIT_TO_EXHIBITION_COST = 1;

  if (userProfile.auro_balance < SUBMIT_TO_EXHIBITION_COST) {
      toast({ variant: 'destructive', title: `Yetersiz ${currencyName}` });
      return;
  }

  setIsProcessing(true);
  try {
      const batch = writeBatch(firestore);
      const publicData = { ...photo, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId, userName: userProfile.name || 'Sanatçı', userPhotoURL: userProfile.photoURL || null, userLevelName: userProfile.level_name };
      batch.set(doc(firestore, 'public_photos', photo.id), publicData);
      batch.update(doc(firestore, 'users', user.uid, 'photos', photo.id), { isSubmittedToExhibition: true, exhibitionId: targetExhibitionId });
      batch.update(doc(firestore, 'users', user.uid), { 
        auro_balance: increment(-SUBMIT_TO_EXHIBITION_COST),
        'profile_index.activity_signals.exhibition_score': increment(5) // Sanatsal Güven Sinyali (Davranış Katmanı)
      });
      await batch.commit();
      toast({ title: "Sergiye gönderildi!" });
      setSelectedPhoto(p => p ? { ...p, isSubmittedToExhibition: true, exhibitionId: targetExhibitionId } : null);
  } catch (e) { toast({ variant: 'destructive', title: "Hata" }); } finally { setIsProcessing(false); }
};
