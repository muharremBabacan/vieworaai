import { Toaster } from "@/shared/ui/toaster";
import { FirebaseClientProvider } from '@/lib/firebase';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

// This layout is dynamic and wraps the pages within a specific locale.
// It handles fetching localization messages and setting up client-side providers.
// It does NOT contain <html> or <body> tags, as those are in the static root layout.

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <FirebaseClientProvider>
        {children}
        <Toaster />
      </FirebaseClientProvider>
    </NextIntlClientProvider>
  );
}
