import Link from 'next/link';
import { usePathname, useRouter, redirect } from 'next/navigation';

export const locales = ['tr'] as const;
export const localePrefix = 'always';

export { Link, usePathname, useRouter, redirect };
