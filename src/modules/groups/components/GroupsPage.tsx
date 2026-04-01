'use client';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/lib/firebase';
import { collection, query, where, addDoc, doc, updateDoc, arrayUnion, getDocs, getDoc, setDoc } from 'firebase/firestore';
import type { Group, User, GroupPurpose } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, Link } from '@/navigation';
import { useToast } from '@/shared/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';
import { canAccess } from '@/lib/auth/canAccess';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, LogIn, Users, Crown, Loader2, GraduationCap, Trophy, Map, ShieldCheck, Lock, Hash, Copy } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const PURPOSE_CONFIG: Record<GroupPurpose, { labelKey: string; icon: any; color: string }> = {
  study: { labelKey: 'purpose_study', icon: GraduationCap, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  challenge: { labelKey: 'purpose_challenge', icon: Trophy, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  walk: { labelKey: 'purpose_walk', icon: Map, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  mentor: { labelKey: 'purpose_mentor', icon: ShieldCheck, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export default function GroupsPage() {
  const t = useTranslations('GroupsPage');
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const groupsQuery = useMemoFirebase(
    () => user ? query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid)) : null,
    [user, firestore]
  );
  const { data: memberGroups, isLoading: isGroupsLoading } = useCollection<Group>(groupsQuery);

  const ownedGroupsQuery = useMemoFirebase(
    () => user ? query(collection(firestore, 'groups'), where('ownerId', '==', user.uid)) : null,
    [user, firestore]
  );
  const { data: ownedGroups, isLoading: isOwnedLoading } = useCollection<Group>(ownedGroupsQuery);
  
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile } = useDoc<User>(userDocRef);

  const createFormSchema = z.object({
    name: z.string().min(3, t('form_error_name_min')).max(50, t('form_error_name_max')),
    description: z.string().max(200, t('form_error_description_max')).optional(),
    purpose: z.enum(['study', 'challenge', 'walk', 'mentor'] as const, {
      required_error: t('form_error_purpose_required'),
    }),
    organizerType: z.enum(['official', 'business', 'education', 'personal'] as const).default('personal'),
    visibility: z.enum(['public', 'platform', 'private'] as const).default('platform'),
    showJury: z.boolean().default(true),
    competitionSubject: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });

  const joinFormSchema = z.object({
      code: z.string().length(6, t('form_error_code_length')).regex(/^\d{6}$/, t('form_error_code_format')),
  });

  const createForm = useForm<z.infer<typeof createFormSchema>>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { 
      name: '', 
      description: '', 
      purpose: 'study', 
      organizerType: 'personal',
      visibility: 'platform',
      showJury: true,
      competitionSubject: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  });

  const joinForm = useForm<z.infer<typeof joinFormSchema>>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: { code: '' },
  });

  const hasAccessToCreate = canAccess(userProfile, "createGroup");
  const groupLimits = getGroupLimits(userProfile?.level_name);
  const canCreateGroup = hasAccessToCreate && (ownedGroups?.length || 0) < groupLimits.maxGroups;

  const onCreateGroup = async (values: z.infer<typeof createFormSchema>) => {
    if (!user || !firestore || isCreating || !hasAccessToCreate) return;
    setIsCreating(true);
    try {
      const newGroup: Omit<Group, 'id'> = {
        name: values.name,
        description: values.description || '',
        purpose: values.purpose,
        organizerType: values.organizerType,
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: new Date().toISOString(),
        joinCode: String(Math.floor(100000 + Math.random() * 900000)),
        maxMembers: getGroupLimits(userProfile?.level_name).maxMembers,
        isGlobal: values.visibility !== 'private',
        isGalleryPublic: values.visibility === 'public',
        showJury: values.showJury,
        competitionSubject: values.competitionSubject,
        startDate: values.startDate,
        endDate: values.endDate,
        juryIds: [],
      };
      const docRef = await addDoc(collection(firestore, 'groups'), newGroup);
      await updateDoc(docRef, { id: docRef.id });
      
      const publicRef = doc(firestore, 'public_profiles', user.uid);
      const publicSnap = await getDoc(publicRef);
      if (!publicSnap.exists()) {
          await setDoc(publicRef, {
              id: user.uid,
              name: userProfile?.name || user.displayName || t('anonymous_artist'),
              email: user.email,
              photoURL: userProfile?.photoURL || user.photoURL || null,
              level_name: userProfile?.level_name || 'Neuner'
          });
      }

      toast({ title: t('toast_create_success_title'), description: t('toast_create_success_description', { name: values.name }) });
      setIsCreateDialogOpen(false);
      createForm.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: t('toast_create_error_title'), description: t('toast_create_error_description') });
    } finally {
      setIsCreating(false);
    }
  };

  const onJoinGroup = async (values: z.infer<typeof joinFormSchema>) => {
      if (!user || !firestore || isJoining) return;
      setIsJoining(true);
      
      try {
          const q = query(collection(firestore, "groups"), where("joinCode", "==", values.code));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
              toast({ variant: "destructive", title: t('toast_join_not_found_title'), description: t('toast_join_not_found_description') });
              return;
          }

          const groupDoc = querySnapshot.docs[0];
          const groupData = groupDoc.data() as Group;
          const groupId = groupDoc.id;
          
          if (groupData.memberIds.includes(user.uid)) {
              toast({ title: t('toast_join_already_member_title'), description: t('toast_join_already_member_description', { name: groupData.name }) });
              setIsJoinDialogOpen(false);
              router.push(`/groups/${groupId}`);
              return;
          }
          
          if (groupData.memberIds.length >= groupData.maxMembers) {
              toast({ variant: "destructive", title: t('toast_join_fail_title'), description: t('toast_join_fail_description') });
              return;
          }

          await updateDoc(doc(firestore, "groups", groupId), {
              memberIds: arrayUnion(user.uid)
          });

          const publicRef = doc(firestore, 'public_profiles', user.uid);
          const publicSnap = await getDoc(publicRef);
          if (!publicSnap.exists()) {
              const userSnap = await getDoc(doc(firestore, 'users', user.uid));
              if (userSnap.exists()) {
                  const userData = userSnap.data() as User;
                  await setDoc(publicRef, {
                      id: user.uid,
                      name: userData.name,
                      email: userData.email,
                      photoURL: userData.photoURL || null,
                      level_name: userData.level_name || 'Neuner'
                  });
              }
          }
          
          toast({ title: t('toast_join_success_title'), description: t('toast_join_success_description', { name: groupData.name }) });
          joinForm.reset();
          setIsJoinDialogOpen(false);
          router.push(`/groups/${groupId}`);
      } catch (error) {
          console.error("Join group error:", error);
          toast({ variant: "destructive", title: t('toast_join_fail_title'), description: t('toast_join_fail_description') });
      } finally {
          setIsJoining(false);
      }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('toast_copied_title'), description: t('toast_copied_desc') });
  };

  const isLoading = isUserLoading || isGroupsLoading || isOwnedLoading;

  return (
    <div className="container mx-auto px-4 pt-6">
      <div className="flex flex-col gap-6 mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight truncate">{t('title')}</h1>
        
        {mounted && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="w-full sm:w-auto">
                                <DialogTrigger asChild>
                                    <Button 
                                      disabled={!canCreateGroup} 
                                      className={cn("w-full sm:w-auto h-11 px-6 shadow-md transition-all active:scale-95", !hasAccessToCreate && "opacity-70 bg-secondary")}
                                    >
                                        {!hasAccessToCreate ? <Lock className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                        {t('button_create_group')}
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl font-bold text-xs">
                            {!hasAccessToCreate 
                              ? <p>{t('create_tooltip_no_access')}</p>
                              : <p>{t('create_limit_tooltip', { ownedCount: ownedGroups?.length || 0, limit: groupLimits.maxGroups })}</p>}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <DialogContent className="max-w-xl rounded-[40px] border-white/5 bg-[#0a0a0b] p-0 overflow-hidden">
                    <div className="p-8 pb-0">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">{t('create_dialog_title')}</DialogTitle>
                            <DialogDescription className="text-xs font-medium italic opacity-70">{t('create_dialog_description')}</DialogDescription>
                        </DialogHeader>
                    </div>
                    
                    <ScrollArea className="max-h-[60vh] px-8 py-4">
                        <Form {...createForm}>
                            <form onSubmit={createForm.handleSubmit(onCreateGroup)} className="space-y-6 pb-4">
                                <FormField control={createForm.control} name="purpose" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('form_label_purpose')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/5">
                                                    <SelectValue placeholder={t('form_purpose_placeholder')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-white/5 bg-[#121214]">
                                                <SelectItem value="study">{t('form_purpose_study')}</SelectItem>
                                                <SelectItem value="challenge">{t('form_purpose_challenge')}</SelectItem>
                                                <SelectItem value="walk">{t('form_purpose_walk')}</SelectItem>
                                                <SelectItem value="mentor">{t('form_purpose_mentor')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={createForm.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('form_label_group_name')}</FormLabel>
                                        <FormControl><Input placeholder={t('form_placeholder_name')} {...field} className="h-11 rounded-xl bg-white/5 border-white/5" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={createForm.control} name="organizerType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('form_label_organizer_type')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/5">
                                                    <SelectValue placeholder={t('form_organizer_personal')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-white/5 bg-[#121214]">
                                                <SelectItem value="official">{t('form_organizer_official')}</SelectItem>
                                                <SelectItem value="business">{t('form_organizer_business')}</SelectItem>
                                                <SelectItem value="education">{t('form_organizer_education')}</SelectItem>
                                                <SelectItem value="personal">{t('form_organizer_personal')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {createForm.watch('purpose') === 'challenge' && (
                                    <div className="space-y-4 p-6 rounded-[32px] bg-primary/5 border border-primary/10 animate-in fade-in zoom-in duration-300">
                                        <FormField control={createForm.control} name="competitionSubject" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70">{t('form_label_comp_subject')}</FormLabel>
                                                <FormControl><Input placeholder={t('form_placeholder_comp_subject')} {...field} className="h-10 rounded-xl bg-white/5 border-white/5" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={createForm.control} name="startDate" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70">{t('form_label_comp_start')}</FormLabel>
                                                    <FormControl><Input type="date" {...field} className="h-10 rounded-xl bg-white/5 border-white/5" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="endDate" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70">{t('form_label_comp_end')}</FormLabel>
                                                    <FormControl><Input type="date" {...field} className="h-10 rounded-xl bg-white/5 border-white/5" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <FormField control={createForm.control} name="visibility" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/70">{t('form_label_visibility')}</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/5">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl border-white/5 bg-[#121214]">
                                                            <SelectItem value="public">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-bold text-xs">{t('form_visibility_public')}</span>
                                                                    <span className="text-[9px] text-muted-foreground">{t('form_visibility_public_desc')}</span>
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="platform">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-bold text-xs">{t('form_visibility_platform')}</span>
                                                                    <span className="text-[9px] text-muted-foreground">{t('form_visibility_platform_desc')}</span>
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="private">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-bold text-xs">{t('form_visibility_private')}</span>
                                                                    <span className="text-[9px] text-muted-foreground">{t('form_visibility_private_desc')}</span>
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="showJury" render={({ field }) => (
                                                <FormItem className="flex items-center justify-between space-y-0 rounded-xl border border-white/5 p-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider">{t('form_label_show_jury')}</Label>
                                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                )}

                                <FormField control={createForm.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-xs uppercase">{t('form_label_description')}</FormLabel>
                                        <FormControl><Textarea placeholder={t('form_placeholder_description')} {...field} className="rounded-xl min-h-[100px] bg-white/5 border-white/5" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </form>
                        </Form>
                    </ScrollArea>
                    <div className="p-8 border-t border-white/5">
                        <Button 
                            onClick={createForm.handleSubmit(onCreateGroup)} 
                            disabled={isCreating} 
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all bg-primary"
                        >
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('button_create')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full sm:w-auto h-11 px-6 shadow-md transition-all active:scale-95">
                        <LogIn className="mr-2 h-4 w-4" /> {t('button_join_by_code')}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                     <DialogHeader>
                        <DialogTitle>{t('join_dialog_title')}</DialogTitle>
                        <DialogDescription>{t('join_dialog_description')}</DialogDescription>
                    </DialogHeader>
                    <Form {...joinForm}>
                        <form onSubmit={joinForm.handleSubmit(onJoinGroup)} className="space-y-4">
                            <FormField control={joinForm.control} name="code" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form_label_invite_code')}</FormLabel>
                                    <FormControl><Input placeholder={t('form_placeholder_code')} {...field} className="h-11 rounded-xl" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" disabled={isJoining} className="w-full h-11 rounded-xl font-bold">
                                {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('button_join')}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
      
      {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-[24px]" />)}
          </div>
      ) : memberGroups && memberGroups.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {memberGroups.map(group => {
                  const purpose = PURPOSE_CONFIG[group.purpose || 'study'];
                  const isOwner = group.ownerId === user?.uid;
                  return (
                    <Card key={group.id} className="relative flex flex-col group overflow-hidden border-border/40 bg-[#121214]/60 backdrop-blur-xl rounded-[32px] transition-all hover:border-primary/20 hover:shadow-2xl active:scale-[0.99] border shadow-xl">
                        {isOwner && (
                            <div className="absolute top-6 right-6 text-amber-500 drop-shadow-lg z-10">
                                <Crown className="h-5 w-5" />
                            </div>
                        )}
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">
                                <span>{group.name}</span>
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className={cn("px-2.5 py-0.5 h-6 text-[10px] font-black uppercase tracking-wider border", purpose.color)}>
                                     {t(purpose.labelKey)}
                                </Badge>
                                <Badge variant="outline" className="px-2.5 py-0.5 h-6 text-[10px] font-black uppercase tracking-widest bg-white/5 border-white/10 flex items-center gap-1 cursor-pointer hover:bg-white/10" onClick={(e) => { e.preventDefault(); if(group.joinCode) copyToClipboard(group.joinCode); }}>
                                    <Hash size={10} className="text-primary" /> {group.joinCode || t('no_code')}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-2 flex-grow flex flex-col space-y-6">
                            <p className="text-sm font-medium text-muted-foreground/80 leading-relaxed line-clamp-2 h-10 italic">
                                {group.description || t('no_description')}
                            </p>
                            
                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                                    <Users className="h-4 w-4 text-primary" />
                                    <span>{t('card_member_count', { count: group.memberIds.length })}</span>
                                </div>
                                <Button asChild className="rounded-2xl px-4 md:px-6 h-10 md:h-11 font-black uppercase tracking-[0.15em] text-[10px] md:text-xs bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                                    <Link href={`/groups/${group.id}`}>{t('button_view_group')}</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                  );
              })}
          </div>
      ) : (
          <div className="text-center py-32 rounded-[32px] border-2 border-dashed border-border/40 bg-muted/5 animate-in fade-in zoom-in duration-500">
              <div className="h-20 w-20 rounded-3xl bg-secondary/50 flex items-center justify-center mx-auto mb-6">
                  <Users className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-2xl font-bold mb-2">{t('no_groups_title')}</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">{t('no_groups_description')}</p>
          </div>
      )}
    </div>
  );
}
