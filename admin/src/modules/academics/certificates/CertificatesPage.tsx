import { useState, useRef, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Award,
  Plus,
  Printer,
  Pencil,
  Trash2,
  FileCheck,
} from 'lucide-react'
import {
  PageHeader,
  Button,
  Badge,
  DataTable,
  FilterBar,
  PersonAvatar,
  Select,
  type DataTableColumn,
} from '@/components/ui'
import {
  useCertificateTemplates,
  useDeleteCertificateTemplate,
  useIssuedCertificates,
  useDeleteIssuedCertificate,
  useBulkDeleteIssuedCertificates,
  type CertificateTemplate,
  type IssuedCertificate,
  resolveCertificatePrintData,
} from '@/api/certificates'
import { useUnits, useGroups } from '@/api/academics'
import { CertificateDocument } from './components/CertificateDocument'
import { getFallbackTemplate } from './certificate-defaults'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { printElement } from '@/lib/print'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'


export default function CertificatesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'templates' | 'issued'>(
    tabFromUrl === 'issued' ? 'issued' : 'templates'
  )

  useEffect(() => {
    if (tabFromUrl === 'issued' && activeTab !== 'issued') {
      setActiveTab('issued')
    } else if (tabFromUrl !== 'issued' && activeTab === 'issued' && !tabFromUrl) {
      setActiveTab('templates')
    }
  }, [tabFromUrl])
  const [reprintCert, setReprintCert] = useState<IssuedCertificate | null>(null)
  const [bulkReprintCerts, setBulkReprintCerts] = useState<IssuedCertificate[]>([])
  const reprintRef = useRef<HTMLDivElement>(null)
  const bulkPrintRef = useRef<HTMLDivElement>(null)

  // Query all templates (unfiltered) for select dropdowns, names, and reprint resolution
  const { data: allTemplatesData } = useCertificateTemplates({ per_page: 200 })
  const allTemplates = allTemplatesData?.templates || []

  // Table state & filters for Templates Library
  const templatesTable = useTableState({
    defaultPerPage: 10,
  })
  const [templateSearch, setTemplateSearch] = useState('')
  const debouncedTemplateSearch = useDebounce(templateSearch, 300)
  const [templateTypeFilter, setTemplateTypeFilter] = useState<string>('')
  const [templateOrientationFilter, setTemplateOrientationFilter] = useState<string>('')

  const {
    data: templatesData,
    isLoading: loadingTemplates,
    isError: isErrorTemplates,
    refetch: refetchTemplates,
  } = useCertificateTemplates({
    search: debouncedTemplateSearch || undefined,
    type: templateTypeFilter || undefined,
    orientation: templateOrientationFilter || undefined,
    page: templatesTable.page,
    per_page: templatesTable.perPage === 'all' ? 9999 : templatesTable.perPage,
    order_by: templatesTable.orderby || undefined,
    order: (templatesTable.order as 'asc' | 'desc') || undefined,
  })
  const templates = templatesData?.templates || []
  const totalTemplates = templatesData?.total || 0

  const hasActiveTemplateFilters = Boolean(
    templateSearch || templateTypeFilter || templateOrientationFilter
  )
  const activeTemplateFilterCount =
    (templateTypeFilter ? 1 : 0) + (templateOrientationFilter ? 1 : 0)

  const handleClearTemplateFilters = () => {
    setTemplateSearch('')
    setTemplateTypeFilter('')
    setTemplateOrientationFilter('')
    templatesTable.resetPage()
    templatesTable.clearSelection()
  }

  // Table state & filters for Issued Register
  const issuedTable = useTableState({
    defaultPerPage: 10,
  })

  const [registerSearch, setRegisterSearch] = useState('')
  const debouncedSearch = useDebounce(registerSearch, 300)
  const [templateFilter, setTemplateFilter] = useState<string>('')
  const [unitFilter, setUnitFilter] = useState<string>('')
  const [groupFilter, setGroupFilter] = useState<string>('')

  // Academic Units (Classes) & Groups (Sections)
  const { data: unitsData } = useUnits({ per_page: 200 })
  const units = unitsData?.data ?? []

  const { data: groupsData } = useGroups({
    academic_unit_id: unitFilter ? Number(unitFilter) : undefined,
    per_page: 200,
  })
  const groups = groupsData?.data ?? []

  const {
    data: issuedData,
    isLoading: loadingIssued,
  } = useIssuedCertificates({
    search: debouncedSearch || undefined,
    template_id: templateFilter ? Number(templateFilter) : undefined,
    academic_unit_id: unitFilter ? Number(unitFilter) : undefined,
    academic_group_id: groupFilter ? Number(groupFilter) : undefined,
    page: issuedTable.page,
    per_page: issuedTable.perPage === 'all' ? 9999 : issuedTable.perPage,
  })

  const issuedCertificates = issuedData?.certificates || []
  const totalIssued = issuedData?.total || 0

  const hasActiveFilters = Boolean(registerSearch || templateFilter || unitFilter || groupFilter)

  const handleClearFilters = () => {
    setRegisterSearch('')
    setTemplateFilter('')
    setUnitFilter('')
    setGroupFilter('')
    issuedTable.resetPage()
    issuedTable.clearSelection()
  }

  const deleteMutation = useDeleteCertificateTemplate()
  const deleteIssuedMutation = useDeleteIssuedCertificate()
  const bulkDeleteIssuedMutation = useBulkDeleteIssuedCertificates()
  const handleDeleteTemplate = async (tpl: CertificateTemplate) => {
    const isConfirmed = await confirm({
      title: sprintf(__('Delete %s?', 'codeclove-school-management'), tpl.title),
      message: __('Are you sure you want to delete this template? Issued certificates using this template will retain their frozen historical snapshot.', 'codeclove-school-management'),
      confirmText: __('Delete', 'codeclove-school-management'),
      variant: 'danger',
    })
    if (!isConfirmed) return

    try {
      await deleteMutation.mutateAsync(tpl.id)
      toast.success(__('Template deleted.', 'codeclove-school-management'))
    } catch {
      toast.error(__('Failed to delete template.', 'codeclove-school-management'))
    }
  }

  const handleReprint = (cert: IssuedCertificate) => {
    setReprintCert(cert)
    setTimeout(() => {
      if (reprintRef.current) {
        printElement(reprintRef.current)
      }
    }, 100)
  }

  const handleBulkReprint = () => {
    const selected = issuedCertificates.filter((c) => issuedTable.selectedIds.includes(c.id))
    if (!selected.length) {
      toast.error(__('No certificates selected for reprint.', 'codeclove-school-management'))
      return
    }
    setBulkReprintCerts(selected)
    setTimeout(() => {
      if (bulkPrintRef.current) {
        printElement(bulkPrintRef.current)
      }
    }, 150)
  }
  const handleDeleteIssued = async (cert: IssuedCertificate) => {
    const studentName = cert.metadata?.student?.full_name || sprintf(__('Student #%d', 'codeclove-school-management'), cert.student_id)
    const isConfirmed = await confirm({
      title: sprintf(__('Delete Certificate %s?', 'codeclove-school-management'), cert.certificate_no),
      message: sprintf(
        __('Are you sure you want to permanently delete this certificate issued to %s? Any student status and enrollment updates made upon issuance will be restored to active.', 'codeclove-school-management'),
        studentName
      ),
      confirmText: __('Delete Certificate', 'codeclove-school-management'),
      variant: 'danger',
    })
    if (!isConfirmed) return

    try {
      await deleteIssuedMutation.mutateAsync({ id: cert.id, revertStudentStatus: true })
      toast.success(__('Certificate permanently deleted.', 'codeclove-school-management'))
      issuedTable.clearSelection()
    } catch {
      toast.error(__('Failed to delete certificate.', 'codeclove-school-management'))
    }
  }

  const handleBulkDeleteIssued = async () => {
    const selectedIds = issuedTable.selectedIds.map(Number).filter(Boolean)
    if (!selectedIds.length) return

    const isConfirmed = await confirm({
      title: sprintf(__('Delete %d Certificates?', 'codeclove-school-management'), selectedIds.length),
      message: __(
        'Are you sure you want to permanently delete the selected certificates? Any enrollment or status changes associated with these certificates will be reverted to active.',
        'codeclove-school-management'
      ),
      confirmText: sprintf(__('Delete %d Certificates', 'codeclove-school-management'), selectedIds.length),
      variant: 'danger',
    })
    if (!isConfirmed) return

    try {
      const res = await bulkDeleteIssuedMutation.mutateAsync({ ids: selectedIds, revertStudentStatus: true })
      toast.success(
        sprintf(__('Successfully deleted %d certificates.', 'codeclove-school-management'), res.deleted_count)
      )
      issuedTable.clearSelection()
    } catch {
      toast.error(__('Failed to delete selected certificates.', 'codeclove-school-management'))
    }
  }

  // ─── Streamlined Templates Library Columns ──────────────────────────────────
  const templateColumns: DataTableColumn<CertificateTemplate>[] = useMemo(
    () => [
      {
        key: 'title',
        header: __('Template Name', 'codeclove-school-management'),
        type: 'primary',
        sortable: true,
        render: (tpl) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/academics/certificates/templates/${tpl.id}`)}
              className="font-semibold text-text hover:text-brand transition-colors text-left cursor-pointer"
            >
              {tpl.title}
            </button>
            {tpl.is_default && (
              <Badge variant="success" className="text-3xs">
                {__('Default', 'codeclove-school-management')}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: 'type',
        header: __('Type', 'codeclove-school-management'),
        sortable: true,
        align: 'center',
        render: (tpl) => {
          const typeLabels: Record<string, string> = {
            transfer: __('Transfer', 'codeclove-school-management'),
            merit: __('Merit', 'codeclove-school-management'),
            character: __('Character', 'codeclove-school-management'),
            completion: __('Completion', 'codeclove-school-management'),
            general: __('General', 'codeclove-school-management'),
          }
          const label = typeLabels[tpl.type] || tpl.type || __('Academic', 'codeclove-school-management')
          return (
            <Badge variant="outline" className="text-3xs capitalize">
              {label}
            </Badge>
          )
        },
      },
      {
        key: 'orientation',
        header: __('Orientation', 'codeclove-school-management'),
        sortable: true,
        render: (tpl) => (
          <span className="text-xs text-text-muted capitalize">
            {tpl.orientation || 'landscape'}
          </span>
        ),
      },
      {
        key: 'issued_count',
        header: __('Issued', 'codeclove-school-management'),
        sortable: true,
        align: 'right',
        render: (tpl) => (
          <button
            type="button"
            onClick={() => {
              setTemplateFilter(String(tpl.id))
              setActiveTab('issued')
              issuedTable.resetPage()
            }}
            className="inline-flex items-center justify-end gap-1.5 text-xs font-mono font-medium text-text-muted hover:text-brand transition-colors cursor-pointer select-none group"
            title={sprintf(__('View %d certificates issued with this template', 'codeclove-school-management'), tpl.issued_count || 0)}
          >
            <FileCheck size={12} className="text-text-subtle group-hover:text-brand transition-colors" />
            <span className="tabular-nums underline underline-offset-4 decoration-border group-hover:decoration-brand">
              {tpl.issued_count || 0}
            </span>
          </button>
        ),
      },
      {
        key: 'actions',
        header: __('Actions', 'codeclove-school-management'),
        type: 'actions',
        align: 'right',
        render: (tpl) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/academics/certificates/templates/${tpl.id}`)}
              className="h-7 w-7 text-text-muted hover:text-brand"
              title={__('Edit Template', 'codeclove-school-management')}
            >
              <Pencil size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteTemplate(tpl)}
              className="h-7 w-7 text-text-muted hover:text-danger hover:bg-danger/10"
              title={__('Delete Template', 'codeclove-school-management')}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ),
      },
    ],
    [navigate, issuedTable]
  )

  // ─── Streamlined 5-Column Register Layout ────────────────────────────────────
  const issuedColumns: DataTableColumn<IssuedCertificate>[] = useMemo(
    () => [
      {
        key: 'certificate_no',
        header: __('Certificate No.', 'codeclove-school-management'),
        type: 'primary',
        render: (cert) => {
          const tpl = allTemplates.find((t) => t.id === cert.template_id)
          const templateName = tpl?.title || (cert.reason ? __('School Transfer Certificate', 'codeclove-school-management') : __('Academic Merit Certificate', 'codeclove-school-management'))
          return (
            <div className="space-y-0.5">
              <span className="font-mono text-xs font-semibold text-brand block">
                {cert.certificate_no}
              </span>
              <span className="text-2xs text-text-muted block truncate max-w-[220px]" title={templateName}>
                {templateName}
              </span>
            </div>
          )
        },
      },
      {
        key: 'student',
        header: __('Student', 'codeclove-school-management'),
        type: 'primary',
        render: (cert) => (
          <PersonAvatar
            name={cert.metadata.student?.full_name || sprintf(__('Student #%d', 'codeclove-school-management'), cert.student_id)}
            subtitle={cert.metadata.student?.admission_number || cert.metadata.student?.student_number}
            photoUrl={cert.metadata.student?.photo_url}
          />
        ),
      },
      {
        key: 'class_name',
        header: __('Class / Unit', 'codeclove-school-management'),
        render: (cert) => (
          <div className="text-xs text-text truncate max-w-[160px]">
            <span className="font-medium text-text block">
              {cert.metadata.academic?.unit_name || '—'}
            </span>
            {cert.metadata.academic?.group_name && (
              <span className="text-text-muted text-2xs block truncate">
                {cert.metadata.academic.group_name}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'issue_date',
        header: __('Date of Issue', 'codeclove-school-management'),
        type: 'date',
        render: (cert) => (
          <span className="text-xs text-text-muted whitespace-nowrap">
            {cert.issue_date}
          </span>
        ),
      },
      {
        key: 'actions',
        header: __('Actions', 'codeclove-school-management'),
        type: 'actions',
        align: 'right',
        render: (cert) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleReprint(cert)}
              className="h-7 text-xs gap-1.5"
              title={__('Reprint Certificate', 'codeclove-school-management')}
            >
              <Printer size={13} />
              <span>{__('Reprint', 'codeclove-school-management')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteIssued(cert)}
              disabled={deleteIssuedMutation.isPending}
              className="h-7 w-7 p-0 text-text-muted hover:text-danger hover:bg-danger/10"
              title={__('Delete Certificate', 'codeclove-school-management')}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ),
      },
    ],
    [allTemplates, deleteIssuedMutation.isPending]
  )

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        className="mb-0"
        title={__('Certificates', 'codeclove-school-management')}
        description={__('Create templates and issue official student certificates.', 'codeclove-school-management')}
        breadcrumbs={[
          { label: __('Academics', 'codeclove-school-management'), href: '/academics/sessions' },
          { label: __('Certificates', 'codeclove-school-management') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/academics/certificates/templates/new')}
              className="gap-1.5"
            >
              <Plus size={14} />
              <span>{__('New Template', 'codeclove-school-management')}</span>
            </Button>
            <Button
              onClick={() => navigate('/academics/certificates/issue')}
              className="gap-1.5"
            >
              <Award size={14} />
              <span>{__('Issue Certificate', 'codeclove-school-management')}</span>
            </Button>
          </div>
        }
      />

      {/* ─── Tactile Segmented Pill Navigation ─────────────────────────────────── */}
      <div className="p-1 rounded-xl bg-bg-surface border border-border inline-flex items-center gap-1 self-start text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setActiveTab('templates')
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.delete('tab')
              return next
            }, { replace: true })
            setTemplateFilter('')
            issuedTable.resetPage()
          }}
          className={cn(
            'inline-flex items-center justify-center gap-2 font-medium text-xs rounded-lg transition-all h-8 px-3.5 select-none cursor-pointer',
            activeTab === 'templates'
              ? 'bg-bg-elevated text-text font-semibold shadow-xs border border-border'
              : 'text-text-muted hover:text-text hover:bg-hover-bg'
          )}
        >
          <Award size={14} className={activeTab === 'templates' ? 'text-brand' : 'text-text-muted'} />
          <span>{__('Templates Library', 'codeclove-school-management')}</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono',
              activeTab === 'templates'
                ? 'bg-brand-dim text-brand'
                : 'bg-hover-bg text-text-subtle'
            )}
          >
            {allTemplatesData?.total ?? allTemplates.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('issued')
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.set('tab', 'issued')
              return next
            }, { replace: true })
          }}
          className={cn(
            'inline-flex items-center justify-center gap-2 font-medium text-xs rounded-lg transition-all h-8 px-3.5 select-none cursor-pointer',
            activeTab === 'issued'
              ? 'bg-bg-elevated text-text font-semibold shadow-xs border border-border'
              : 'text-text-muted hover:text-text hover:bg-hover-bg'
          )}
        >
          <FileCheck size={14} className={activeTab === 'issued' ? 'text-brand' : 'text-text-muted'} />
          <span>{__('Issued Register', 'codeclove-school-management')}</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono',
              activeTab === 'issued'
                ? 'bg-brand-dim text-brand'
                : 'bg-hover-bg text-text-subtle'
            )}
          >
            {totalIssued}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: Templates Library (Professional FilterBar & DataTable) ─────── */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Integrated FilterBar for Templates */}
          <FilterBar
            search={templateSearch}
            onSearchChange={(val) => {
              setTemplateSearch(val)
              templatesTable.resetPage()
            }}
            searchPlaceholder={__('Search templates by name...', 'codeclove-school-management')}
            activeFilterCount={activeTemplateFilterCount}
            onClearAll={handleClearTemplateFilters}
          >
            <Select
              value={templateTypeFilter}
              onValueChange={(val) => {
                setTemplateTypeFilter(val)
                templatesTable.resetPage()
              }}
              options={[
                { value: '', label: __('All Types', 'codeclove-school-management') },
                { value: 'transfer', label: __('Transfer Certificate (TC)', 'codeclove-school-management') },
                { value: 'merit', label: __('Merit / Award Certificate', 'codeclove-school-management') },
                { value: 'character', label: __('Character Certificate', 'codeclove-school-management') },
                { value: 'completion', label: __('Course Completion Certificate', 'codeclove-school-management') },
                { value: 'general', label: __('General School Certificate', 'codeclove-school-management') },
              ]}
              placeholder={__('All Types', 'codeclove-school-management')}
              className="w-48 text-xs"
            />

            <Select
              value={templateOrientationFilter}
              onValueChange={(val) => {
                setTemplateOrientationFilter(val)
                templatesTable.resetPage()
              }}
              options={[
                { value: '', label: __('All Orientations', 'codeclove-school-management') },
                { value: 'landscape', label: __('Landscape', 'codeclove-school-management') },
                { value: 'portrait', label: __('Portrait', 'codeclove-school-management') },
              ]}
              placeholder={__('All Orientations', 'codeclove-school-management')}
              className="w-40 text-xs"
            />
          </FilterBar>

          {/* Full-featured Templates DataTable */}
          <DataTable<CertificateTemplate>
            data={templates}
            isLoading={loadingTemplates}
            isError={isErrorTemplates}
            onRetry={refetchTemplates}
            table={templatesTable}
            total={totalTemplates}
            emptyMessage={
              hasActiveTemplateFilters
                ? __('No certificate templates match the selected filters.', 'codeclove-school-management')
                : __('No certificate templates created yet.', 'codeclove-school-management')
            }
            emptyState={{
              icon: Award,
              message: hasActiveTemplateFilters
                ? __('No matching templates found', 'codeclove-school-management')
                : __('No certificate templates created yet', 'codeclove-school-management'),
              description: hasActiveTemplateFilters
                ? __('Try adjusting your search criteria or clearing active filters.', 'codeclove-school-management')
                : __('Design and create official certificate templates for your school.', 'codeclove-school-management'),
              action: !hasActiveTemplateFilters ? (
                <Button
                  size="sm"
                  onClick={() => navigate('/academics/certificates/templates/new')}
                  className="gap-1.5"
                >
                  <Plus size={14} />
                  <span>{__('New Template', 'codeclove-school-management')}</span>
                </Button>
              ) : undefined,
            }}
            columns={templateColumns}
          />
        </div>
      )}

      {/* ─── TAB 2: Issued Certificate Register (Streamlined DataTable) ───────── */}
      {activeTab === 'issued' && (
        <div className="space-y-4">
          {/* Integrated Standard FilterBar */}
          <FilterBar
            search={registerSearch}
            onSearchChange={(val) => {
              setRegisterSearch(val)
              issuedTable.resetPage()
            }}
            searchPlaceholder={__('Search certificate no, student, or remarks...', 'codeclove-school-management')}
            activeFilterCount={(templateFilter ? 1 : 0) + (unitFilter ? 1 : 0) + (groupFilter ? 1 : 0)}
            onClearAll={handleClearFilters}
          >
            <Select
              value={templateFilter}
              onValueChange={(val) => {
                setTemplateFilter(val)
                issuedTable.resetPage()
              }}
              options={[
                { value: '', label: __('All Templates', 'codeclove-school-management') },
                ...allTemplates.map((tpl) => ({ value: String(tpl.id), label: tpl.title })),
              ]}
              placeholder={__('All Templates', 'codeclove-school-management')}
              className="w-48 text-xs"
            />

            <Select
              value={unitFilter}
              onValueChange={(val) => {
                setUnitFilter(val)
                setGroupFilter('')
                issuedTable.resetPage()
              }}
              options={[
                { value: '', label: __('All Classes', 'codeclove-school-management') },
                ...units.map((u) => ({ value: String(u.id), label: u.name })),
              ]}
              placeholder={__('All Classes', 'codeclove-school-management')}
              className="w-40 text-xs"
            />

            {unitFilter && groups.length > 0 && (
              <Select
                value={groupFilter}
                onValueChange={(val) => {
                  setGroupFilter(val)
                  issuedTable.resetPage()
                }}
                options={[
                  { value: '', label: __('All Sections', 'codeclove-school-management') },
                  ...groups.map((g) => ({ value: String(g.id), label: g.name })),
                ]}
                placeholder={__('All Sections', 'codeclove-school-management')}
                className="w-36 text-xs"
              />
            )}
          </FilterBar>

          {/* Streamlined 5-Column DataTable */}
          <DataTable<IssuedCertificate>
            data={issuedCertificates}
            isLoading={loadingIssued}
            table={issuedTable}
            total={totalIssued}
            selectable
            emptyMessage={
              hasActiveFilters
                ? __('No issued certificates match the selected filters.', 'codeclove-school-management')
                : __('No certificates issued yet.', 'codeclove-school-management')
            }
            emptyState={{
              icon: Award,
              message: hasActiveFilters
                ? __('No matching certificates found', 'codeclove-school-management')
                : __('No certificates issued yet', 'codeclove-school-management'),
              description: hasActiveFilters
                ? __('Try adjusting your search criteria or clearing active filters.', 'codeclove-school-management')
                : __('Issue your first certificate from a template.', 'codeclove-school-management'),
            }}
            bulkActions={
              issuedTable.selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBulkReprint}
                    className="h-7 text-xs flex items-center gap-1.5"
                  >
                    <Printer size={12} />
                    <span>
                      {sprintf(
                        __('Reprint Selected (%d)', 'codeclove-school-management'),
                        issuedTable.selectedIds.length
                      )}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkDeleteIssued}
                    disabled={bulkDeleteIssuedMutation.isPending}
                    className="h-7 text-xs flex items-center gap-1.5 text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={12} />
                    <span>
                      {sprintf(
                        __('Delete Selected (%d)', 'codeclove-school-management'),
                        issuedTable.selectedIds.length
                      )}
                    </span>
                  </Button>
                </div>
              )
            }
            columns={issuedColumns}
          />
        </div>
      )}

      {/* ─── Hidden Single Reprint Document ───────────────────────────────────── */}
      {reprintCert && (
        <div className="hidden">
          <CertificateDocument
            ref={reprintRef}
            template={getFallbackTemplate(reprintCert, allTemplates)}
            data={resolveCertificatePrintData(reprintCert)}
          />
        </div>
      )}

      {/* ─── Hidden Bulk Reprint Multi-Page Document ──────────────────────────── */}
      {bulkReprintCerts.length > 0 && (
        <div className="hidden">
          <div ref={bulkPrintRef} className="print-multi-page">
            {bulkReprintCerts.map((cert, index) => {
              const tpl = getFallbackTemplate(cert, allTemplates)
              return (
                <div key={cert.id} style={index > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}>
                  <CertificateDocument
                    template={tpl}
                    data={resolveCertificatePrintData(cert)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
