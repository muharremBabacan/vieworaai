'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from './ui/badge';
import { Gem, LogOut, Award, ShieldCheck } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { User as UserProfile } from '@/types';
import { Skeleton } from './ui/skeleton';

export function UserNav() {
  const { user: authUser, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
      if (!authUser) return null;
      return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed', error);
    }
  };

  if (isUserLoading || (authUser && isProfileLoading)) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  if (!authUser || !userProfile) {
    return (
      <Button variant="outline" onClick={() => router.push('/login')}>
        Giriş Yap
      </Button>
    )
  }

  // Handle potential undefined or non-numeric values safely
  const auroBalance = Number.isFinite(userProfile.auro_balance) ? userProfile.auro_balance : 0;
  const isMentor = userProfile.is_mentor ?? false;
  const levelName = userProfile.level_name ?? 'Neuner';
  const displayName = userProfile.name || 'Kullanıcı';
  const displayEmail = userProfile.email || 'E-posta yok';
  const fallbackChar = displayName?.charAt(0) || displayEmail?.charAt(0) || 'U';


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {authUser.photoURL && <AvatarImage src={authUser.photoURL} alt={displayName} />}
            <AvatarFallback>{fallbackChar}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {displayEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <div className="px-2 py-1.5 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gem className="h-4 w-4 text-cyan-400" />
              <span>Auro</span>
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
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Çıkış Yap</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
