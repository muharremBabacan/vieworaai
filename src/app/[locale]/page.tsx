"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const locale = params?.locale || "en";
    router.replace(`/${locale}/login`);
  }, [router, params]);

  return null;
}