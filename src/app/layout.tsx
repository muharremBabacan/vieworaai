import type {Metadata} from 'next';
import './globals.css';

// This is the root layout. It's static and contains the <html> and <body> tags.
// It must not be async and should not fetch any data.

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The `lang` attribute will be managed by the browser or inherited, 
    // as the dynamic locale is only available in the nested layout.
    // The defaultLocale in middleware ensures 'tr' is used for the root.
    <html lang="tr" className="dark">
      <body>{children}</body>
    </html>
  );
}
