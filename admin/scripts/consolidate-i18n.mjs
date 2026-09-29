/**
 * Merges WP-CLI make-json chunk files into one file per locale.
 *
 * make-json splits translations by source JS file (one hash-named file per
 * source file). We merge them back into one file per locale because the SPA
 * is a single IIFE — there is no per-chunk script handle to feed to
 * wp_set_script_translations().
 *
 * Correctness rules:
 *   - Empty msgstr values are stripped: JED falls back to the source string,
 *     shipping empty entries just bloats the payload.
 *   - Duplicate keys (same source string in multiple files) are fine: the
 *     translation is identical regardless of which file it came from.
 *   - The "" metadata entry is always written with the correct domain and locale,
 *     regardless of what the individual chunk files contain.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const languagesDir = path.resolve(fileURLToPath(import.meta.url), '../../../languages')
const DOMAIN = 'codeclove-school-management'
const files = fs.readdirSync(languagesDir)

// Group hash-named chunk files by locale.
const byLocale = {}
for (const file of files) {
  const match = file.match(/^codeclove-school-management-([a-zA-Z_]+)-[a-f0-9]{32}\.json$/)
  if (match) {
    ;(byLocale[match[1]] ??= []).push(file)
  }
}

if (Object.keys(byLocale).length === 0) {
  console.log('No chunk files found — nothing to consolidate.')
  process.exit(0)
}

for (const [locale, chunkFiles] of Object.entries(byLocale)) {
  const merged = {}

  for (const file of chunkFiles) {
    const filePath = path.join(languagesDir, file)
    let data
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (e) {
      console.error(`Skipping ${file}: ${e.message}`)
      fs.unlinkSync(filePath)
      continue
    }

    // WP-CLI chunk files use 'messages' as the domain key; consolidated output uses DOMAIN.
    const entries = data?.locale_data?.[DOMAIN] ?? data?.locale_data?.messages ?? {}

    for (const [key, value] of Object.entries(entries)) {
      if (key === '') continue // ignore chunk metadata; we write our own below
      // Strip untranslated entries: JED falls back to source string automatically.
      if (!value || !value[0]) continue
      merged[key] = value
    }

    fs.unlinkSync(filePath)
  }

  // Always write correct domain/locale — chunk metadata often says "messages"/"en".
  const output = {
    locale_data: {
      [DOMAIN]: {
        '': { domain: DOMAIN, lang: locale, 'plural-forms': 'nplurals=2; plural=(n != 1);' },
        ...merged,
      },
    },
  }

  const out = JSON.stringify(output) + '\n'
  fs.writeFileSync(path.join(languagesDir, `codeclove-school-management-${locale}.json`), out)
  const kb = (out.length / 1024).toFixed(1)
  console.log(`${locale}: ${chunkFiles.length} chunks → ${Object.keys(merged).length} translated entries (${kb} KB) → codeclove-school-management-${locale}.json`)
}
