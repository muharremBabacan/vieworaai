'use client';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { Languages } from 'lucide-react';

export default function SettingsPage() {
    const t = useTranslations('ProfilePage'); // Settings keys are in ProfilePage i18n
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const handleLanguageChange = (newLocale: string) => {
        router.replace(pathname, { locale: newLocale });
    };

    return (
        <div className="container mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Ayarlar</h1>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Languages /> {t('language_label')}</CardTitle>
                    <CardDescription>{t('language_description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-xs">
                        <Select onValueChange={handleLanguageChange} defaultValue={locale}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('language_select_placeholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tr">Türkçe</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
