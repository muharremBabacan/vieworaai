'use client';

import { redirect } from "@/i18n/routing";
import { useEffect } from "react";

/**
 * Root / rotası middleware tarafından yönetilse de,
 * bir şekilde buraya düşen istekleri varsayılan dile yönlendirir.
 */
export default function RootPage() {
  useEffect(() => {
    redirect("/dashboard");
  }, []);

  return null;
}
