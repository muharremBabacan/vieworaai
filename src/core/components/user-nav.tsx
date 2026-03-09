'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Gem, LogOut, Award, ShieldCheck, Coins, Settings, Shield, User as UserIcon, Flame, Globe, Trophy } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { Skeleton } from '@/shared/ui/skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NotificationCenter } from '@/core/components/notification-popover';
import { useAppConfig } from '@/components/AppConfigProvider';

export function UserNav() {
  const { user: authUser, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { currencyName } = useAppConfig();

  const userDocRef = useMemoFirebase(() => {
      if (!authUser || !firestore) return null;
      return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Sign out failed', error);
    }
  };

  if (isUserLoading || (authUser && isProfileLoading)) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  if (!authUser || !userProfile) {
    return (
      <Button variant="outline" onClick={() => router.push('/')}>
        Giriş Yap
      </Button>
    )
  }

  const auroBalance = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
  const isMentor = userProfile.is_mentor ?? false;
  const isAdmin = userProfile.email === 'admin@viewora.ai' || authUser.uid === '01DT86bQwWUVrewnEb8c6bd8H43';
  const levelName = userProfile.level_name ?? 'Neuner';
  const streak = userProfile.daily_streak || 1;
  const exhibitionCount = userProfile.total_exhibitions_count || 0;
  const competitionCount = userProfile.total_competitions_count || 0;
  const displayName = userProfile.name || "Kullanıcı";
  const displayEmail = userProfile.email || "E-posta yok";
  const fallbackChar = displayName?.charAt(0) || displayEmail?.charAt(0) || 'U';

  const displayPhotoURL = userProfile.photoURL || authUser.photoURL || '';

  return (
    <div className="flex items-center gap-2">
      {/* İstatistik Rozetleri Grubu */}
      <div className="hidden md:flex items-center gap-1.5 p-1 bg-secondary/30 rounded-full border border-border/40">
        {/* Günlük Seri */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500">
          <Flame size={14} className="fill-current" />
          <span className="text-[10px] font-black">{streak}</span>
        </div>
        
        {/* Sergi Katılımı */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
          <Globe size={14} />
          <span className="text-[10px] font-black">{exhibitionCount}</span>
        </div>

        {/* Yarışma Katılımı */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
          <Trophy size={14} />
          <span className="text-[10px] font-black">{competitionCount}</span>
        </div>
      </div>

      <NotificationCenter />
      
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 rounded-full border border-border/50 shadow-inner">
        <Gem className="h-4 w-4 text-cyan-400" />
        <span className="text-sm font-bold">{auroBalance}</span>
        <span className="text-[10px] font-black uppercase tracking-tighter opacity-60 ml-0.5">{currencyName}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border-2 border-transparent hover:border-primary/20 transition-all">
            <Avatar className="h-10 w-10">
              <AvatarImage src={displayPhotoURL} alt={displayName} className="object-cover" />
              <AvatarFallback>{fallbackChar}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <div className="flex items-center gap-1 text-orange-500 text-[10px] font-black">
                  <Flame size={12} className="fill-current"/> {streak}
                </div>
              </div>
              <p className="text-xs leading-none text-muted-foreground">
                {displayEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profilim</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Ayarlar</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pricing" className="cursor-pointer">
                <Coins className="mr-2 h-4 w-4" />
                <span>{currencyName} Satın Al</span>
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4 text-amber-500" />
                  <span>Yönetici Paneli</span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <div className="px-2 py-1.5 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gem className="h-4 w-4 text-cyan-400" />
                <span>{currencyName}</span>
              </div>
              <span className="font-semibold">{auroBalance}</span>
            </div>
            <div className="px-2 py-1.5 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Award className="h-4 w-4" />
                <span>Seviye</span>
              </div>
              <Badge variant={isMentor ? 'default' : 'secondary'} className="capitalize">
                {isMentor && <ShieldCheck className="mr-1 h-3 w-3"/>}
                {levelName}
              </Badge>
            </div>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Çıkış Yap</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
