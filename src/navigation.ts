import { createNavigation } from 'next-intl/navigation';
import { routing } from './i18n/routing';

/**
 * Bu dosya, i18n/routing içindeki merkezi yapılandırmayı kullanarak 
 * uygulama genelinde Link, redirect vb. araçları dışarı aktarır.
 */
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
