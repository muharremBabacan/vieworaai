import { createSharedPathnamesNavigation } from 'next-intl/navigation';

export const locales = ['tr', 'en'] as const;
export const localePrefix = 'never'; // URL'de /tr veya /en görünmesini istemiyorsak 'never' kullanıyoruz

export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation({ locales, localePrefix });
