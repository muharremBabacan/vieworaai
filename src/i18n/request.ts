import { getRequestConfig, requestLocale } from 'next-intl/server';

export default getRequestConfig(async () => {
  const locale = (await requestLocale()) ?? 'tr';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});