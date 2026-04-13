// Custom Service Worker logic for Viewora
// This file is automatically detected by next-pwa

self.addEventListener("fetch", (event: any) => {
  const url = new URL(event.request.url);

  // 🔥 API Bypass: Service Worker-ın Server Action-ları ve API-ları 
  // yakalayıp bozmasını engellemek için bu istekleri direkt ağa bırakıyoruz.
  if (url.pathname.startsWith("/api") || event.request.headers.get("next-action")) {
    return;
  }
});
