import { baseLocale, overwriteGetLocale, resolveLocale } from '@farolprint/i18n';

export function installLocale(tag: string): void {
    const locale = resolveLocale(tag) ?? baseLocale;
    overwriteGetLocale(() => locale);
}
