

'use client';
import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useRouter, Link } from '@/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, arrayRemove, deleteDoc, updateDoc, collection, query, orderBy, where, writeBatch } from 'firebase/firestore';
import type { Group, PublicUserProfile, GroupCompetition, User as UserProfileType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getGroupLimits } from '@/lib/gamification';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Crown, Loader2, AlertTriangle, X, Copy, Trophy, CalendarIcon, PlusCircle, Sparkles, Mail } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const localeMap: Record<string, Locale> = { tr, enUS };

function MemberItem({ userId, isOwner, onRemove, group }: { 
  userId: string, 
  isOwner: boolean, 
  onRemove: (userId: string, userName: string) => void,
  group: Group 
}) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  const userDocRef = useMemoFirebase(() => doc(firestore, 'public_profiles', userId), [firestore, userId]);
  const { data: userProfile, isLoading } = useDoc<PublicUserProfile>(userDocRef);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center gap-3 p-2"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-24" /></div>;
  }

  if (!userProfile) {
    return (
      <div className="flex items-center gap-3 p-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar>
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent><p>{t('tooltip_user_not_found')}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-sm text-muted-foreground">{t('tooltip_user_not_found')}</span>
      </div>
    );
  }

  const isCurrentUserOwner = userId === group?.ownerId;
  const isSelf = userId === currentUser?.uid;

  return (
    <>
      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50">
        <div className="flex items-center gap-3 flex-1">
            <Avatar>
              {userProfile.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.name || ''} />}
              <AvatarFallback>{userProfile.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div className='flex flex-col'>
                <span className="text-sm font-medium">{userProfile.name}</span>
                <Badge variant="secondary" className="w-fit capitalize text-xs mt-1">{userProfile.level_name}</Badge>
            </div>
            {isCurrentUserOwner && <Crown className="h-4 w-4 text-amber-400" />}
        </div>
        {isOwner && !isSelf && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setIsAlertOpen(true)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('remove_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('remove_dialog_description', { memberName: userProfile.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRemove(userId, userProfile.name || 'User')} className="bg-destructive hover:bg-destructive/90">{t('button_remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InviteOptionsDialog({ group }: { group: Group }) {
    const t = useTranslations('GroupDetailPage');
    const { toast } = useToast();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteLink = `${origin}/groups/join/${group.id}`;
    const joinCode = group.joinCode;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(inviteLink)}`;

    const copyToClipboard = (text: string, type: 'link' | 'code') => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: t('toast_copied_title'), description: type === 'link' ? t('toast_copied_link') : t('toast_copied_code') });
        }).catch(() => {
            toast({ variant: 'destructive', title: 'Hata', description: type === 'link' ? `Link ${t('toast_copy_error')}` : `Kod ${t('toast_copy_error')}` });
        });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">{t('button_show_invite')}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('invite_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('invite_dialog_description')}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="bg-white p-2 rounded-lg">
                        <Image src={qrCodeUrl} alt="Group Invite QR Code" width={150} height={150} />
                    </div>
                    <div className="relative w-full text-center">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">{t('or_divider')}</span>
                        </div>
                    </div>
                   {joinCode && (
                     <div className="w-full space-y-2">
                        <Label htmlFor="join-code" className="text-sm font-medium">{t('label_join_code')}</Label>
                        <div className="flex items-center gap-2">
                            <Input id="join-code" value={joinCode} readOnly className="font-mono text-lg tracking-widest text-center" />
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(joinCode, 'code')}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                   )}
                    <div className="w-full space-y-2">
                        <Label htmlFor="share-link" className="text-sm font-medium">{t('label_shareable_link')}</Label>
                         <div className="flex items-center gap-2">
                            <Input id="share-link" value={inviteLink} readOnly />
                            <Button size="icon" variant="outline" onClick={() => copyToClipboard(inviteLink, 'link')}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

const createCompetitionSchema = (t: Function) => z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  theme: z.string().min(2).max(50),
  prize: z.string().min(3).max(100),
  startDate: z.date(),
  endDate: z.date(),
}).refine(data => data.endDate > data.startDate, {
  message: t('form_error_date'),
  path: ['endDate'],
});

type CreateCompetitionValues = z.infer<ReturnType<typeof createCompetitionSchema>>;

function CreateCompetitionDialog({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const t = useTranslations('GroupDetailPage');

  const form = useForm<CreateCompetitionValues>({
    resolver: zodResolver(createCompetitionSchema(t)),
    defaultValues: { title: '', description: '', theme: '', prize: '' },
  });

  const onSubmit = async (values: CreateCompetitionValues) => {
    if (!firestore) return;
    try {
      const competitionsCollectionRef = collection(firestore, 'groups', groupId, 'competitions');
      await addDocumentNonBlocking(competitionsCollectionRef, {
        ...values,
        groupId,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        createdAt: new Date().toISOString(),
      });
      toast({ title: "Başarılı", description: t('toast_comp_create_success', { title: values.title }) });
      form.reset();
      setOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: "Hata", description: t('toast_comp_create_error') });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" />{t('button_create_competition')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('create_competition_dialog_title')}</DialogTitle>
          <DialogDescription>{t('create_competition_dialog_description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>{t('form_label_comp_title')}</FormLabel><FormControl><Input placeholder={t('form_placeholder_comp_title')} {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>{t('form_label_comp_description')}</FormLabel><FormControl><Textarea placeholder={t('form_placeholder_comp_description')} {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="theme" render={({ field }) => (
                    <FormItem><FormLabel>{t('form_label_comp_theme')}</FormLabel><FormControl><Input placeholder={t('form_placeholder_comp_theme')} {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="prize" render={({ field }) => (
                    <FormItem><FormLabel>{t('form_label_comp_prize')}</FormLabel><FormControl><Input placeholder={t('form_placeholder_comp_prize')} {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>{t('form_label_comp_start_date')}</FormLabel>
                  <Popover><PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Bir tarih seçin</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                    </PopoverContent>
                  </Popover><FormMessage />
                </FormItem>
                )}/>
                <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>{t('form_label_comp_end_date')}</FormLabel>
                  <Popover><PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Bir tarih seçin</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => field.formState.getValues().startDate && date < field.formState.getValues().startDate} initialFocus/>
                    </PopoverContent>
                  </Popover><FormMessage />
                </FormItem>
                )}/>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('button_create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CompetitionCard({ competition }: { competition: GroupCompetition }) {
    const t = useTranslations('GroupDetailPage');
    const locale = useTranslations().locale();
    const dtfLocale = localeMap[locale] || enUS;
    
    const now = new Date();
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    
    const getStatus = (): { text: string; color: string; icon: React.ElementType } => {
        if (now < startDate) return { text: t('comp_card_status_upcoming'), color: 'bg-blue-500', icon: CalendarIcon };
        if (now > endDate) return { text: t('comp_card_status_ended'), color: 'bg-gray-500', icon: X };
        return { text: t('comp_card_status_active'), color: 'bg-green-500', icon: Sparkles };
    };

    const status = getStatus();

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-grow">
                    <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-lg">{competition.title}</h4>
                        <Badge className={`${status.color} text-white`}>
                            <status.icon className="mr-1.5 h-3 w-3" />
                            {status.text}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{competition.description}</p>
                    <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2"><Badge variant="secondary">{t('comp_card_theme_label')}: {competition.theme}</Badge></div>
                        <div className="flex items-center gap-2"><Badge variant="secondary">{t('comp_card_prize_label')}: {competition.prize}</Badge></div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            <span>{format(startDate, 'd MMM', { locale: dtfLocale })} - {format(endDate, 'd MMM yyyy', { locale: dtfLocale })}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 flex items-center">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/groups/${competition.groupId}/competitions/${competition.id}`}>{t('button_view_competition')}</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function CompetitionsTab({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const t = useTranslations('GroupDetailPage');
  const firestore = useFirestore();

  const competitionsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'groups', groupId, 'competitions'), orderBy('createdAt', 'desc'));
  }, [firestore, groupId]);

  const { data: competitions, isLoading } = useCollection<GroupCompetition>(competitionsQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2"><Trophy className="h-5 w-5" /> {t('tab_competitions')}</div>
          {isOwner && <CreateCompetitionDialog groupId={groupId} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        ) : competitions && competitions.length > 0 ? (
          <div className="space-y-4">
            {competitions.map(comp => (
              <CompetitionCard key={comp.id} competition={comp} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 rounded-lg border-2 border-dashed">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t('competitions_no_competitions_title')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('competitions_no_competitions_description')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export default function GroupDetailPage() {
  const params = useParams();
  const rawGroupId = params?.groupId;
  const groupId = Array.isArray(rawGroupId) ? rawGroupId[0] : rawGroupId;

  const t = useTranslations('GroupDetailPage');
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const groupDocRef = useMemoFirebase(() => {
    if (!firestore || !groupId || !currentUser) return null;
    return doc(firestore, 'groups', groupId);
  }, [firestore, groupId, currentUser]);

  const { data: group, isLoading: isGroupLoading, error: groupError } = useDoc<Group>(groupDocRef);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(firestore, 'users', currentUser.uid) : null), [currentUser, firestore]);
  const { data: userProfile } = useDoc<UserProfileType>(userDocRef);

  const isOwner = currentUser?.uid === group?.ownerId;
  const isMember = group?.memberIds.includes(currentUser?.uid || '') || false;
  
  const handleRemoveMember = async (memberIdToRemove: string, memberName: string) => {
    if (!groupDocRef) return;
    try {
        await updateDoc(groupDocRef, {
            memberIds: arrayRemove(memberIdToRemove)
        });
        toast({ title: "Başarılı", description: t('toast_remove_success', { memberName }) });
    } catch(error) {
        toast({ variant: 'destructive', title: 'Hata', description: t('toast_remove_error') });
        console.error("Failed to remove member:", error);
    }
  };
  
  const handleDeleteGroup = async () => {
    if (!groupDocRef) return;
    setIsDeletingGroup(true);
    try {
        await deleteDoc(groupDocRef);
        toast({ title: t('toast_delete_success') });
        router.replace('/groups');
    } catch(error) {
        toast({ variant: 'destructive', title: "Hata", description: t('toast_delete_error') });
        console.error("Failed to delete group:", error);
        setIsDeletingGroup(false);
        setIsDeleteAlertOpen(false);
    }
  }

  if (isGroupLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-4">
        <Skeleton className="h-10 w-3/4" /> <Skeleton className="h-6 w-1/2" />
        <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
      </div>
    );
  }

  if (groupError || !group || !isMember) {
    return (
      <div className="container mx-auto text-center py-20 px-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-xl font-semibold">{t('group_not_found_title')}</h3>
          <p className="text-muted-foreground mt-2">{groupError ? t('group_not_found_error') : t('group_not_found_no_permission')}</p>
          <Button onClick={() => router.push('/groups')} className="mt-6">{t('button_go_back')}</Button>
      </div>
    );
  }

  const { maxMembers } = getGroupLimits(userProfile?.level_name);

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
        {group.description && <p className="text-lg text-muted-foreground mt-2">{group.description}</p>}
      </div>

      <Tabs defaultValue="members" className="w-full">
        <div className="w-full overflow-x-auto pb-2 no-scrollbar">
            <TabsList>
              <TabsTrigger value="members">{t('tab_members')}</TabsTrigger>
              <TabsTrigger value="gallery" disabled>{t('tab_gallery')}</TabsTrigger>
              <TabsTrigger value="competitions">{t('tab_competitions')}</TabsTrigger>
              <TabsTrigger value="assignments" disabled>{t('tab_assignments')}</TabsTrigger>
              <TabsTrigger value="events" disabled>{t('tab_events')}</TabsTrigger>
              <TabsTrigger value="trainings" disabled>{t('tab_trainings')}</TabsTrigger>
              {isOwner && <TabsTrigger value="settings">{t('tab_settings')}</TabsTrigger>}
            </TabsList>
        </div>
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2"><Users className="h-5 w-5" /> {t('members_title')}</div>
                 <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-sm font-normal text-muted-foreground">{group.memberIds.length} / {maxMembers}</span>
                    {isOwner && <InviteOptionsDialog group={group} />}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {group.memberIds.map(memberId => (
                  <MemberItem 
                    key={memberId} 
                    userId={memberId} 
                    isOwner={isOwner}
                    onRemove={handleRemoveMember}
                    group={group}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="competitions" className="mt-6">
            <CompetitionsTab groupId={groupId} isOwner={isOwner} />
        </TabsContent>
        {isOwner && (
            <TabsContent value="settings" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings_title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 rounded-lg border border-destructive/50 p-4">
                            <h4 className="font-semibold text-destructive">{t('delete_group_title')}</h4>
                            <p className="text-sm text-muted-foreground">{t('delete_group_description')}</p>
                            <Button variant="destructive" onClick={() => setIsDeleteAlertOpen(true)}>{t('button_delete_group')}</Button>
                        </div>
                    </CardContent>
                </Card>
                 <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('delete_group_dialog_title')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('delete_group_dialog_description')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeletingGroup}>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteGroup} disabled={isDeletingGroup} className="bg-destructive hover:bg-destructive/90">
                                {isDeletingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Onayla ve Sil
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
