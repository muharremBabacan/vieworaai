'use client';

import { redirect } from "next/navigation";

/**
 * [locale] altındaki ana sayfa. 
 * Middleware buraya yönlendirdiğinde kullanıcıyı doğrudan /login'e göndeririz.
 * Kimlik doğrulama kontrolleri ClientLayout tarafından yapılmaya devam eder.
 */
export default function Page() {
  redirect("/login");
}
