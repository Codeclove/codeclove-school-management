/**
 * Prints a specific HTML element using a hidden iframe to avoid page redirects.
 * ponytail: simple iframe printing instead of installing react-to-print.
 */
export function printElement(element: HTMLElement) {
  const iframe = document.createElement('iframe')
  // Keep off-screen at physical A4 proportions so browser layout engine evaluates full desktop/document media rules.
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:210mm;height:297mm;opacity:0;pointer-events:none;border:0;'
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

  const htmlContent = (element.outerHTML || '') + (element.innerHTML || '')
  const isLandscape = Boolean(
    htmlContent.includes('A4 landscape') ||
    htmlContent.includes('size: A4 landscape') ||
    htmlContent.includes('size: landscape') ||
    (htmlContent.includes('landscape') && htmlContent.includes('@page')) ||
    htmlContent.includes('data-orientation="landscape"') ||
    element.getAttribute?.('data-orientation') === 'landscape' ||
    element.getAttribute?.('data-tabulation-print') === 'true' ||
    htmlContent.includes('data-tabulation-print="true"')
  )
  const isLetter = Boolean(
    htmlContent.includes('data-paper-size="letter"') ||
    element.getAttribute?.('data-paper-size') === 'letter' ||
    htmlContent.includes('size: letter')
  )
  const isAdmitCard = Boolean(
    htmlContent.includes('data-admit-card') ||
    element.getAttribute?.('data-admit-card') ||
    element.querySelector?.('[data-admit-card]')
  )
  const pageSize = isLandscape
    ? (isLetter ? 'letter landscape' : 'A4 landscape')
    : (isLetter ? 'letter portrait' : 'A4 portrait')
  const pageMargin = isLandscape
    ? (isLetter ? '0.25in 0.35in' : '6mm 8mm')
    : isAdmitCard
    ? '8mm'
    : (isLetter ? '3mm 4mm' : '3mm 4mm')

  const defaultPageStyle = `
    @page {
      size: ${pageSize};
      margin: ${pageMargin};
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
      [data-print-area],
      [data-report-card-document],
      [data-tabulation-print] {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 auto !important;
        padding: 0 !important;
      }
      [data-report-card-document] {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        height: ${isLetter ? '268mm' : '286mm'} !important;
        max-height: ${isLetter ? '268mm' : '286mm'} !important;
        min-height: 0 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
      }
      [data-tabulation-print] {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      [data-certificate-document]:not([data-report-card-document]) {
        box-sizing: border-box !important;
        width: ${isLandscape ? '297mm' : '210mm'} !important;
        height: ${isLandscape ? '209.5mm' : '296.5mm'} !important;
        max-height: ${isLandscape ? '209.5mm' : '296.5mm'} !important;
        overflow: hidden !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      [data-admit-card-sheet="1-up"] {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 194mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      [data-admit-card-sheet="1-up"]:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      [data-admit-card="true"] {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 194mm !important;
        margin: 0 auto !important;
        padding: 12px 14px !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
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

  const isDocumentRoot = Boolean(
    element.getAttribute?.('data-certificate-document') ||
    element.getAttribute?.('data-report-card-document') ||
    element.getAttribute?.('data-print-area') ||
    element.getAttribute?.('data-tabulation-print')
  )
  const printBody = isDocumentRoot
    ? element.outerHTML
    : element.innerHTML
  doc.write(`</head><body>${wrapperOpen}`)
  doc.write(printBody)
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
