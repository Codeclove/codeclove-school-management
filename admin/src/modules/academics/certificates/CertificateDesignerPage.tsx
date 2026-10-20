import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import {
  PageHeader,
  Button,
  Input,
  Skeleton,
  Spinner,
  Select,
} from '@/components/ui'
import {
  useCertificateTemplate,
  useCreateCertificateTemplate,
  useUpdateCertificateTemplate,
  type CertificateTemplate,
  type CertificateElement,
} from '@/api/certificates'
import { CertificateCanvas } from './components/CertificateCanvas'
import { CertificateToolbar } from './components/CertificateToolbar'
import { CertificateInspector } from './components/CertificateInspector'
import {
  DEFAULT_PORTRAIT_ELEMENTS,
  DEFAULT_SAMPLE_DATA,
  getStarterPreset,
} from './certificate-defaults'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { __ } from '@/lib/i18n'

export default function CertificateDesignerPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const templateId = id ? Number(id) : null

  const { data: existingTemplate, isLoading: loadingExisting } = useCertificateTemplate(templateId || undefined)

  const [draftTitle, setDraftTitle] = useState('School Transfer Certificate')
  const [draftType, setDraftType] = useState<CertificateTemplate['type']>('transfer')
  const [draftOrientation, setDraftOrientation] = useState<CertificateTemplate['orientation']>('portrait')
  const [draftBackgroundUrl, setDraftBackgroundUrl] = useState<string | null>(null)
  const [draftElements, setDraftElements] = useState<CertificateElement[]>(DEFAULT_PORTRAIT_ELEMENTS)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [sampleMode, setSampleMode] = useState(true)
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = () => setZoom((prev) => Math.min(Number((prev + 0.1).toFixed(1)), 1.4))
  const handleZoomOut = () => setZoom((prev) => Math.max(Number((prev - 0.1).toFixed(1)), 0.6))
  const handleResetZoom = () => setZoom(1)

  const createMutation = useCreateCertificateTemplate()
  const updateMutation = useUpdateCertificateTemplate()

  // Populate existing template data when loaded
  useEffect(() => {
    if (existingTemplate) {
      setDraftTitle(existingTemplate.title)
      setDraftType(existingTemplate.type)
      setDraftOrientation(existingTemplate.orientation)
      setDraftBackgroundUrl(existingTemplate.background_url || null)
      if (Array.isArray(existingTemplate.layout_data) && existingTemplate.layout_data.length > 0) {
        setDraftElements(existingTemplate.layout_data)
      }
    }
  }, [existingTemplate])

  const handleTypeChange = async (newType: CertificateTemplate['type']) => {
    if (draftElements.length > 0) {
      const ok = await confirm({
        title: __('Switch Certificate Type?', 'codeclove-school-management'),
        message: __('Changing certificate type will reset your canvas layout to the preset for this type. Continue?', 'codeclove-school-management'),
        confirmText: __('Reset Layout', 'codeclove-school-management'),
        variant: 'warning',
      })
      if (!ok) return
    }

    setDraftType(newType)

    // Suggest appropriate default orientation for the certificate type
    const targetOrientation: 'portrait' | 'landscape' = newType === 'merit' ? 'landscape' : 'portrait'
    setDraftOrientation(targetOrientation)

    // Load matching preset for this certificate type
    const preset = getStarterPreset(newType, targetOrientation)
    setDraftElements(preset)
    setSelectedElementId(null)
    // Update title if it's default or matches standard type titles
    const isGeneric =
      !draftTitle ||
      draftTitle === 'New Certificate Template' ||
      draftTitle.includes('Transfer') ||
      draftTitle.includes('Merit') ||
      draftTitle.includes('Character') ||
      draftTitle.includes('Completion')

    if (isGeneric) {
      if (newType === 'merit') setDraftTitle(__('Academic Merit Certificate', 'codeclove-school-management'))
      else if (newType === 'character') setDraftTitle(__('Character & Conduct Certificate', 'codeclove-school-management'))
      else if (newType === 'completion') setDraftTitle(__('Course Completion Certificate', 'codeclove-school-management'))
      else setDraftTitle(__('School Transfer Certificate', 'codeclove-school-management'))
    }

    toast.info(__('Loaded template layout for selected certificate type.', 'codeclove-school-management'))
  }

  const handleOrientationChange = async (newOrientation: 'portrait' | 'landscape') => {
    if (newOrientation === draftOrientation) return
    if (draftElements.length > 0) {
      const ok = await confirm({
        title: __('Change Orientation?', 'codeclove-school-management'),
        message: __('Switching orientation will adapt your canvas layout to the preset for this orientation. Continue?', 'codeclove-school-management'),
        confirmText: __('Change Orientation', 'codeclove-school-management'),
        variant: 'warning',
      })
      if (!ok) return
    }

    setDraftOrientation(newOrientation)
    const preset = getStarterPreset(draftType, newOrientation)
    setDraftElements(preset)
    setSelectedElementId(null)
  }

  const handleResetLayout = () => {
    const preset = getStarterPreset(draftType, draftOrientation)
    setDraftElements(preset)
    setSelectedElementId(null)
    toast.success(__('Layout reset to starter preset.', 'codeclove-school-management'))
  }

  const handleSave = async () => {
    if (!draftTitle.trim()) {
      toast.error(__('Template title is required.', 'codeclove-school-management'))
      return
    }

    try {
      if (templateId) {
        await updateMutation.mutateAsync({
          id: templateId,
          data: {
            title: draftTitle,
            type: draftType,
            orientation: draftOrientation,
            background_url: draftBackgroundUrl,
            layout_data: draftElements,
          },
        })
        toast.success(__('Certificate template updated.', 'codeclove-school-management'))
      } else {
        await createMutation.mutateAsync({
          title: draftTitle,
          type: draftType,
          orientation: draftOrientation,
          background_url: draftBackgroundUrl,
          layout_data: draftElements,
        })
        toast.success(__('Certificate template created.', 'codeclove-school-management'))
      }
      navigate('/academics/certificates')
    } catch {
      toast.error(__('Failed to save certificate template.', 'codeclove-school-management'))
    }
  }

  if (templateId && loadingExisting) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="rounded-xl border border-border bg-bg-elevated p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3.5">
      <PageHeader
        title={templateId ? __('Edit Certificate Template', 'codeclove-school-management') : __('Create Certificate Template', 'codeclove-school-management')}
        breadcrumbs={[
          { label: __('Academics', 'codeclove-school-management'), href: '/academics/sessions' },
          { label: __('Certificates', 'codeclove-school-management'), href: '/academics/certificates' },
          { label: templateId ? __('Edit Template', 'codeclove-school-management') : __('New Template', 'codeclove-school-management') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/academics/certificates')}
              className="gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>{__('Cancel', 'codeclove-school-management')}</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <Save size={14} />
              )}
              <span>{__('Save Template', 'codeclove-school-management')}</span>
            </Button>
          </div>
        }
      />

      {/* Studio Workstation Container */}
      <div className="bg-bg-elevated border border-border rounded-2xl shadow-xs overflow-hidden">
        {/* Studio Meta Strip: Template Title, Type, and Quick Status */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-2.5 bg-bg-surface/50 border-b border-border">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <label htmlFor="cert-template-title" className="text-xs font-semibold text-text whitespace-nowrap">
                {__('Title:', 'codeclove-school-management')}
              </label>
              <Input
                id="cert-template-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="text-xs h-8 flex-1 bg-bg-elevated"
                placeholder={__('e.g. CBSE Transfer Certificate', 'codeclove-school-management')}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="cert-template-type" className="text-xs font-semibold text-text whitespace-nowrap">
                {__('Type:', 'codeclove-school-management')}
              </label>
              <Select
                id="cert-template-type"
                value={draftType}
                onValueChange={(val) => handleTypeChange(val as CertificateTemplate['type'])}
                options={[
                  { value: 'transfer', label: __('Transfer Certificate (TC)', 'codeclove-school-management') },
                  { value: 'merit', label: __('Merit / Award Certificate', 'codeclove-school-management') },
                  { value: 'character', label: __('Character Certificate', 'codeclove-school-management') },
                  { value: 'completion', label: __('Course Completion Certificate', 'codeclove-school-management') },
                  { value: 'general', label: __('General School Certificate', 'codeclove-school-management') },
                ]}
                className="w-56 text-xs h-8 bg-bg-elevated"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-2xs text-text-subtle font-mono shrink-0 self-end sm:self-auto">
            <span className="bg-bg-surface px-2 py-0.5 rounded border border-border">
              {draftElements.length} {__('elements', 'codeclove-school-management')}
            </span>
            {templateId && (
              <span className="bg-bg-surface px-2 py-0.5 rounded border border-border">
                ID: #{templateId}
              </span>
            )}
          </div>
        </div>

        {/* Top Studio Creation Toolbar */}
        <CertificateToolbar
          orientation={draftOrientation}
          onOrientationChange={handleOrientationChange}
          backgroundUrl={draftBackgroundUrl}
          onBackgroundUrlChange={setDraftBackgroundUrl}
          onSelectElement={setSelectedElementId}
          onAddElement={(newEl) => setDraftElements((prev) => [...prev, newEl])}
          onResetLayout={handleResetLayout}
          sampleMode={sampleMode}
          onToggleSampleMode={() => setSampleMode((prev) => !prev)}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
        />

        {/* Workstation Body: Left = Canvas Stage, Right = Full-Height Docked Inspector */}
        <div className="flex flex-col xl:flex-row min-h-[750px]">
          {/* Canvas Stage */}
          <div className="flex-1 p-6 sm:p-10 bg-bg-surface/30 overflow-auto flex items-start justify-center">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.12s ease-out',
              }}
              className={`w-full ${
                draftOrientation === 'portrait' ? 'max-w-2xl' : 'max-w-4xl'
              } shadow-xl border border-border/80 rounded-sm`}
            >
              <CertificateCanvas
                orientation={draftOrientation}
                backgroundUrl={draftBackgroundUrl}
                elements={draftElements}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateElement={(elId, updates) =>
                  setDraftElements((prev) =>
                    prev.map((el) => (el.id === elId ? { ...el, ...updates } : el))
                  )
                }
                isEditing={true}
                tokenMode={!sampleMode}
                sampleOrRealData={DEFAULT_SAMPLE_DATA}
              />
            </div>
          </div>

          {/* Docked Inspector Sidebar: Full-Height, Seamless */}
          <div className="w-full xl:w-84 2xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-bg-elevated flex flex-col shrink-0">
            <CertificateInspector
              selectedElement={draftElements.find((el) => el.id === selectedElementId) || null}
              elements={draftElements}
              onSelectElement={setSelectedElementId}
              onUpdateElement={(elId, updates) =>
                setDraftElements((prev) =>
                  prev.map((el) => (el.id === elId ? { ...el, ...updates } : el))
                )
              }
              onDeleteElement={(elId) => setDraftElements((prev) => prev.filter((el) => el.id !== elId))}
              backgroundUrl={draftBackgroundUrl}
              onBackgroundUrlChange={setDraftBackgroundUrl}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
