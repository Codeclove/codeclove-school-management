/**
 * CodeClove Admin i18n initialiser.
 *
 * Fetches the JED translation file for the current locale and seeds
 * @wordpress/i18n before any component or module-level constant evaluates.
 *
 * English users get null for i18nUrl — no fetch, no overhead.
 * Translated locales fetch one separately-cacheable JSON file.
 */
import { setLocaleData } from '@wordpress/i18n'

export async function initI18n(): Promise<void> {
  const url = window.CodeCloveConfig?.i18nUrl
  if (!url) return

  try {
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    const localeData = data?.locale_data?.['codeclove-school-management']
    if (localeData) {
      setLocaleData(localeData, 'codeclove-school-management')
    }
  } catch {
    // Non-fatal: untranslated strings fall back to English source.
  }
}
