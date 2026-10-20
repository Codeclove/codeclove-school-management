import { useMemo } from 'react'
import { createQrMatrix } from './qrcode-utils'
import { cn } from '@/lib/utils'
export interface QRCodeProps {
  value: string
  size?: number
  className?: string
  bgColor?: string
  fgColor?: string
}

/**
 * Dependency-free, pure SVG vector QR Code renderer.
 * Vector-crisp across screen scaling and physical 300+ DPI printer outputs.
 */
export function QRCode({
  value,
  size = 64,
  className,
  bgColor = '#ffffff',
  fgColor = '#0f172a',
}: QRCodeProps) {
  const matrix = useMemo(() => {
    try {
      if (!value) return null
      return createQrMatrix(value)
    } catch {
      return null
    }
  }, [value])

  if (!matrix) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn('flex items-center justify-center bg-gray-100 text-gray-400 font-mono text-2xs border border-gray-200 rounded', className)}
      >
        QR
      </div>
    )
  }

  const count = matrix.length
  // Build a single continuous SVG path for maximum performance & minimal DOM footprint
  let path = ''
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r]?.[c]) {
        path += `M${c},${r}h1v1h-1z `
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${count} ${count}`}
      width={size}
      height={size}
      className={cn('shrink-0 select-none', className)}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR Code"
    >
      <rect width={count} height={count} fill={bgColor} />
      <path d={path} fill={fgColor} />
    </svg>
  )
}
