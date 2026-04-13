// Custom Service Worker logic for Viewora
// This file is automatically detected by next-pwa

self.addEventListener("fetch", (event: any) => {
  const url = new URL(event.request.url);

  // 🔥 API & Backend Bypass:
  // Service Worker-ın Firebase, Server Action-lar ve API-ları 
  // yakalayıp bozmasını (ERR_CONNECTION_RESET) engellemek için bu istekleri direkt ağa bırakıyoruz.
  if (
    url.pathname.startsWith("/api") || 
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebase") ||
    event.request.headers.get("next-action")
  ) {
    return;
  }
});
