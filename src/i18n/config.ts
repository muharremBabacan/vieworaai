export const locales = ['tr', 'en'] as const;
export const defaultLocale = 'tr' as const;

export type Locale = (typeof locales)[number];
