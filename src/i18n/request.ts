import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  // Çerezden dili oku, yoksa varsayılanı kullan
  let locale = cookieStore.get('NEXT_LOCALE')?.value || defaultLocale;

  // Geçersiz bir dil gelirse varsayılana dön
  if (!locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
