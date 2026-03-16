import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  // Desteklenen diller
  locales: ['tr', 'en'],
  
  // Dil kodu yoksa varsayılan olarak kullanılacak dil
  defaultLocale: 'tr'
});

// Proje içinde kullanacağın Link, redirect gibi fonksiyonları buradan export ediyoruz
export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);