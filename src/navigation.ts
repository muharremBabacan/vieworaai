import {createSharedPathnamesNavigation} from 'next-intl/navigation';
 
export const locales = ['tr', 'de', 'fr', 'es', 'ar', 'ru', 'el', 'zh', 'ja'] as const;
export const localePrefix = 'always'; // Default
 
export const {Link, redirect, usePathname, useRouter} =
  createSharedPathnamesNavigation({locales, localePrefix});
