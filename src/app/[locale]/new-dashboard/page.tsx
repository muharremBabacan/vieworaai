"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { new_auth } from "@/lib/firebase/new_client";
import { onAuthStateChanged } from "firebase/auth";

export default function NewDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(new_auth, (user) => {
      if (!user) {
        router.replace("/new-login");
      }
    });

    return () => unsub();
  }, [router]);

  return <div style={{ padding: 40 }}>NEW DASHBOARD</div>;
}
