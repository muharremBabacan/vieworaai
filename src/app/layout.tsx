import '@/app/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="manifest" href="/manifest-new.json" />
        <meta name="theme-color" content="#0f111a" />
      </head>
      <body>{children}</body>
    </html>
  );
}