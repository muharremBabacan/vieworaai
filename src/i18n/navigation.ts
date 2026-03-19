import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Bu dosya Link, redirect, usePathname ve useRouter gibi yerelleştirilmiş 
 * navigasyon araçlarını dışa aktarır. Uygulama içinde bu araçlar 
 * @/i18n/navigation üzerinden çağrılmalıdır.
 */
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
