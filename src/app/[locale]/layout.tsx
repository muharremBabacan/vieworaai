import type {Metadata} from 'next';
import '../globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Viewora YZ Koçu',
  description: 'Fotoğrafçılık becerilerinizi geliştirmek için yapay zeka destekli koçluk.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Viewora',
  },
  icons: {
    apple: 'https://firebasestorage.googleapis.com/v0/b/studio-8632782825-fce99.firebasestorage.app/o/user-uploads%2Fviewora_logok01.png?alt=media&token=a6e7a558-eaf1-46dd-946e-a61e47d080cc',
  },
};

export default async function LocaleLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { children } = props;
  const { locale } = await props.params;

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body>
        <NextIntlClientProvider messages={messages}>
          <FirebaseClientProvider>
            {children}
            <Toaster />
          </FirebaseClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
