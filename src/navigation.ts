import { createSharedPathnamesNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './i18n/config';

export const localePrefix = 'never'; 

export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation({ 
  locales: locales as unknown as string[], 
  localePrefix 
});
