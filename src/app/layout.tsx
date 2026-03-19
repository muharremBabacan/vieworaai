export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Next.js 15, en dışta bu etiketleri mutlaka görmek ister.
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}