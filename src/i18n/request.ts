import {getRequestConfig} from 'next-intl/server';
import {headers} from 'next/headers';
 
export default getRequestConfig(async () => {
  // Read the active locale from the request headers.
  const headersList = await headers();
  const locale = headersList.get('X-NEXT-INTL-LOCALE') || 'tr';
 
  return {
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
