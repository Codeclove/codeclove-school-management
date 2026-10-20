/**
 * CertificateToolbar — Professional studio canvas creation toolbar.
 *
 * Implements a balanced 3-zone Studio Header pattern:
 * - Zone 1 (Left): Document orientation segmented toggle (Portrait / Landscape) & print resolution spec badge.
 * - Zone 2 (Center): Unified creation tools (Add Field, Text, Line / Rule, Image, Stationery / Border).
 * - Zone 3 (Right): Studio view utilities (Preview Data vs Token Mode toggle, Canvas Zoom / Fit controls, Reset Layout).
 */

import { useState, useRef, useMemo, useEffect, type ChangeEvent } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  RotateCcw,
  Plus,
  Image as ImageIcon,
  Building2,
  PenTool,
  Upload,
  Type,
  FileImage,
  ChevronDown,
  Eye,
  Code2,
  Minus,
  FileText,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react'
import {
  Button,
  Input,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  Tooltip,
} from '@/components/ui'
import type { CertificateElement } from '@/api/certificates'
import { AVAILABLE_TOKENS, readImageFile } from '../certificate-defaults'
import { cn, getPortalContainer } from '@/lib/utils'
import { __ } from '@/lib/i18n'

const TOKEN_CATEGORIES = [
  { id: 'student', label: __('Student Information', 'codeclove-school-management') },
  { id: 'guardian', label: __('Parent / Guardian', 'codeclove-school-management') },
  { id: 'academic', label: __('Academic Details', 'codeclove-school-management') },
  { id: 'issuance', label: __('Issuance & Remarks', 'codeclove-school-management') },
  { id: 'school', label: __('School Information', 'codeclove-school-management') },
  { id: 'security', label: __('Security & Verification', 'codeclove-school-management') },
]
export interface CertificateToolbarProps {
  orientation: 'portrait' | 'landscape'
  onOrientationChange: (orientation: 'portrait' | 'landscape') => void
  backgroundUrl?: string | null
  onBackgroundUrlChange: (url: string | null) => void
  onSelectElement: (id: string | null) => void
  onAddElement: (element: CertificateElement) => void
  onResetLayout: () => void
  sampleMode?: boolean
  onToggleSampleMode?: () => void
  zoom?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void
}

export function CertificateToolbar({
  orientation,
  onOrientationChange,
  backgroundUrl,
  onBackgroundUrlChange,
  onSelectElement,
  onAddElement,
  onResetLayout,
  sampleMode = true,
  onToggleSampleMode,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: CertificateToolbarProps) {
  const [bgInputOpen, setBgInputOpen] = useState(false)
  const [bgUrlDraft, setBgUrlDraft] = useState(backgroundUrl || '')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const customImageInputRef = useRef<HTMLInputElement>(null)
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false)
  const [fieldSearch, setFieldSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const portalContainer = getPortalContainer()

  const handleOpenChange = (open: boolean) => {
    setFieldMenuOpen(open)
    if (open) {
      setFieldSearch('')
      setHighlightedIndex(0)
    }
  }

  const filteredTokenGroups = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase()
    return TOKEN_CATEGORIES.map((cat) => ({
      ...cat,
      tokens: AVAILABLE_TOKENS.filter(
        (t) =>
          t.category === cat.id &&
          (!q ||
            t.label.toLowerCase().includes(q) ||
            t.token.toLowerCase().includes(q) ||
            (t.sampleValue ? t.sampleValue.toLowerCase().includes(q) : false))
      ),
    })).filter((g) => g.tokens.length > 0)
  }, [fieldSearch])

  const flatTokens = useMemo(() => filteredTokenGroups.flatMap((g) => g.tokens), [filteredTokenGroups])
  const handleSearchChange = (val: string) => {
    setFieldSearch(val)
    setHighlightedIndex(0)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatTokens.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % flatTokens.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + flatTokens.length) % flatTokens.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = flatTokens[highlightedIndex]
      if (selected) {
        handleAddToken(selected.token)
        setFieldMenuOpen(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setFieldMenuOpen(false)
    }
  }

  const handleSelectToken = (tokenKey: string) => {
    handleAddToken(tokenKey)
    setFieldMenuOpen(false)
  }

  useEffect(() => {
    if (!fieldMenuOpen) return
    const activeEl = listRef.current?.querySelector(`[data-token-index="${highlightedIndex}"]`) as HTMLElement | null
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, fieldMenuOpen])

  const handleAddToken = (tokenKey: string) => {
    if (!tokenKey) return
    const tokenDef = AVAILABLE_TOKENS.find((t) => t.token === tokenKey)
    if (!tokenDef) return

    const newId = `${tokenKey}_${Date.now()}`
    const newElement: CertificateElement = {
      id: newId,
      type: 'token',
      token: tokenKey,
      label: tokenDef.label,
      x: 50,
      y: 50,
      fontSize: 13,
      fontWeight: 'bold',
      fontFamily: 'sans',
      color: '#0f172a',
      textAlign: 'left',
      isVisible: true,
    }
    onAddElement(newElement)
    onSelectElement(newId)
  }

  const handleAddImageToken = (
    token: string,
    label: string,
    imageWidth = 80,
    defaultX = 50,
    defaultY = 15
  ) => {
    const newId = `${token}_${Date.now()}`
    const newElement: CertificateElement = {
      id: newId,
      type: 'image',
      token,
      label,
      imageWidth,
      x: defaultX,
      y: defaultY,
      isVisible: true,
    }
    onAddElement(newElement)
    onSelectElement(newId)
  }

  const handleCustomImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    readImageFile(e, (dataUrl, name) => {
      const newId = `img_${Date.now()}`
      onAddElement({
        id: newId,
        type: 'image',
        imageUrl: dataUrl,
        label: name,
        imageWidth: 90,
        x: 50,
        y: 20,
        isVisible: true,
      })
      onSelectElement(newId)
    })
  }

  const handleAddStaticText = () => {
    const newId = `static_${Date.now()}`
    const newElement: CertificateElement = {
      id: newId,
      type: 'static',
      text: __('Custom Text Block', 'codeclove-school-management'),
      label: __('Custom Text', 'codeclove-school-management'),
      x: 50,
      y: 50,
      fontSize: 13,
      fontWeight: 'normal',
      fontFamily: 'sans',
      color: '#475569',
      textAlign: 'left',
      isVisible: true,
    }
    onAddElement(newElement)
    onSelectElement(newId)
  }

  const handleAddLine = () => {
    const newId = `line_${Date.now()}`
    const newElement: CertificateElement = {
      id: newId,
      type: 'line',
      label: __('Signature Line', 'codeclove-school-management'),
      x: 50,
      y: 80,
      lineWidth: 130,
      lineHeight: 1,
      lineStyle: 'solid',
      color: '#cbd5e1',
      isVisible: true,
    }
    onAddElement(newElement)
    onSelectElement(newId)
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    readImageFile(e, (dataUrl) => {
      onBackgroundUrlChange(dataUrl)
      setBgInputOpen(false)
    })
  }

  return (
    <div className="border-b border-border bg-bg-elevated px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* ── ZONE 1 (Left): Document Specs & Orientation ── */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-0.5 bg-bg-surface rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => onOrientationChange('portrait')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5',
                orientation === 'portrait'
                  ? 'bg-bg-elevated text-text shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <FileText size={12} className={orientation === 'portrait' ? 'text-brand' : 'text-text-subtle'} />
              <span>{__('Portrait', 'codeclove-school-management')}</span>
            </button>
            <button
              type="button"
              onClick={() => onOrientationChange('landscape')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5',
                orientation === 'landscape'
                  ? 'bg-bg-elevated text-text shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <FileText size={12} className={cn('rotate-90', orientation === 'landscape' ? 'text-brand' : 'text-text-subtle')} />
              <span>{__('Landscape', 'codeclove-school-management')}</span>
            </button>
          </div>

          <Tooltip content={__('Standard A4 ISO 216 (210 × 297mm) at 300 DPI print quality', 'codeclove-school-management')}>
            <span className="text-2xs font-mono text-text-subtle bg-bg-surface px-2 py-1 rounded border border-border/60 hidden sm:inline-block cursor-help">
              A4 • 300 DPI
            </span>
          </Tooltip>
        </div>

        {/* ── ZONE 2 (Center): Unified Creation Tools ── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Add Dynamic Field Searchable Dropdown */}
          <PopoverPrimitive.Root open={fieldMenuOpen} onOpenChange={handleOpenChange}>
            <PopoverPrimitive.Trigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
              >
                <Plus size={13} className="text-brand" />
                <span>{__('Add Field', 'codeclove-school-management')}</span>
                <ChevronDown
                  size={11}
                  className={cn(
                    'text-text-subtle -ms-0.5 transition-transform duration-150',
                    fieldMenuOpen && 'rotate-180'
                  )}
                />
              </Button>
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal container={portalContainer}>
              <PopoverPrimitive.Content
                align="start"
                sideOffset={4}
                onOpenAutoFocus={(e) => {
                  e.preventDefault()
                  searchInputRef.current?.focus()
                }}
                className="z-[100050] w-56 overflow-hidden rounded-lg bg-bg-overlay border border-border shadow-modal outline-none animate-slide-down flex flex-col"
              >
                {/* Seamless Search Header matching Combobox pattern */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border bg-bg-surface shrink-0">
                  <Search size={13} className="text-text-subtle shrink-0" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    role="searchbox"
                    value={fieldSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={__('Search fields...', 'codeclove-school-management')}
                    aria-label={__('Search fields', 'codeclove-school-management')}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    style={{
                      border: 'none',
                      borderRadius: 0,
                      outline: 'none',
                      boxShadow: 'none',
                      background: 'transparent',
                    }}
                    className="flex-1 bg-transparent !border-0 !border-none !rounded-none !outline-none !shadow-none !ring-0 text-xs text-text placeholder:text-text-muted p-0 !m-0 !h-auto font-normal focus:!ring-0 focus-visible:!ring-0"
                  />
                  {fieldSearch ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleSearchChange('')}
                      className="text-text-subtle hover:text-text p-0.5 rounded cursor-pointer transition-colors"
                      aria-label={__('Clear search', 'codeclove-school-management')}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {/* Scrollable Token Groups matching DropdownItem & DropdownLabel specs */}
                <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
                  {filteredTokenGroups.length > 0 ? (
                    filteredTokenGroups.map((group, idx) => (
                      <div key={group.id}>
                        {idx > 0 && <div className="my-1 h-px bg-border" />}
                        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-subtle select-none">
                          {group.label}
                        </div>
                        {group.tokens.map((token) => {
                          const globalIdx = flatTokens.findIndex((t) => t.token === token.token)
                          const isHighlighted = globalIdx === highlightedIndex

                          return (
                            <button
                              key={token.token}
                              type="button"
                              data-token-index={globalIdx}
                              onClick={() => handleSelectToken(token.token)}
                              onMouseEnter={() => setHighlightedIndex(globalIdx)}
                              className={cn(
                                'w-full flex items-center px-3 py-1.5 rounded-md text-xs cursor-pointer select-none text-left transition-colors duration-100 outline-none',
                                isHighlighted
                                  ? 'bg-hover-bg text-text font-medium'
                                  : 'text-text-muted hover:bg-hover-bg hover:text-text'
                              )}
                            >
                              <span className="truncate">{token.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="py-4 px-3 text-center text-xs text-text-muted select-none">
                      {__('No fields found.', 'codeclove-school-management')}
                    </div>
                  )}
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
          {/* Add Static Text */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddStaticText}
            className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
          >
            <Type size={13} />
            <span>{__('Text', 'codeclove-school-management')}</span>
          </Button>

          {/* Add Line / Rule / Signature Line */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddLine}
            className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
            title={__('Add a signature line or decorative divider rule', 'codeclove-school-management')}
          >
            <Minus size={13} />
            <span>{__('Line', 'codeclove-school-management')}</span>
          </Button>

          {/* Add Image Dropdown */}
          <Dropdown
            align="start"
            trigger={
              <Button variant="secondary" size="sm" className="h-8 text-xs gap-1.5 shadow-2xs font-medium">
                <ImageIcon size={13} />
                <span>{__('Image', 'codeclove-school-management')}</span>
                <ChevronDown size={11} className="text-text-subtle -ms-0.5" />
              </Button>
            }
          >
            <DropdownItem
              icon={Building2}
              onClick={() => handleAddImageToken('school_logo', __('School Logo', 'codeclove-school-management'), 80, 50, 8.5)}
            >
              {__('School Logo', 'codeclove-school-management')}
            </DropdownItem>
            <DropdownItem
              icon={PenTool}
              onClick={() => handleAddImageToken('principal_signature_image', __('Principal Signature', 'codeclove-school-management'), 110, 80, 84)}
            >
              {__('Principal Signature', 'codeclove-school-management')}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              icon={Upload}
              onClick={() => customImageInputRef.current?.click()}
            >
              {__('Upload Custom Image...', 'codeclove-school-management')}
            </DropdownItem>
          </Dropdown>
          <input
            ref={customImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCustomImageUpload}
          />

          {/* Background Stationery */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setBgInputOpen(!bgInputOpen)}
            className={cn(
              'h-8 text-xs gap-1.5 shadow-2xs font-medium',
              backgroundUrl && 'border-brand/40 text-brand bg-brand-dim'
            )}
          >
            <FileImage size={13} />
            <span>{backgroundUrl ? __('Border Active', 'codeclove-school-management') : __('Add Border', 'codeclove-school-management')}</span>
          </Button>

          {backgroundUrl && (
            <button
              type="button"
              onClick={() => onBackgroundUrlChange(null)}
              className="text-2xs text-danger hover:underline px-1 cursor-pointer font-medium"
              title={__('Remove Background Border', 'codeclove-school-management')}
            >
              {__('Clear', 'codeclove-school-management')}
            </button>
          )}
        </div>

        {/* ── ZONE 3 (Right): Studio Utilities & View Controls ── */}
        <div className="flex items-center gap-2">
          {/* Sample Data vs Token Code Toggle */}
          {onToggleSampleMode && (
            <Tooltip
              content={
                sampleMode
                  ? __('Switch to token code view (e.g. {student_name})', 'codeclove-school-management')
                  : __('Switch to realistic sample data preview', 'codeclove-school-management')
              }
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onToggleSampleMode}
                className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
              >
                {sampleMode ? <Eye size={13} className="text-brand" /> : <Code2 size={13} className="text-brand" />}
                <span>{sampleMode ? __('Preview Data', 'codeclove-school-management') : __('Tokens Mode', 'codeclove-school-management')}</span>
              </Button>
            </Tooltip>
          )}

          {/* Canvas Zoom Stepper & Fit */}
          {zoom !== undefined && onZoomIn && onZoomOut && onResetZoom && (
            <div className="flex items-center gap-1 bg-bg-surface border border-border rounded-lg p-0.5 text-xs text-text-muted">
              <button
                type="button"
                onClick={onZoomOut}
                disabled={zoom <= 0.6}
                className="p-1 hover:text-text disabled:opacity-40 cursor-pointer transition-colors"
                title={__('Zoom out', 'codeclove-school-management')}
              >
                <Minus size={12} />
              </button>
              <span className="w-10 text-center font-mono text-2xs select-none text-text">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={onZoomIn}
                disabled={zoom >= 1.4}
                className="p-1 hover:text-text disabled:opacity-40 cursor-pointer transition-colors"
                title={__('Zoom in', 'codeclove-school-management')}
              >
                <Plus size={12} />
              </button>
              <button
                type="button"
                onClick={onResetZoom}
                className="px-1.5 py-0.5 text-2xs hover:text-text text-text-subtle border-l border-border cursor-pointer transition-colors"
                title={__('Reset zoom to fit (100%)', 'codeclove-school-management')}
              >
                {__('Fit', 'codeclove-school-management')}
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-border mx-0.5 hidden sm:block" />

          {/* Reset Layout Starter Preset with Confirmation */}
          <div className="relative">
            <Tooltip content={__('Reset all canvas elements to default starter preset', 'codeclove-school-management')}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="h-8 text-xs text-text-subtle hover:text-danger hover:bg-danger-dim gap-1 font-medium"
              >
                <RotateCcw size={12} />
                <span>{__('Reset', 'codeclove-school-management')}</span>
              </Button>
            </Tooltip>

            {showResetConfirm && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-bg-elevated border border-border rounded-xl shadow-xl p-3 z-50 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-text font-medium text-xs leading-snug">
                    {__('Reset layout to starter preset? Unsaved canvas changes will be overwritten.', 'codeclove-school-management')}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    {__('Cancel', 'codeclove-school-management')}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => {
                      setShowResetConfirm(false)
                      onResetLayout()
                    }}
                  >
                    {__('Confirm', 'codeclove-school-management')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Background Upload/URL Drawer */}
      {bgInputOpen && (
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2.5 mt-2.5 border-t border-border">
          <label className="cursor-pointer shrink-0">
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs font-medium text-text hover:bg-bg-elevated cursor-pointer transition-colors shadow-2xs">
              <ImageIcon size={13} />
              {__('Upload Image (PNG/JPG)', 'codeclove-school-management')}
            </span>
          </label>
          <span className="text-2xs text-text-muted shrink-0">{__('or image URL:', 'codeclove-school-management')}</span>
          <Input
            value={bgUrlDraft}
            onChange={(e) => setBgUrlDraft(e.target.value)}
            placeholder="https://example.com/certificate-border.png"
            className="text-xs h-8 flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onBackgroundUrlChange(bgUrlDraft || null)
              setBgInputOpen(false)
            }}
            className="text-xs h-8"
          >
            {__('Apply', 'codeclove-school-management')}
          </Button>
        </div>
      )}
    </div>
  )
}
