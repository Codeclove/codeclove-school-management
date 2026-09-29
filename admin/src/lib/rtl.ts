/**
 * CodeClove RTL helpers.
 *
 * Provides utilities to inspect and react to Right-to-Left (RTL) text direction.
 */

/**
 * Returns true if the active layout direction is RTL.
 */
export const isRtl = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  const configRtl = Boolean(window.CodeCloveConfig?.rtl)
  const docRtl = typeof document !== 'undefined' && document.documentElement?.dir === 'rtl'
  return configRtl || docRtl
}
