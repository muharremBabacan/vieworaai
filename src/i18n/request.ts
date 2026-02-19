import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
  return {
    // Hatayı çözen kritik satır: locale bilgisini geri döndürün
    locale, 
    // Kök dizindeki messages klasörüne erişim yolu
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});