export const locales = ['tr', 'en', 'ar', 'de', 'es', 'fr', 'ru', 'zh'] as const;
export const defaultLocale = 'tr' as const;

export type Locale = (typeof locales)[number];
