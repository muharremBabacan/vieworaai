import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  // Prefix her zaman olsun ki yönlendirmeler şaşmasın
  localePrefix: 'always' 
});

// Fonksiyonları dışarı aktarıyoruz
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);