import { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Viewora AI Coach',
  description: 'AI-powered coaching to improve your photography skills.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The root layout is shared by all pages, including static ones.
  // It does not receive a `locale` parameter.
  // The actual internationalized layout will be in `app/[locale]/layout.tsx`.
  return children;
}
