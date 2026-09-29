import { describe, it, expect, beforeEach } from 'vitest'
import { setLocaleData } from '@wordpress/i18n'
import { __, _n, _x, sprintf } from '../lib/i18n'
import { isRtl } from '../lib/rtl'

describe('i18n runtime and helpers', () => {
  beforeEach(() => {
    // Reset locale data with known dictionary
    setLocaleData(
      {
        '': {
          domain: 'codeclove-school-management',
          lang: 'ar',
          'plural-forms': 'nplurals=2; plural=(n != 1);',
        },
        Dashboard: ['لوحة القيادة'],
        'Showing %1$d to %2$d of %3$d records': [
          'عرض %1$d إلى %2$d من %3$d سجلات',
        ],
        '%d student': ['%d طالب', '%d طلاب'],
      },
      'codeclove-school-management'
    )
  })

  it('translates registered strings using __()', () => {
    expect(__('Dashboard', 'codeclove-school-management')).toBe('لوحة القيادة')
  })

  it('falls back to default English string when translation is missing', () => {
    expect(__('Nonexistent string', 'codeclove-school-management')).toBe('Nonexistent string')
  })

  it('formats strings with sprintf and placeholders', () => {
    const formatted = sprintf(
      __('Showing %1$d to %2$d of %3$d records', 'codeclove-school-management'),
      1,
      25,
      100
    )
    expect(formatted).toBe('عرض 1 إلى 25 من 100 سجلات')
  })

  it('translates plural forms using _n()', () => {
    expect(sprintf(_n('%d student', '%d students', 1, 'codeclove-school-management'), 1)).toBe('1 طالب')
    expect(sprintf(_n('%d student', '%d students', 5, 'codeclove-school-management'), 5)).toBe('5 طلاب')
  })

  it('translates context-specific strings using _x()', () => {
    expect(_x('Active', 'student status', 'codeclove-school-management')).toBe('Active')
  })
})

describe('rtl helpers', () => {
  beforeEach(() => {
    // Provide minimal mock DOM for node environment
    const docElem = { dir: 'ltr' }
    globalThis.document = { documentElement: docElem } as unknown as Document
    globalThis.window = { CodeCloveConfig: undefined } as unknown as Window & typeof globalThis
  })
  it('detects LTR by default', () => {
    expect(isRtl()).toBe(false)
  })

  it('detects RTL when CodeCloveConfig.rtl is true', () => {
    window.CodeCloveConfig = { rtl: true } as unknown as Window['CodeCloveConfig']
    expect(isRtl()).toBe(true)
  })

  it('detects RTL when documentElement.dir is rtl', () => {
    document.documentElement.dir = 'rtl'
    expect(isRtl()).toBe(true)
  })
})
