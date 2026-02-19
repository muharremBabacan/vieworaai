import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;   // 🔥 KRİTİK

  const finalLocale = locale ?? 'tr';

  return {
    locale: finalLocale,
    messages: (await import(`../../messages/${finalLocale}.json`)).default
  };
});
