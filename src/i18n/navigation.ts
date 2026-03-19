import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Localized navigation utilities for the Viewora app.
 * Always import Link, redirect, usePathname, and useRouter from here.
 */
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
