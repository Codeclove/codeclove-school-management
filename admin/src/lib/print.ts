/**
 * Prints a specific HTML element using a hidden iframe to avoid page redirects.
 * ponytail: simple iframe printing instead of installing react-to-print.
 */
export function printElement(element: HTMLElement) {
  const iframe = document.createElement('iframe')
  // Keep off-screen without expanding viewport to desktop width so browser renders print at 100% scale.
  // ponytail: standard iframe printing with A4 portrait constraints and async asset resolution.
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) return

  const dir = document.documentElement?.dir || 'ltr'
  const lang = document.documentElement?.lang || 'en'

  doc.open()
  doc.write(`<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head>`)

  // Copy stylesheets so component styles and Tailwind classes render correctly
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    doc.write(node.outerHTML)
  })

  const hasCustomPage = Boolean(element.outerHTML?.includes('@page'))
  const defaultPageStyle = hasCustomPage
    ? ''
    : `
      @page {
        size: A4 portrait;
        margin: 14mm;
      }
    `

  doc.write(`
    <style>
      *, *::before, *::after {
        box-sizing: border-box !important;
      }
      ${defaultPageStyle}
      html, body {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body {
        background: #fff !important;
        color: #111 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      [data-print-area] {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .print-page-break {
        page-break-after: always !important;
        break-after: page !important;
        display: block !important;
        position: relative !important;
        clear: both !important;
      }
      #codeclove-portal-root {
        all: revert;
        background: transparent !important;
        display: block !important;
        width: 100% !important;
      }
    </style>
  `)

  const isPortal = Boolean(document.getElementById?.('codeclove-portal-root'))
  const wrapperOpen = isPortal ? '<div id="codeclove-portal-root">' : ''
  const wrapperClose = isPortal ? '</div>' : ''

  doc.write(`</head><body>${wrapperOpen}`)
  doc.write(element.innerHTML)
  doc.write(`${wrapperClose}</body></html>`)
  doc.close()

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      // Ignore if printing was cancelled or interrupted
    }
  }

  const cleanup = () => {
    try {
      if (iframe.parentNode) {
        document.body.removeChild(iframe)
      }
    } catch {
      // already removed
    }
  }

  // Clean up only after the user dismisses the print dialog.
  if (iframe.contentWindow) {
    iframe.contentWindow.addEventListener('afterprint', cleanup)
  }
  // Safety fallback so iframe does not leak if afterprint is unsupported.
  setTimeout(cleanup, 60000)

  // Wait for external stylesheets and images to load before opening print preview
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[]
  const images = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[]

  const pending: Promise<any>[] = [
    ...links.map((link) => new Promise((resolve) => {
      link.addEventListener('load', resolve, { once: true })
      link.addEventListener('error', resolve, { once: true })
    })),
    ...images.map((img) => new Promise((resolve) => {
      if (img.complete) return resolve(null)
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    })),
  ]

  if (pending.length > 0) {
    Promise.race([
      Promise.all(pending),
      new Promise((resolve) => setTimeout(resolve, 400)),
    ]).then(triggerPrint)
  } else {
    setTimeout(triggerPrint, 50)
  }
}
