'use client';

import { redirect } from "next/navigation";

/**
 * Uygulamanın giriş noktası (/).
 * Kullanıcıyı doğrudan giriş sayfasına yönlendirir.
 * Kimlik doğrulama ve onboarding kontrolleri ClientLayout (src/app/client-layout.tsx)
 * tarafından merkezi olarak yönetilmektedir.
 */
export default function Page() {
  redirect("/login");
}
