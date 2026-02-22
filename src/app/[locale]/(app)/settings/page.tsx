
'use client';

import React, { useEffect, useState, useMemo, useTransition } from 'react';
import { Link, useRouter, usePathname } from '@/navigation';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import type { User as UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gem, Coins, History, ChevronRight, Info, FileText, LogOut, Settings as SettingsIcon, ShieldQuestion, Loader2, Languages, Code } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLevelFromXp, levels as allLevels } from '@/lib/gamification';
import { useLocale, useTranslations } from 'next-intl';


function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('ProfilePage');

  const localesInfo = [
    { code: 'tr', name: 'Türkçe' },
    { code: 'en', name: 'English' },
  ];

  function onSelectChange(nextLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div className="flex items-center gap-4 w-full p-3">
      <div className="flex-shrink-0 bg-secondary p-3 rounded-lg">
        <Languages className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-grow">
        <p className="font-semibold text-card-foreground">{t('language_label')}</p>
        <p className="text-xs text-muted-foreground">{t('language_description')}</p>
      </div>
      <div className="w-[150px]">
        <Select defaultValue={locale} onValueChange={onSelectChange} disabled={isPending}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {localesInfo.map((loc) => (
              <SelectItem key={loc.code} value={loc.code}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function DeveloperTools({ userProfile, userDocRef }: { userProfile: UserProfile, userDocRef: any }) {
    const t = useTranslations('ProfilePage');
    const { toast } = useToast();

    const handleLevelChange = (newLevelName: string) => {
        if (!userDocRef) return;
        const selectedLevel = allLevels.find(l => l.name === newLevelName);
        if (!selectedLevel) return;

        updateDocumentNonBlocking(userDocRef, {
            level_name: selectedLevel.name,
            current_xp: selectedLevel.minXp
        });
        toast({
            title: t('developer_level_change_success_title'),
            description: t('developer_level_change_success_description', { level: newLevelName }),
        })
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Code className="h-6 w-6 text-green-400" />
                    {t('developer_tools_title')}
                </CardTitle>
                 <CardDescription>{t('developer_tools_description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <Select onValueChange={handleLevelChange} defaultValue={userProfile.level_name}>
                    <SelectTrigger>
                        <SelectValue placeholder="Seviye Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                        {allLevels.map(level => (
                            <SelectItem key={level.name} value={level.name}>{level.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
    )
}

export default function SettingsPage() {
  const locale = useLocale();
  const { user: authUser, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const t = useTranslations('ProfilePage');
  const tNav = useTranslations('AppLayout');
  const [isRestoring, setIsRestoring] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/', { locale }); 
      toast({ title: t('toast_signout_success') });
    } catch (error) {
      console.error('Sign out failed', error);
      toast({ variant: 'destructive', title: t('toast_signout_fail') });
    }
  };

  const handleRestorePurchases = () => {
    setIsRestoring(true);
    toast({ title: t('toast_restoring_title') });

    setTimeout(() => {
      toast({
        title: t('toast_restore_complete_title'),
        description: t('toast_restore_complete_description'),
      });
      setIsRestoring(false);
    }, 1500);
  };

  if (isUserLoading || isProfileLoading || !userProfile) {
    return (
      <div className="container mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{tNav('title_settings')}</h1>
        <Card><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
      </div>
    );
  }

  const auroBalance = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
  const isDeveloper = userProfile.email === 'babacan.muharrem@gmail.com';

  return (
    <div className="container mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{tNav('title_settings')}</h1>
      <div className="space-y-8">

        {isDeveloper && <DeveloperTools userProfile={userProfile} userDocRef={userDocRef} />}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Gem className="h-6 w-6 text-cyan-400" />
              {t('auro_management_title')}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-4">
              <span className="font-medium text-muted-foreground">{t('current_balance')}</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{auroBalance.toLocaleString()}</span>
                <span className="font-semibold text-cyan-400">{t('auro_unit')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <Button asChild size="lg">
                <Link href="/pricing" locale={locale}>
                  <Coins className="mr-2 h-5 w-5" />
                  {t('button_buy_auro')}
                </Link>
              </Button>

              <Button variant="outline" size="lg" onClick={handleRestorePurchases} disabled={isRestoring}>
                {isRestoring ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <History className="mr-2 h-5 w-5" />}
                {t('button_restore_purchases')}
              </Button>

            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-primary" />
              {t('app_account_title')}
            </CardTitle>
          </CardHeader>

          <CardContent className="divide-y divide-border -mx-3">
            <LanguageSwitcher />
            <Link href="/terms" locale={locale} className="flex items-center justify-between p-3 hover:bg-secondary/50 w-full">
              <span className="flex items-center gap-4">
                <FileText className="h-5 w-5" />
                {t('terms_label')}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/privacy" locale={locale} className="flex items-center justify-between p-3 hover:bg-secondary/50 w-full">
               <span className="flex items-center gap-4">
                <ShieldQuestion className="h-5 w-5" />
                {t('privacy_label')}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-5 w-5" />
          {t('button_sign_out')}
        </Button>

      </div>
    </div>
  );
}
