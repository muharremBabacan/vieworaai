import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  // Çerezden dili oku, yoksa varsayılan olarak 'tr' kullan
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
