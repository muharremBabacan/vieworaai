import { createSharedPathnamesNavigation } from 'next-intl/navigation';
import { locales } from './i18n/config';

export const localePrefix = 'never'; // URL'de /tr veya /en görünmesini istemiyorsak 'never' kullanıyoruz

export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation({ 
  locales: locales as unknown as string[], 
  localePrefix 
});
