import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({locale}) => {
  // Validate that the incoming `locale` parameter is valid
  // For now, we'll always serve Turkish to stabilize the app.
  return {
    messages: (await import(`../../messages/tr.json`)).default
  };
});
