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
import { Gem, LogOut, VenetianMask } from 'lucide-react';
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {authUser.photoURL && <AvatarImage src={authUser.photoURL} alt={userProfile.name || 'User Avatar'} />}
            <AvatarFallback>{userProfile.name?.charAt(0) || authUser.email?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userProfile.name || 'Kullanıcı'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userProfile.email || 'E-posta yok'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <div className="px-2 py-1.5 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gem className="h-4 w-4" />
              <span>Tokenlar</span>
            </div>
            <span className="font-semibold">{userProfile.tokenBalance}</span>
          </div>
          <div className="px-2 py-1.5 text-sm flex items-center justify-between">
             <div className="flex items-center gap-2 text-muted-foreground">
              <VenetianMask className="h-4 w-4" />
              <span>Seviye</span>
            </div>
            <Badge variant={userProfile.planLevel === 'Pro' ? 'default' : 'secondary'} className="capitalize">{userProfile.planLevel}</Badge>
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
