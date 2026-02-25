import { Toaster } from "@/shared/ui/toaster";
import { FirebaseClientProvider } from '@/lib/firebase';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <FirebaseClientProvider>
        {children}
        <Toaster />
      </FirebaseClientProvider>
    </NextIntlClientProvider>
  );
}
