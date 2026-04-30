"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { new_auth } from "@/lib/firebase/new_client";
import { onAuthStateChanged } from "firebase/auth";

export default function NewAuthWatcher({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(new_auth, (user) => {
      if (user) {
        console.log("NEW LOGIN OK:", user.uid);
        router.replace("/new-dashboard");
      }
    });

    return () => unsub();
  }, [router]);

  return <>{children}</>;
}
