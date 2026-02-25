import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale =
    headersList.get('X-NEXT-INTL-LOCALE') ??
    headersList.get('x-next-intl-locale') ??
    'tr';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});