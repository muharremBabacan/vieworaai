import React from 'react';

/**
 * This is the root layout. It's intentionally simple and static.
 * It wraps the dynamic, internationalized layout within the [locale] segment.
 * This separation prevents dynamic functions in the locale layout from forcing
 * the entire application (including static pages like _not-found) into
 * dynamic rendering.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
