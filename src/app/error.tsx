'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2>Sistem Başlatılamadı</h2>
          <button onClick={() => reset()}>Tekrar Dene</button>
        </div>
      </body>
    </html>
  );
}