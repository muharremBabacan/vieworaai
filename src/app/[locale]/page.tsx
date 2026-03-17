'use client';

import { redirect } from "@/i18n/routing"; // DÜZELTME: Kendi routing'imizden alıyoruz
import { useFirebase } from "@/lib/firebase";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Page() {
  const { user, loading } = useFirebase();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Kullanıcı varsa Dashboard'a
        redirect("/dashboard");
      } else {
        // Kullanıcı yoksa Login'e
        redirect("/login");
      }
    }
  }, [user, loading]);

  // Yönlendirme yapılana kadar bir yükleme ekranı gösterelim
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
    </div>
  );
}