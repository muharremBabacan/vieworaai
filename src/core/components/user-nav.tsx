'use client';

import { useState, useEffect } from 'react';
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
import { LogOut, Settings, Shield, User as UserIcon, Flame, Coins, Trophy, Globe, Gem } from 'lucide-react';
import { useUser } from '@/lib/firebase/client-provider';
import { Link } from '@/i18n/navigation';
import { AuthService } from '@/lib/auth/auth-service';
import { NotificationCenter } from '@/core/components/notification-popover';
import { useAppConfig } from '@/components/AppConfigProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

export function UserNav() {
  const t = useTranslations('UserNav');
  const tApp = useTranslations('AppLayout');
  const tFallback = useTranslations('UserNavFallback');
  const { user: authUser, profile: userProfile, authReady, isProfileLoading, auth } = useUser();
  const { currencyName } = useAppConfig();
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGuestId(localStorage.getItem('guest_id'));
    }
  }, []);

  const handleSignOut = async () => {
    try {
      if (auth) {
        await auth.signOut();
      }
      window.location.href = "/login";
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isLoading = !authReady || (authUser && isProfileLoading && !userProfile);
  const isLoggedOut = authReady && !authUser;

  const pixBalance = userProfile?.pix_balance || 0;
  const streak = userProfile?.daily_streak || 1;
  const exhibitionCount = userProfile?.total_exhibitions_count || 0;
  const competitionCount = userProfile?.total_competitions_count || 0;
  const displayName = userProfile?.name || authUser?.displayName || "Kullanıcı";
  const displayEmail = userProfile?.email || authUser?.email || "";
  const fallbackChar = displayName?.charAt(0) || 'U';
  const displayPhotoURL = userProfile?.photoURL || authUser?.photoURL || '';
  const isAdmin = userProfile?.email === 'admin@viewora.ai' || authUser?.uid === '01DT86bQwWUVmrewnEb8c6bd8H43';

  if (isLoading) return null;

  if (isLoggedOut) {
    return (
      <div className="flex items-center gap-4">
        {guestId && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10">
            <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Guest:</span>
            <span className="text-[10px] font-black uppercase text-primary tracking-widest">{guestId}</span>
          </div>
        )}
        <Button 
          variant="outline" 
          onClick={() => window.location.href = '/login'}
          className="rounded-xl font-black uppercase tracking-widest text-[10px] h-9 px-5 border-primary/20 hover:bg-primary/5 transition-all"
        >
          {tFallback('login')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <div className="hidden md:flex items-center gap-1.5 p-1 bg-secondary/30 rounded-full border border-border/40">
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500">
                <Flame size={14} className="fill-current" />
                <span className="text-[10px] font-black">{streak}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold uppercase">STREAK</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
                <Globe size={14} />
                <span className="text-[10px] font-black">{exhibitionCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold uppercase">SERGİ</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
                <Trophy size={14} />
                <span className="text-[10px] font-black">{competitionCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-bold uppercase">YARIŞMA</TooltipContent>
          </Tooltip>

        </div>
      </TooltipProvider>

      <NotificationCenter />

      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 rounded-full border border-border/50">
        <Gem className="h-4 w-4 text-cyan-400" />
        <span className="text-sm font-bold">{pixBalance}</span>
        <span className="text-[10px] font-black uppercase opacity-60 ml-1">{currencyName}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={displayPhotoURL} />
              <AvatarFallback>{fallbackChar}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div>
              <p>{displayName}</p>
              <p className="text-xs text-muted-foreground">{displayEmail}</p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserIcon className="mr-2 h-4 w-4" />
                {tApp('nav_profile')}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                {t('settings')}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/pricing">
                <Coins className="mr-2 h-4 w-4" />
                {currencyName}
              </Link>
            </DropdownMenuItem>

            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  {tApp('nav_admin_panel')}
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('sign_out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}