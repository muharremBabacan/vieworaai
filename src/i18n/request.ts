import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({locale}) => {
  // Per our strategy, we are forcing the 'tr' locale to stabilize the app.
  // We must return the locale property here to satisfy next-intl's requirements.
  return {
    messages: (await import(`../../messages/tr.json`)).default,
    locale: 'tr',
  };
});
