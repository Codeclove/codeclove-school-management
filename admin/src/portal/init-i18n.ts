/**
 * CodeClove Portal i18n Early Initializer.
 *
 * Seeds @wordpress/i18n before components or module-level constants evaluate.
 */
import { setLocaleData } from '@wordpress/i18n'

const config = window.CodeClovePortalConfig
const localeData =
  config?.i18n?.locale_data?.['codeclove-school-management'] ||
  config?.i18n?.locale_data?.codeclove

if (localeData) {
  setLocaleData(localeData, 'codeclove-school-management')
}
