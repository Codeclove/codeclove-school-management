import { useState, useRef, useMemo, useEffect, type ChangeEvent } from 'react'
import {
  Trash2,
  Eye,
  EyeOff,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Check,
  Type,
  Code2,
  Layers,
  Link2,
  Unlink,
  Sliders,
  Minus,
  QrCode,
  Barcode as BarcodeIcon,
  FileText,
} from 'lucide-react'
import { Button, Input, Select, Tooltip } from '@/components/ui'
import type { CertificateElement } from '@/api/certificates'
import { readImageFile } from '../certificate-defaults'
import { __ } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface ColorPickerControlProps {
  label: string
  color: string
  defaultColor?: string
  onChange: (color: string) => void
}

const CERTIFICATE_SWATCHES = [
  { color: '#0f172a', label: 'Slate' },
  { color: '#1e3a8a', label: 'Navy' },
  { color: '#92400e', label: 'Amber' },
  { color: '#14532d', label: 'Emerald' },
  { color: '#831843', label: 'Maroon' },
  { color: '#cbd5e1', label: 'Silver' },
]

const FONT_SIZES = [9, 10, 11, 12, 12.5, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 42]

function ColorPickerControl({
  label,
  color,
  defaultColor = '#0f172a',
  onChange,
}: ColorPickerControlProps) {
  const activeColor = color || defaultColor
  const [hexDraft, setHexDraft] = useState(activeColor.replace('#', '').toUpperCase())
  const nativePickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHexDraft(activeColor.replace('#', '').toUpperCase())
  }, [activeColor])

  const handleHexChange = (val: string) => {
    const cleaned = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()
    setHexDraft(cleaned)
    if (cleaned.length === 6) {
      onChange(`#${cleaned}`)
    } else if (cleaned.length === 3) {
      onChange(`#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`)
    }
  }

  const isCustomColor = !CERTIFICATE_SWATCHES.some(
    (s) => s.color.toLowerCase() === activeColor.toLowerCase()
  )

  return (
    <div className="flex items-center justify-between gap-1.5 py-0.5">
      <span className="text-xs font-medium text-text whitespace-nowrap shrink-0">{label}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Preset Color Swatches */}
        <div className="flex items-center gap-1 shrink-0">
          {CERTIFICATE_SWATCHES.map(({ color: swatchColor, label: swatchLabel }) => {
            const isSelected = activeColor.toLowerCase() === swatchColor.toLowerCase()
            return (
              <Tooltip key={swatchColor} content={swatchLabel}>
                <button
                  type="button"
                  onClick={() => onChange(swatchColor)}
                  className={cn(
                    'w-5 h-5 rounded-full border transition-transform cursor-pointer flex items-center justify-center shrink-0',
                    isSelected
                      ? 'border-brand ring-2 ring-brand/40 scale-105 shadow-xs'
                      : 'border-border/80 hover:scale-110'
                  )}
                  style={{ backgroundColor: swatchColor }}
                >
                  {isSelected && (
                    <Check
                      size={10}
                      strokeWidth={2.5}
                      className={swatchColor === '#cbd5e1' ? 'text-gray-900' : 'text-white'}
                    />
                  )}
                </button>
              </Tooltip>
            )
          })}
        </div>

        {/* Custom Color Chip with integrated spectrum trigger & hex input */}
        <div className="flex items-center gap-1.5 bg-bg-surface border border-border rounded px-2 h-8 shrink-0 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand-ring transition-all shadow-2xs">
          <Tooltip content={__('Custom color palette', 'codeclove-school-management')}>
            <button
              type="button"
              onClick={() => nativePickerRef.current?.click()}
              className="w-4 h-4 rounded-full border border-black/15 shrink-0 cursor-pointer hover:scale-110 transition-transform shadow-2xs relative overflow-hidden"
              style={{
                background: isCustomColor
                  ? activeColor
                  : 'conic-gradient(from 180deg at 50% 50%, #f43f5e, #fbbf24, #10b981, #06b6d4, #6366f1, #d946ef, #f43f5e)',
              }}
              title={__('Click to open custom color picker', 'codeclove-school-management')}
            />
          </Tooltip>
          <span className="text-2xs font-mono text-text-subtle select-none">#</span>
          <input
            type="text"
            size={6}
            value={hexDraft}
            onChange={(e) => handleHexChange(e.target.value)}
            onBlur={() => {
              if (hexDraft.length !== 6 && hexDraft.length !== 3) {
                setHexDraft(activeColor.replace('#', '').toUpperCase())
              }
            }}
            maxLength={6}
            placeholder="0F172A"
            className="w-[52px] text-xs font-mono text-text bg-transparent uppercase border-none p-0 outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 tracking-wider"
            title={__('Enter hex color code', 'codeclove-school-management')}
          />
          <input
            ref={nativePickerRef}
            type="color"
            value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#0f172a'}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}

export interface CertificateInspectorProps {
  selectedElement: CertificateElement | null
  elements: CertificateElement[]
  onSelectElement: (id: string | null) => void
  onUpdateElement: (id: string, updates: Partial<CertificateElement>) => void
  onDeleteElement: (id: string) => void
  backgroundUrl?: string | null
  onBackgroundUrlChange: (url: string | null) => void
}

export function CertificateInspector({
  selectedElement,
  elements,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  backgroundUrl,
  onBackgroundUrlChange,
}: CertificateInspectorProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'layers'>(
    selectedElement ? 'properties' : 'layers'
  )
  const replaceImageRef = useRef<HTMLInputElement>(null)

  // Switch to properties tab whenever an element is explicitly selected
  useEffect(() => {
    if (selectedElement) {
      setActiveTab('properties')
    }
  }, [selectedElement?.id])

  const layerRows = useMemo(() => {
    const seenGroups = new Set<string>()
    const rows: Array<{
      key: string
      isGroup: boolean
      groupId?: string
      elements: CertificateElement[]
      primary: CertificateElement
      label: string
      isVisible: boolean
    }> = []

    for (const el of elements) {
      if (el.groupId) {
        if (seenGroups.has(el.groupId)) continue
        seenGroups.add(el.groupId)

        const groupMembers = elements.filter((item) => item.groupId === el.groupId)
        const staticEl = groupMembers.find((item) => item.type === 'static')
        const primary = staticEl || groupMembers[0] || el

        rows.push({
          key: `group_${el.groupId}`,
          isGroup: true,
          groupId: el.groupId,
          elements: groupMembers,
          primary,
          label: primary.text || primary.label,
          isVisible: groupMembers.some((m) => m.isVisible),
        })
      } else {
        rows.push({
          key: el.id,
          isGroup: false,
          elements: [el],
          primary: el,
          label: el.type === 'static' ? el.text || el.label : el.label,
          isVisible: el.isVisible,
        })
      }
    }

    return rows
  }, [elements])

  const handleReplaceImage = (e: ChangeEvent<HTMLInputElement>) => {
    if (!selectedElement) return
    readImageFile(e, (imageUrl, label) => onUpdateElement(selectedElement.id, { imageUrl, label }))
  }

  const isQr = selectedElement ? selectedElement.token === 'verification_qr' || selectedElement.id === 'verification_qr' : false
  const isBarcode = selectedElement ? selectedElement.token === 'serial_barcode' || selectedElement.id === 'serial_barcode' : false
  const isSecurityGraphic = isQr || isBarcode
  const isLine = selectedElement?.type === 'line'

  const updateCoord = (axis: 'x' | 'y', val: number) => {
    if (!selectedElement) return
    onUpdateElement(selectedElement.id, { [axis]: val })
    if (selectedElement.groupId) {
      const delta = val - selectedElement[axis]
      elements
        .filter((el) => el.id !== selectedElement.id && el.groupId === selectedElement.groupId)
        .forEach((p) => onUpdateElement(p.id, { [axis]: Math.round(Math.max(2, Math.min(98, p[axis] + delta)) * 10) / 10 }))
    }
  }
  const activeFontSize = selectedElement?.fontSize || 13
  const fontSizesList = useMemo(() => {
    return FONT_SIZES.includes(activeFontSize)
      ? FONT_SIZES
      : [...FONT_SIZES, activeFontSize].sort((a, b) => a - b)
  }, [activeFontSize])

  return (
    <div className="flex flex-col h-full text-xs">
      {/* ── Top Tabs: Clean Underline Tab Navigation ── */}
      <div className="flex items-center border-b border-border bg-bg-elevated px-4 pt-1 gap-6 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('properties')}
          className={cn(
            'pb-2.5 pt-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'properties'
              ? 'border-brand text-brand font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          <Sliders size={13} />
          <span>{__('Properties', 'codeclove-school-management')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('layers')}
          className={cn(
            'pb-2.5 pt-1.5 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'layers'
              ? 'border-brand text-brand font-semibold'
              : 'border-transparent text-text-muted hover:text-text'
          )}
        >
          <Layers size={13} />
          <span>{__('Layers', 'codeclove-school-management')}</span>
          <span className="text-3xs font-mono px-1.5 py-0.2 bg-bg-surface rounded-full border border-border text-text-subtle">
            {layerRows.length}
          </span>
        </button>
      </div>

      {/* ── Tab Content Container ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'properties' ? (
          selectedElement ? (
            /* ──── PROPERTIES TAB: Selected Element View ──── */
            <div className="p-4 space-y-3.5">
              {/* Element Header: Type Badge & Action Controls (No duplicate text) */}
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-brand bg-brand-dim px-2 py-0.5 rounded-md border border-brand/20 shrink-0">
                    {isQr
                      ? __('Security QR', 'codeclove-school-management')
                      : isBarcode
                      ? __('Security Barcode', 'codeclove-school-management')
                      : isLine
                      ? __('Line / Divider', 'codeclove-school-management')
                      : selectedElement.type === 'image'
                      ? __('Image Element', 'codeclove-school-management')
                      : selectedElement.type === 'static'
                      ? __('Static Text', 'codeclove-school-management')
                      : __('Dynamic Field', 'codeclove-school-management')}
                  </span>
                  {selectedElement.type === 'token' && selectedElement.token ? (
                    <code className="text-2xs font-mono text-text font-semibold truncate bg-bg-surface px-1.5 py-0.5 rounded border border-border/60">
                      {`{${selectedElement.token}}`}
                    </code>
                  ) : selectedElement.type === 'image' ? (
                    <span className="font-semibold text-text truncate max-w-[140px]">
                      {selectedElement.label}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip content={__('Delete element', 'codeclove-school-management')}>
                    <button
                      type="button"
                      onClick={() => onDeleteElement(selectedElement.id)}
                      className="p-1.5 rounded-lg border border-border text-text-muted hover:text-danger hover:bg-danger-dim cursor-pointer transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </Tooltip>

                  <Tooltip content={__('Deselect element', 'codeclove-school-management')}>
                    <button
                      type="button"
                      onClick={() => onSelectElement(null)}
                      className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text cursor-pointer transition-colors"
                    >
                      <Check size={13} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Content / Data Binding Section */}
              <div className="space-y-1.5">
                {selectedElement.type === 'line' ? (
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-text block">{__('Line Dimensions', 'codeclove-school-management')}</span>

                    {/* Line Width Slider */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{__('Width:', 'codeclove-school-management')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={40}
                          max={600}
                          step={10}
                          value={selectedElement.lineWidth || 130}
                          onChange={(e) => onUpdateElement(selectedElement.id, { lineWidth: Number(e.target.value) })}
                          className="w-24 accent-brand cursor-pointer"
                        />
                        <input
                          type="number"
                          min={40}
                          max={600}
                          step={10}
                          value={selectedElement.lineWidth || 130}
                          onChange={(e) => onUpdateElement(selectedElement.id, { lineWidth: Number(e.target.value) })}
                          className="w-16 h-8 bg-bg-surface border border-border rounded px-2 text-center text-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand no-spinner"
                        />
                        <span className="text-text-subtle font-mono text-2xs">px</span>
                      </div>
                    </div>

                    {/* Thickness / Line Height */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{__('Thickness:', 'codeclove-school-management')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={1}
                          max={6}
                          step={1}
                          value={selectedElement.lineHeight || 1}
                          onChange={(e) => onUpdateElement(selectedElement.id, { lineHeight: Number(e.target.value) })}
                          className="w-24 accent-brand cursor-pointer"
                        />
                        <span className="w-10 text-right text-text font-mono text-2xs">
                          {selectedElement.lineHeight || 1}px
                        </span>
                      </div>
                    </div>

                    {/* Stroke Style */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{__('Stroke Style:', 'codeclove-school-management')}</span>
                      <div className="inline-flex items-center p-0.5 bg-bg-surface border border-border rounded-lg text-2xs">
                        {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => onUpdateElement(selectedElement.id, { lineStyle: style })}
                            className={cn(
                              'px-2 py-0.5 rounded cursor-pointer capitalize transition-colors',
                              (selectedElement.lineStyle || 'solid') === style
                                ? 'bg-brand text-white font-medium shadow-2xs'
                                : 'text-text-muted hover:text-text'
                            )}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Line Color */}
                    <div className="pt-2 border-t border-border/60">
                      <ColorPickerControl
                        label={__('Line Color', 'codeclove-school-management')}
                        color={selectedElement.color || '#cbd5e1'}
                        defaultColor="#cbd5e1"
                        onChange={(color) => onUpdateElement(selectedElement.id, { color })}
                      />
                    </div>
                  </div>
                ) : selectedElement.type === 'static' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text block">{__('Text Content', 'codeclove-school-management')}</label>
                    <Input
                      value={selectedElement.text || ''}
                      onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })}
                      className="text-xs h-8"
                      placeholder={__('Enter certificate text...', 'codeclove-school-management')}
                      autoFocus
                    />
                  </div>
                ) : selectedElement.type === 'image' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text">{selectedElement.label}</span>
                      <label className="cursor-pointer inline-flex items-center gap-1 text-2xs px-2.5 py-1 bg-bg-surface border border-border rounded-md hover:bg-bg-elevated text-text transition-colors">
                        <ImageIcon size={12} />
                        <span>{__('Replace File', 'codeclove-school-management')}</span>
                        <input
                          ref={replaceImageRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleReplaceImage}
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-text-muted">{__('Width:', 'codeclove-school-management')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={20}
                          max={400}
                          step={5}
                          value={selectedElement.imageWidth || 80}
                          onChange={(e) => onUpdateElement(selectedElement.id, { imageWidth: Number(e.target.value) })}
                          className="w-24 accent-brand cursor-pointer"
                        />
                        <input
                          type="number"
                          min={20}
                          max={400}
                          step={5}
                          value={selectedElement.imageWidth || 80}
                          onChange={(e) => onUpdateElement(selectedElement.id, { imageWidth: Number(e.target.value) })}
                          className="w-16 h-8 bg-bg-surface border border-border rounded px-2 text-center text-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand no-spinner"
                        />
                        <span className="text-text-subtle font-mono text-2xs">px</span>
                      </div>
                    </div>

                    {/* Image Opacity (Watermark Mode) */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-text-muted">{__('Opacity (Watermark):', 'codeclove-school-management')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={Math.round((selectedElement.opacity ?? 1) * 100)}
                          onChange={(e) => onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) / 100 })}
                          className="w-24 accent-brand cursor-pointer"
                        />
                        <span className="w-10 text-right text-text font-mono text-2xs">
                          {`${Math.round((selectedElement.opacity ?? 1) * 100)}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : isQr ? (
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-text block">{__('QR Code Setup', 'codeclove-school-management')}</span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{__('Size:', 'codeclove-school-management')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={32}
                          max={120}
                          step={4}
                          value={selectedElement.imageWidth || 48}
                          onChange={(e) => onUpdateElement(selectedElement.id, { imageWidth: Number(e.target.value) })}
                          className="w-24 accent-brand cursor-pointer"
                        />
                        <input
                          type="number"
                          min={32}
                          max={120}
                          step={4}
                          value={selectedElement.imageWidth || 48}
                          onChange={(e) => onUpdateElement(selectedElement.id, { imageWidth: Number(e.target.value) })}
                          className="w-16 h-8 bg-bg-surface border border-border rounded px-2 text-center text-text font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-ring focus:border-brand no-spinner"
                        />
                        <span className="text-text-subtle font-mono text-2xs">px</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-3xs text-text-subtle block">{__('Caption Label (under QR)', 'codeclove-school-management')}</span>
                      <Input
                        value={selectedElement.text !== undefined ? selectedElement.text : 'Verify Online'}
                        onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })}
                        className="text-xs h-8"
                        placeholder={__('e.g. Scan to Verify (or blank)', 'codeclove-school-management')}
                      />
                    </div>

                    <div className="pt-2 border-t border-border/60">
                      <ColorPickerControl
                        label={__('QR Color', 'codeclove-school-management')}
                        color={selectedElement.color || '#0f172a'}
                        defaultColor="#0f172a"
                        onChange={(color) => onUpdateElement(selectedElement.id, { color })}
                      />
                    </div>
                  </div>
                ) : isBarcode ? (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-text block">{__('Barcode Setup', 'codeclove-school-management')}</span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{__('Width:', 'codeclove-school-management')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min={90}
                          max={280}
                          step={10}
                          value={selectedElement.imageWidth || 140}
                          onChange={(e) => onUpdateElement(selectedElement.id, { imageWidth: Number(e.target.value) })}
                          className="w-24 accent-brand cursor-pointer"
                        />
                        <span className="w-12 text-right text-text font-mono text-2xs">
                          {selectedElement.imageWidth || 140}px
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Dynamic Field Binding */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-3xs text-text-subtle mb-1 block">{__('Field Prefix', 'codeclove-school-management')}</span>
                        <Input
                          value={selectedElement.prefix || ''}
                          onChange={(e) => onUpdateElement(selectedElement.id, { prefix: e.target.value })}
                          className="text-xs h-8"
                          placeholder="e.g. TC No: "
                        />
                      </div>
                      <div>
                        <span className="text-3xs text-text-subtle mb-1 block">{__('Field Suffix', 'codeclove-school-management')}</span>
                        <Input
                          value={selectedElement.suffix || ''}
                          onChange={(e) => onUpdateElement(selectedElement.id, { suffix: e.target.value })}
                          className="text-xs h-8"
                          placeholder="e.g.  (Grade 10)"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Typography Section (Text & Tokens only) */}
              {selectedElement.type !== 'image' && !isSecurityGraphic && selectedElement.type !== 'line' && (
                <div className="space-y-3 pt-3 border-t border-border/70">
                  <span className="text-xs font-semibold text-text block">
                    {__('Typography', 'codeclove-school-management')}
                  </span>

                  {/* Row 1: Font Family (58%) & Font Size (42%) */}
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-7">
                      <span className="text-3xs text-text-subtle mb-1 block">{__('Font Family', 'codeclove-school-management')}</span>
                      <Select
                        value={selectedElement.fontFamily || 'sans'}
                        onValueChange={(val) =>
                          onUpdateElement(selectedElement.id, {
                            fontFamily: val as CertificateElement['fontFamily'],
                          })
                        }
                        options={[
                          { value: 'sans', label: __('Clean Sans (Inter)', 'codeclove-school-management') },
                          { value: 'serif', label: __('Formal Serif (Times)', 'codeclove-school-management') },
                          { value: 'script', label: __('Script / Cursive', 'codeclove-school-management') },
                          { value: 'mono', label: __('Monospace', 'codeclove-school-management') },
                        ]}
                        className="text-xs h-8 w-full"
                      />
                    </div>

                    <div className="col-span-5">
                      <span className="text-3xs text-text-subtle mb-1 block">{__('Font Size', 'codeclove-school-management')}</span>
                      <Select
                        value={String(activeFontSize)}
                        onValueChange={(val) => onUpdateElement(selectedElement.id, { fontSize: Number(val) })}
                        options={fontSizesList.map((size) => ({
                          value: String(size),
                          label: `${size}px`,
                        }))}
                        className="text-xs h-8 w-full font-mono"
                      />
                    </div>
                  </div>

                  {/* Row 2: Alignment & Formatting in a single clean toolbar */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-3xs text-text-subtle font-medium">{__('Alignment & Style', 'codeclove-school-management')}</span>
                    <div className="flex items-center gap-1.5">
                      {/* Segmented Alignment */}
                      <div className="h-8 inline-flex items-center p-0.5 bg-bg-surface border border-border rounded">
                        {(['left', 'center', 'right'] as const).map((align) => {
                          const isAlignActive = (selectedElement.textAlign || 'left') === align
                          const alignLabel =
                            align === 'left'
                              ? __('Align Left', 'codeclove-school-management')
                              : align === 'center'
                              ? __('Align Center', 'codeclove-school-management')
                              : __('Align Right', 'codeclove-school-management')
                          return (
                            <Tooltip key={align} content={alignLabel}>
                              <button
                                type="button"
                                onClick={() => onUpdateElement(selectedElement.id, { textAlign: align })}
                                className={cn(
                                  'p-1.5 rounded-md cursor-pointer transition-colors',
                                  isAlignActive
                                    ? 'bg-brand text-white font-medium shadow-2xs'
                                    : 'text-text-muted hover:text-text'
                                )}
                              >
                                {align === 'left' && <AlignLeft size={13} />}
                                {align === 'center' && <AlignCenter size={13} />}
                                {align === 'right' && <AlignRight size={13} />}
                              </button>
                            </Tooltip>
                          )
                        })}
                      </div>

                      {/* Formatting Toggles */}
                      <div className="h-8 inline-flex items-center p-0.5 bg-bg-surface border border-border rounded gap-0.5">
                        <Tooltip content={__('Toggle Bold', 'codeclove-school-management')}>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateElement(selectedElement.id, {
                                fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold',
                              })
                            }
                            className={cn(
                              'p-1.5 rounded-md text-xs cursor-pointer transition-colors',
                              selectedElement.fontWeight === 'bold'
                                ? 'bg-brand text-white font-bold shadow-2xs'
                                : 'text-text-muted hover:text-text'
                            )}
                          >
                            <Bold size={13} />
                          </button>
                        </Tooltip>

                        <Tooltip content={__('Toggle Italic', 'codeclove-school-management')}>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateElement(selectedElement.id, {
                                fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic',
                              })
                            }
                            className={cn(
                              'p-1.5 rounded-md text-xs cursor-pointer transition-colors',
                              selectedElement.fontStyle === 'italic'
                                ? 'bg-brand text-white font-bold shadow-2xs'
                                : 'text-text-muted hover:text-text'
                            )}
                          >
                            <Italic size={13} />
                          </button>
                        </Tooltip>

                        <Tooltip content={__('Toggle Uppercase (ALL CAPS)', 'codeclove-school-management')}>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateElement(selectedElement.id, {
                                textTransform: selectedElement.textTransform === 'uppercase' ? 'none' : 'uppercase',
                              })
                            }
                            className={cn(
                              'px-1.5 py-1 rounded-md text-2xs font-mono font-bold cursor-pointer transition-colors',
                              selectedElement.textTransform === 'uppercase'
                                ? 'bg-brand text-white shadow-2xs'
                                : 'text-text-muted hover:text-text'
                            )}
                          >
                            TT
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  {/* Color row */}
                  <div className="pt-2 border-t border-border/50">
                    <ColorPickerControl
                      label={__('Text Color', 'codeclove-school-management')}
                      color={selectedElement.color || '#0f172a'}
                      defaultColor="#0f172a"
                      onChange={(color) => onUpdateElement(selectedElement.id, { color })}
                    />
                  </div>
                </div>
              )}

              {/* Position Coordinates Section */}
              <div className="flex items-center justify-between pt-3 border-t border-border/70 text-xs">
                <span className="font-semibold text-text">{__('Position on Page', 'codeclove-school-management')}</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-bg-surface border border-border rounded px-2.5 h-8 w-22 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand-ring transition-all shadow-2xs">
                    <span className="text-2xs font-semibold text-text-subtle select-none">X</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      aria-label={__('X position percentage', 'codeclove-school-management')}
                      value={selectedElement.x}
                      onChange={(e) => updateCoord('x', Number(e.target.value))}
                      className="w-full text-xs font-mono text-text bg-transparent text-right focus:outline-none no-spinner border-none p-0 focus:ring-0 focus-visible:ring-0"
                    />
                    <span className="text-2xs font-mono text-text-subtle select-none">%</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-bg-surface border border-border rounded px-2.5 h-8 w-22 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand-ring transition-all shadow-2xs">
                    <span className="text-2xs font-semibold text-text-subtle select-none">Y</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      aria-label={__('Y position percentage', 'codeclove-school-management')}
                      value={selectedElement.y}
                      onChange={(e) => updateCoord('y', Number(e.target.value))}
                      className="w-full text-xs font-mono text-text bg-transparent text-right focus:outline-none no-spinner border-none p-0 focus:ring-0 focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>

              {/* Grouping / Linking Partners */}
              {selectedElement.groupId && (
                <div className="pt-2 border-t border-border/60">
                  <div className="p-2 rounded-lg bg-bg-surface border border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-text-muted">
                      <Link2 size={13} className="text-brand shrink-0" />
                      <span className="text-xs font-medium text-text">
                        {__('Locked to partner field', 'codeclove-school-management')}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateElement(selectedElement.id, { groupId: undefined })}
                      className="h-6 text-3xs text-text-subtle hover:text-danger px-1.5 gap-1"
                    >
                      <Unlink size={11} />
                      <span>{__('Unlink', 'codeclove-school-management')}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ──── PROPERTIES TAB: No Element Selected (Canvas Settings) ──── */
            <div className="p-4 space-y-4">
              <div className="p-3 bg-bg-surface border border-border rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-text font-semibold">
                  <FileText size={15} className="text-brand" />
                  <span>{__('Document & Canvas Info', 'codeclove-school-management')}</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {__('Standard ISO 216 A4 Sheet (210 × 297 mm). Rendered in responsive container queries with vector-sharp 300 DPI high-definition PDF output.', 'codeclove-school-management')}
                </p>
              </div>

              {/* Stationery Background Setup */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  {__('Custom Stationery Border', 'codeclove-school-management')}
                </span>
                {backgroundUrl ? (
                  <div className="p-2.5 rounded-lg bg-bg-surface border border-border flex items-center justify-between">
                    <span className="truncate max-w-[180px] text-xs font-medium text-text">
                      {__('Custom stationery active', 'codeclove-school-management')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onBackgroundUrlChange(null)}
                      className="text-xs text-danger hover:underline cursor-pointer font-medium"
                    >
                      {__('Remove', 'codeclove-school-management')}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-text-subtle leading-normal">
                    {__('Using built-in ornate corner vector borders. You can upload custom letterhead or pre-printed stationery via the "Add Border" button in the toolbar.', 'codeclove-school-management')}
                  </p>
                )}
              </div>

              {/* Editor Keyboard Shortcuts */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  {__('Keyboard Shortcuts', 'codeclove-school-management')}
                </span>
                <div className="space-y-1.5 text-3xs font-mono text-text-muted bg-bg-surface p-2.5 rounded-lg border border-border">
                  <div className="flex justify-between">
                    <span>{__('Nudge Element:', 'codeclove-school-management')}</span>
                    <kbd className="text-text font-semibold">Arrow Keys</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>{__('Large Nudge (1.5%):', 'codeclove-school-management')}</span>
                    <kbd className="text-text font-semibold">Shift + Arrows</kbd>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab('layers')}
                  className="w-full text-xs gap-1.5"
                >
                  <Layers size={13} />
                  <span>{__('View All Layers', 'codeclove-school-management')}</span>
                </Button>
              </div>
            </div>
          )
        ) : (
          /* ──── LAYERS TAB (Clean & Quiet List) ──── */
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                {__('Certificate Layers', 'codeclove-school-management')}
              </span>
              <span className="text-3xs font-mono text-text-subtle">
                {layerRows.length} {__('layers', 'codeclove-school-management')}
              </span>
            </div>
            <div className="space-y-1 pr-0.5">
              {layerRows.map((row) => {
                const isSelected = row.elements.some((el) => el.id === selectedElement?.id)
                return (
                  <div
                    key={row.key}
                    onClick={() => onSelectElement(row.primary.id)}
                    className={cn(
                      'group flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-brand/10 border-brand text-brand font-semibold shadow-xs'
                        : 'bg-bg-surface hover:bg-bg-elevated border-border/80 hover:border-brand/60 text-text'
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
                      {row.isGroup ? (
                        <Link2 size={12} className="text-brand shrink-0" />
                      ) : row.primary.type === 'line' ? (
                        <Minus size={12} className="text-text-muted shrink-0" />
                      ) : row.primary.type === 'image' ? (
                        <ImageIcon size={12} className="text-brand shrink-0" />
                      ) : row.primary.type === 'token' ? (
                        row.primary.token === 'verification_qr' ? (
                          <QrCode size={12} className="text-brand shrink-0" />
                        ) : row.primary.token === 'serial_barcode' ? (
                          <BarcodeIcon size={12} className="text-brand shrink-0" />
                        ) : (
                          <Code2 size={12} className="text-brand shrink-0" />
                        )
                      ) : (
                        <Type size={12} className="text-text-muted shrink-0" />
                      )}
                      <span className="text-xs truncate">{row.label}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100">
                      {/* Visibility Toggle */}
                      <Tooltip content={row.isVisible ? __('Hide Layer', 'codeclove-school-management') : __('Show Layer', 'codeclove-school-management')}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const nextVisibility = !row.isVisible
                            row.elements.forEach((el) => {
                              onUpdateElement(el.id, { isVisible: nextVisibility })
                            })
                          }}
                          className="p-1 hover:text-text cursor-pointer"
                        >
                          {row.isVisible ? <Eye size={12} /> : <EyeOff size={12} className="text-danger" />}
                        </button>
                      </Tooltip>

                      {/* Delete */}
                      <Tooltip content={__('Delete Layer', 'codeclove-school-management')}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            row.elements.forEach((el) => onDeleteElement(el.id))
                          }}
                          className="p-1 hover:text-danger cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Docked Bottom Footer ── */}
      <div className="p-3 border-t border-border mt-auto bg-bg-surface/30 shrink-0">
        {backgroundUrl && (
          <div className="flex items-center justify-between text-2xs mb-1 px-0.5 text-text-muted">
            <span className="truncate">{__('Custom stationery active', 'codeclove-school-management')}</span>
            <button
              type="button"
              onClick={() => onBackgroundUrlChange(null)}
              className="text-danger hover:underline cursor-pointer font-medium"
            >
              {__('Remove', 'codeclove-school-management')}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between text-3xs font-mono text-text-muted whitespace-nowrap px-0.5">
          <span>{__('A4 • 300 DPI', 'codeclove-school-management')}</span>
          <span>{__('Arrow keys nudge', 'codeclove-school-management')}</span>
        </div>
      </div>
    </div>
  )
}
