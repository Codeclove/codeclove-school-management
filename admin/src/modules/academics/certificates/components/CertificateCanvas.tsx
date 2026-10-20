import { useRef, useEffect, useCallback, type PointerEvent, type KeyboardEvent } from 'react'
import { Sparkles } from 'lucide-react'
import type { CertificateElement } from '@/api/certificates'
import { AVAILABLE_TOKENS } from '../certificate-defaults'
import { Barcode, QRCode } from '@/components/ui'
 import { cn } from '@/lib/utils'

 export interface CertificateCanvasProps {
  orientation: 'portrait' | 'landscape'
   backgroundUrl?: string | null
   elements: CertificateElement[]
  selectedElementId?: string | null
  onSelectElement?: (id: string | null) => void
  onUpdateElement?: (id: string, updates: Partial<CertificateElement>) => void
  isEditing?: boolean
  sampleOrRealData?: Record<string, string>
  tokenMode?: boolean
  verificationUrl?: string
  className?: string
}

export function CertificateCanvas({
  orientation,
  backgroundUrl,
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  isEditing = true,
  sampleOrRealData = {},
  tokenMode = false,
  verificationUrl,
  className,
}: CertificateCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const activeElementIdRef = useRef<string | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const activeTargetRef = useRef<HTMLElement | null>(null)
  const dragStartRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
    groupPartners: Array<{ id: string; origX: number; origY: number }>
  }>({ startX: 0, startY: 0, origX: 0, origY: 0, groupPartners: [] })

  useEffect(() => {
    if (!isEditing) return
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        activeElementIdRef.current = null
        activeTargetRef.current = null
        activePointerIdRef.current = null
      }
    }
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp)
    }
  }, [isEditing])
  // Map dynamic values from real data or sample defaults
  const getRenderValue = useCallback(
    (el: CertificateElement): string => {
      if (el.type === 'static') {
        return el.text || ''
      }
      if (el.token) {
        if (tokenMode) {
          return `{${el.token}}`
        }
        const val = sampleOrRealData[el.token]
        if (typeof val === 'string') {
          return val
        }
        const found = AVAILABLE_TOKENS.find((t) => t.token === el.token)
        return found ? found.sampleValue : `[${el.label}]`
      }
      return el.label
    },
    [sampleOrRealData, tokenMode]
  )

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>, el: CertificateElement) => {
    if (!isEditing) return
    e.stopPropagation()
    onSelectElement?.(el.id)
    isDraggingRef.current = true
    activeElementIdRef.current = el.id
    const partners = el.groupId
      ? elements
          .filter((item) => item.id !== el.id && item.groupId === el.groupId)
          .map((item) => ({ id: item.id, origX: item.x, origY: item.y }))
      : []

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      groupPartners: partners,
    }
    activePointerIdRef.current = e.pointerId
    activeTargetRef.current = e.currentTarget
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore if pointer capture fails
    }
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isEditing || !isDraggingRef.current || !activeElementIdRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    const deltaXPixels = e.clientX - dragStartRef.current.startX
    const deltaYPixels = e.clientY - dragStartRef.current.startY

    const deltaXPercent = (deltaXPixels / rect.width) * 100
    const deltaYPercent = (deltaYPixels / rect.height) * 100

    const rawX = dragStartRef.current.origX + deltaXPercent
    const rawY = dragStartRef.current.origY + deltaYPercent

    // Clamp between 2% and 98%
    const clampedX = Math.max(2, Math.min(98, rawX))
    const clampedY = Math.max(2, Math.min(98, rawY))

    const roundedX = Math.round(clampedX * 10) / 10
    const roundedY = Math.round(clampedY * 10) / 10

    onUpdateElement?.(activeElementIdRef.current, { x: roundedX, y: roundedY })

    // Also move all linked partners by the exact same delta
    if (dragStartRef.current.groupPartners.length > 0) {
      const deltaX = roundedX - dragStartRef.current.origX
      const deltaY = roundedY - dragStartRef.current.origY
      dragStartRef.current.groupPartners.forEach((partner) => {
        const partnerX = Math.round(Math.max(2, Math.min(98, partner.origX + deltaX)) * 10) / 10
        const partnerY = Math.round(Math.max(2, Math.min(98, partner.origY + deltaY)) * 10) / 10
        onUpdateElement?.(partner.id, { x: partnerX, y: partnerY })
      })
    }
  }

  const handlePointerUp = () => {
    if (!isEditing || !isDraggingRef.current) return
    isDraggingRef.current = false
    activeElementIdRef.current = null
    try {
      if (activeTargetRef.current && activePointerIdRef.current !== null) {
        activeTargetRef.current.releasePointerCapture(activePointerIdRef.current)
      }
    } catch {
      // Ignore
    }
    activeTargetRef.current = null
    activePointerIdRef.current = null
  }
  // Keyboard arrow keys for precision nudging (0.5% increments)
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, elId: string, currentX: number, currentY: number) => {
    if (!isEditing) return
    let dx = 0
    let dy = 0
    const step = e.shiftKey ? 1.5 : 0.4

    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else return

    e.preventDefault()
    const newX = Math.round(Math.max(2, Math.min(98, currentX + dx)) * 10) / 10
    const newY = Math.round(Math.max(2, Math.min(98, currentY + dy)) * 10) / 10
    const actualDx = newX - currentX
    const actualDy = newY - currentY

    onUpdateElement?.(elId, { x: newX, y: newY })

    const currentEl = elements.find((item) => item.id === elId)
    if (currentEl?.groupId) {
      elements
        .filter((item) => item.id !== elId && item.groupId === currentEl.groupId)
        .forEach((partner) => {
          onUpdateElement?.(partner.id, {
            x: Math.round(Math.max(2, Math.min(98, partner.x + actualDx)) * 10) / 10,
            y: Math.round(Math.max(2, Math.min(98, partner.y + actualDy)) * 10) / 10,
          })
        })
    }
  }

  const isPortrait = orientation === 'portrait'
  const baseWidth = isPortrait ? 794 : 1123

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        if (!isEditing) return
        if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'IMG') {
          onSelectElement?.(null)
        }
      }}
      className={cn(
        'relative bg-white text-gray-900 overflow-hidden shadow-md select-none print:shadow-none print:border-none @container',
        isPortrait ? 'w-full aspect-[1/1.414]' : 'w-full aspect-[1.414/1]',
        className
      )}
      style={{
        boxSizing: 'border-box',
        containerType: 'inline-size',
        aspectRatio: isPortrait ? '1 / 1.414' : '1.414 / 1',
      }}
    >
      {/* Background Layer: Custom Image or Elegant Built-in Vector Border */}
      {backgroundUrl ? (
        <img
          src={backgroundUrl}
          alt="Certificate Background"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ padding: `calc(16 * 100cqw / ${baseWidth})` }}
        >
          <div
            className="w-full h-full rounded-xs"
            style={{
              borderStyle: 'solid',
              borderColor: '#b45309',
              borderWidth: `calc(3.5 * 100cqw / ${baseWidth})`,
              padding: `calc(5 * 100cqw / ${baseWidth})`,
            }}
          >
            <div
              className="w-full h-full flex flex-col justify-between"
              style={{
                borderStyle: 'solid',
                borderColor: '#92400e',
                borderWidth: `calc(1.5 * 100cqw / ${baseWidth})`,
                padding: `calc(6 * 100cqw / ${baseWidth})`,
              }}
            >
              {/* Corner Ornaments */}
              <div
                className="flex justify-between font-serif leading-none select-none"
                style={{
                  color: '#92400e',
                  fontSize: `calc(13 * 100cqw / ${baseWidth})`,
                }}
              >
                <span>✦</span>
                <span>✦</span>
              </div>
              <div
                className="flex justify-between font-serif leading-none select-none"
                style={{
                  color: '#92400e',
                  fontSize: `calc(13 * 100cqw / ${baseWidth})`,
                }}
              >
                <span>✦</span>
                <span>✦</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Overlay Elements */}
      {elements
        .filter((el) => el.isVisible)
        .map((el) => {
          const isSelected = isEditing && selectedElementId === el.id
          const selectedElement = isEditing ? elements.find((item) => item.id === selectedElementId) : null
          const isLinkedPartner = !isSelected && isEditing && !!selectedElement?.groupId && selectedElement.groupId === el.groupId
          const renderedText = getRenderValue(el)
          const fullContent = `${el.prefix || ''}${renderedText}${el.suffix || ''}`

          // Font family resolution
          const fontFamilyStyle =
            el.fontFamily === 'serif'
              ? 'Georgia, Cambria, "Times New Roman", Times, serif'
              : el.fontFamily === 'script'
              ? '"Brush Script MT", "Great Vibes", "Dancing Script", cursive'
              : el.fontFamily === 'mono'
              ? 'monospace'
              : 'Inter, system-ui, -apple-system, sans-serif'

          // Alignment transform
          const transformOrigin =
            el.type === 'image' || el.type === 'line'
              ? 'translate(-50%, -50%)'
              : el.textAlign === 'center'
              ? 'translate(-50%, -50%)'
              : el.textAlign === 'right'
              ? 'translate(-100%, -50%)'
              : 'translate(0, -50%)'

          return (
            <div
              key={el.id}
              data-element-id={el.id}
              role={isEditing ? 'button' : undefined}
              aria-label={el.label || 'Certificate element'}
              aria-pressed={isEditing ? isSelected : undefined}
              tabIndex={isEditing ? 0 : -1}
              onClick={(e) => {
                if (!isEditing) return
                e.stopPropagation()
                onSelectElement?.(el.id)
              }}
              onPointerDown={(e) => handlePointerDown(e, el)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectElement?.(el.id)
                } else {
                  handleKeyDown(e, el.id, el.x, el.y)
                }
              }}
              style={{
                position: 'absolute',
                left: `${el.x}%`,
                top: `${el.y}%`,
                transform: transformOrigin,
                fontSize: el.type === 'image' ? undefined : `calc(${el.fontSize || 13} * 100cqw / ${baseWidth})`,
                fontWeight: el.type === 'image' ? undefined : el.fontWeight,
                fontStyle: el.type === 'image' ? undefined : el.fontStyle,
                fontFamily: el.type === 'image' ? undefined : fontFamilyStyle,
                color: el.type === 'image' ? undefined : el.color,
                textAlign: el.type === 'image' ? undefined : el.textAlign,
                textTransform: el.type === 'image' ? undefined : el.textTransform,
                letterSpacing: el.type === 'image' || !el.letterSpacing ? undefined : `calc(${el.letterSpacing} * 100cqw / ${baseWidth})`,
                opacity: el.opacity !== undefined ? el.opacity : undefined,
                lineHeight: 1.25,
                zIndex: isSelected ? 20 : 10,
              }}
              className={cn(
                'whitespace-nowrap transition-shadow duration-75 select-none',
                isEditing && 'cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-blue-400/60 rounded px-1 -mx-1',
                isSelected && 'ring-2 ring-blue-500 shadow-sm bg-blue-50/30',
                isLinkedPartner && 'ring-1 ring-blue-400/70 ring-dashed bg-blue-50/15'
              )}
            >
              {el.type === 'line' ? (
                <div
                  style={{
                    width: `calc(${el.lineWidth || 130} * 100cqw / ${baseWidth})`,
                    height: `${Math.max(1, el.lineHeight || 1)}px`,
                    borderTop: `${el.lineHeight || 1}px ${el.lineStyle || 'solid'} ${el.color || '#cbd5e1'}`,
                  }}
                  className="pointer-events-none select-none my-1"
                />
              ) : el.type === 'image' ? (
                <div
                  style={{
                    width: `calc(${el.imageWidth || 80} * 100cqw / ${baseWidth})`,
                  }}
                  className="flex items-center justify-center select-none"
                >
                  {el.imageUrl ? (
                    <img
                      src={el.imageUrl}
                      alt={el.label}
                      className="w-full h-auto object-contain pointer-events-none select-none"
                      style={{ maxHeight: `calc(140 * 100cqw / ${baseWidth})` }}
                    />
                  ) : el.token === 'principal_signature' || el.token === 'principal_signature_image' ? (
                    sampleOrRealData.principal_signature_image ? (
                      <img
                        src={sampleOrRealData.principal_signature_image}
                        alt="Signature"
                        className="object-contain pointer-events-none"
                        style={{ maxHeight: `calc(48 * 100cqw / ${baseWidth})` }}
                      />
                    ) : (
                      <div
                        className="w-full flex flex-col items-center justify-center border border-dashed border-gray-400/60 rounded bg-gray-50/80 px-2 text-gray-500 pointer-events-none"
                        style={{ height: `calc(48 * 100cqw / ${baseWidth})` }}
                      >
                        <span
                          className="font-script text-gray-800 leading-none"
                          style={{ fontSize: `calc(18 * 100cqw / ${baseWidth})` }}
                        >
                          Arthur Vance
                        </span>
                        <span
                          className="text-gray-400 uppercase tracking-wider font-sans mt-0.5"
                          style={{ fontSize: `calc(8.5 * 100cqw / ${baseWidth})` }}
                        >
                          Signature
                        </span>
                      </div>
                    )
                  ) : sampleOrRealData.school_logo ? (
                    <img
                      src={sampleOrRealData.school_logo}
                      alt="Logo"
                      className="object-contain pointer-events-none"
                      style={{ maxHeight: `calc(64 * 100cqw / ${baseWidth})` }}
                    />
                  ) : (
                    <div className="w-full aspect-square flex flex-col items-center justify-center border border-dashed border-gray-400/60 rounded bg-gray-50/80 text-gray-500 pointer-events-none p-1">
                      <Sparkles size={16} className="text-brand/60" />
                      <span
                        className="text-gray-400 uppercase font-sans mt-0.5"
                        style={{ fontSize: `calc(8.5 * 100cqw / ${baseWidth})` }}
                      >
                        Logo
                      </span>
                    </div>
                  )}
                </div>
              ) : el.token === 'serial_barcode' ? (
                <div
                  className="inline-flex flex-col items-center justify-center p-1 bg-white border border-gray-300 rounded shadow-2xs pointer-events-none select-none"
                  style={{
                    width: `calc(${el.imageWidth || 140} * 100cqw / ${baseWidth})`,
                  }}
                >
                  <Barcode
                    value={(sampleOrRealData.certificate_no || 'CERT-2026-0001').replace(/[^\x20-\x7E]/g, '')}
                    height={16}
                    className="w-full"
                  />
                </div>
              ) : el.token === 'verification_qr' ? (
                (() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://school.edu'
                  const qrUrl = verificationUrl
                    || (sampleOrRealData.verification_token
                      ? `${origin}/?codeclove_verify=cert&token=${sampleOrRealData.verification_token}`
                      : `${origin}/?codeclove_verify=cert&ref=${encodeURIComponent(sampleOrRealData.certificate_no || 'DEMO-2026-0001')}`)
                  const qrSize = el.imageWidth || 48
                  const qrColor = el.color || '#0f172a'
                  const caption = el.text !== undefined ? el.text : 'Verify Online'
                  return (
                    <div
                      className="inline-flex flex-col items-center justify-center p-1 bg-white border border-gray-200/90 rounded shadow-xs pointer-events-none select-none"
                      style={{
                        minWidth: `calc(${qrSize + 10} * 100cqw / ${baseWidth})`,
                      }}
                    >
                      <div
                        style={{
                          width: `calc(${qrSize} * 100cqw / ${baseWidth})`,
                        }}
                        className="flex items-center justify-center"
                      >
                        <QRCode
                          value={qrUrl}
                          size={qrSize}
                          fgColor={qrColor}
                          className="w-full h-auto aspect-square"
                        />
                      </div>
                      {caption && (
                        <span
                          className="text-gray-600 mt-0.5 font-sans font-medium text-center whitespace-nowrap px-0.5"
                          style={{ fontSize: `calc(7 * 100cqw / ${baseWidth})` }}
                        >
                          {caption}
                        </span>
                      )}
                    </div>
                  )
                })()
              ) : (
                fullContent
              )}
            </div>
          )
        })}
    </div>
  )
}
