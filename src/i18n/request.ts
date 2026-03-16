import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  // URL'den gelen dili asenkron olarak bekle
  let locale = await requestLocale;

  // Gelen dil desteklenmiyorsa varsayılana dön
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    // Mesaj dosyalarının (tr.json, en.json) yerini gösteriyoruz
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});