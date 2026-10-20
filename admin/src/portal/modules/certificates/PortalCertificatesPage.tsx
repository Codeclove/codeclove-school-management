import React, { useRef, useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  Link2,
  Medal,
  Printer,
  Search,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { portalApi } from '../../lib/api-client'
import { formatDate } from '../../lib/formatter'
import { printElement } from '@/lib/print'
import { CertificateDocument } from '@/modules/academics/certificates/components/CertificateDocument'
import { CertificateCanvas } from '@/modules/academics/certificates/components/CertificateCanvas'
import { getFallbackTemplate } from '@/modules/academics/certificates/certificate-defaults'
import { type IssuedCertificate, resolveCertificatePrintData } from '@/api/certificates'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui'
import { __, sprintf } from '@/lib/i18n'

interface CertificateMeta {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  citationLabel: string
}

function getCertificateMeta(cert: IssuedCertificate): CertificateMeta {
  const reason = (cert.reason || '').toLowerCase()
  const title = (cert.template?.title || '').toLowerCase()

  if (
    reason.includes('transfer') ||
    title.includes('transfer') ||
    reason.includes('leaving') ||
    title.includes('leaving')
  ) {
    return {
      icon: FileCheck2,
      iconBg: 'bg-slate-500/10 dark:bg-slate-400/15',
      iconColor: 'text-slate-700 dark:text-slate-300',
      citationLabel: __( 'Reason', 'codeclove-school-management' ),
    }
  }

  if (
    reason.includes('sport') ||
    title.includes('sport') ||
    reason.includes('athletic') ||
    title.includes('athletic') ||
    reason.includes('competition')
  ) {
    return {
      icon: Medal,
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
      iconColor: 'text-emerald-700 dark:text-emerald-300',
      citationLabel: __( 'Achievement', 'codeclove-school-management' ),
    }
  }

  if (
    reason.includes('merit') ||
    title.includes('merit') ||
    reason.includes('performance') ||
    title.includes('honor') ||
    reason.includes('conduct') ||
    reason.includes('academic')
  ) {
    return {
      icon: Trophy,
      iconBg: 'bg-amber-500/10 dark:bg-amber-400/15',
      iconColor: 'text-amber-700 dark:text-amber-300',
      citationLabel: __( 'Commendation', 'codeclove-school-management' ),
    }
  }

  return {
    icon: Award,
    iconBg: 'bg-brand-dim',
    iconColor: 'text-brand',
    citationLabel: __( 'Remarks', 'codeclove-school-management' ),
  }
}

function getCertificateTitle(cert: IssuedCertificate): string {
  if (cert.template?.title) return cert.template.title
  if (cert.reason) {
    const r = cert.reason.toLowerCase()
    if (r.includes('transfer') || r.includes('leaving')) {
      return __( 'School Transfer Certificate', 'codeclove-school-management' )
    }
    if (r.includes('merit') || r.includes('academic') || r.includes('performance') || r.includes('conduct')) {
      return __( 'Academic Merit Certificate', 'codeclove-school-management' )
    }
    if (r.includes('sport') || r.includes('athletic')) {
      return __( 'Athletic Achievement Certificate', 'codeclove-school-management' )
    }
  }
  return __( 'Institutional Certificate', 'codeclove-school-management' )
}

export const PortalCertificatesPage: React.FC = () => {
  const { currentStudent } = usePortal()
  const { getLabel } = usePortalLabels()
  const studentId = currentStudent?.id

  const printRef = useRef<HTMLDivElement>(null)
  const [selectedCertId, setSelectedCertId] = useState<number | null>(null)
  const [printingCert, setPrintingCert] = useState<IssuedCertificate | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedRefId, setCopiedRefId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['codeclove', 'portal', 'certificates', studentId],
    queryFn: async () => {
      const res = await portalApi.get<{ certificates: IssuedCertificate[]; total: number }>(
        'certificates',
        { student_id: studentId }
      )
      return res
    },
    enabled: Boolean(studentId),
  })

  const certificates: IssuedCertificate[] = data?.certificates || []

  // Active selected certificate for Page 2 (Detail Document View)
  const selectedCert = useMemo(() => {
    if (!selectedCertId) return null
    return certificates.find((c) => c.id === selectedCertId) || null
  }, [certificates, selectedCertId])

  useEffect(() => {
    if (printingCert && printRef.current) {
      printElement(printRef.current)
      setPrintingCert(null)
    }
  }, [printingCert])

  const selectedTemplate = useMemo(() => {
    return selectedCert ? getFallbackTemplate(selectedCert) : null
  }, [selectedCert])

  const selectedPrintData = useMemo(() => {
    return selectedCert ? resolveCertificatePrintData(selectedCert) : {}
  }, [selectedCert])

  const printingPrintData = useMemo(() => {
    return printingCert ? resolveCertificatePrintData(printingCert) : {}
  }, [printingCert])

  const verificationUrl = useMemo(() => {
    if (!selectedCert?.verification_token) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/?codeclove_verify=cert&token=${encodeURIComponent(selectedCert.verification_token)}`
  }, [selectedCert?.verification_token])

  const unitLabel = getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))

  // Filtered certificates by search
  const filteredCertificates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return certificates
    return certificates.filter((cert) => {
      const title = getCertificateTitle(cert).toLowerCase()
      const refNo = (cert.certificate_no || '').toLowerCase()
      const reason = (cert.reason || '').toLowerCase()
      return title.includes(q) || refNo.includes(q) || reason.includes(q)
    })
  }, [certificates, searchQuery])

  const handleCopyRef = async (refNo: string, certId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(refNo)
        setCopiedRefId(certId)
        setTimeout(() => setCopiedRefId(null), 1800)
      } catch {
        // clipboard failure ignored
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. LOADING SKELETON STATE
  // ──────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={__( 'Official Certificates', 'codeclove-school-management' )}
          description={__( 'View, download, and verify official institutional credentials issued for your student profile.', 'codeclove-school-management' )}
        />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </Card>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. EMPTY STATE
  // ──────────────────────────────────────────────────────────────────────────
  if (certificates.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={__( 'Official Certificates', 'codeclove-school-management' )}
          description={__( 'View, download, and verify official institutional credentials issued for your student profile.', 'codeclove-school-management' )}
        />
        <Card className="rounded-xl border border-border p-8">
          <EmptyState
            icon={Award}
            title={__( 'No certificates issued yet', 'codeclove-school-management' )}
            description={__( 'Official academic merit, graduation, and conduct certificates will appear here once issued by school administration.', 'codeclove-school-management' )}
            className="py-12"
          />
        </Card>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. PAGE 2: DETAIL DOCUMENT VIEW (Preview)
  // ──────────────────────────────────────────────────────────────────────────
  if (selectedCert) {
    const academicMeta = selectedCert.metadata?.academic || {}
    const schoolMeta = selectedCert.metadata?.school || {}
    const certClassName = academicMeta.unit_name || currentStudent?.unit_name || unitLabel
    const certSectionName = academicMeta.group_name || currentStudent?.group_name || ''
    const certSessionName = academicMeta.session_name || __( 'Current Session', 'codeclove-school-management' )
    const certSchoolName = schoolMeta.name || window.CodeClovePortalConfig?.siteName || __( 'School Administration', 'codeclove-school-management' )
    const certTitle = getCertificateTitle(selectedCert)
    const meta = getCertificateMeta(selectedCert)
    const DetailIcon = meta.icon

    return (
      <div className="space-y-4">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCertId(null)}
            className="h-8 -ml-2 px-2.5 gap-2 text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{__( 'Back to Certificates', 'codeclove-school-management' )}</span>
          </Button>

          <span className="font-mono text-2xs text-text-subtle">
            {selectedCert.certificate_no}
          </span>
        </div>

        {/* Main Official Credential Card */}
        <Card className="rounded-xl border border-border shadow-card overflow-hidden">
          {/* Action Header Bar */}
          <div className="p-4 sm:p-5 bg-bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`p-1.5 rounded-lg ${meta.iconBg} ${meta.iconColor} shrink-0`}>
                  <DetailIcon className="w-4 h-4" />
                </span>
                <h2 className="text-base sm:text-lg font-bold text-text tracking-tight truncate">
                  {certTitle}
                </h2>
                <span className="font-mono text-2xs font-semibold px-2 py-0.5 rounded bg-bg-base border border-border text-text-muted">
                  {selectedCert.certificate_no}
                </span>
                <Badge variant="success" size="sm" className="gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{__( 'Verified', 'codeclove-school-management' )}</span>
                </Badge>
              </div>

              <p className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
                <span>{sprintf( __( 'Issued: %s', 'codeclove-school-management' ), formatDate(selectedCert.issue_date) )}</span>
                <span className="text-text-subtle">•</span>
                <span>{certClassName}{certSectionName ? ` • ${certSectionName}` : ''}</span>
                <span className="text-text-subtle">•</span>
                <span>{certSessionName}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
              {verificationUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (typeof navigator !== 'undefined') {
                      try {
                        await navigator.clipboard.writeText(verificationUrl)
                        setCopiedLink(true)
                        setTimeout(() => setCopiedLink(false), 2000)
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-success" />
                      <span className="text-success">{__( 'Link Copied', 'codeclove-school-management' )}</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5 text-text-muted" />
                      <span>{__( 'Copy Link', 'codeclove-school-management' )}</span>
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="default"
                size="sm"
                onClick={() => setPrintingCert(selectedCert)}
                className="h-8 px-3.5 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>{__( 'Print / Download PDF', 'codeclove-school-management' )}</span>
              </Button>
            </div>
          </div>

          {/* Certificate Document Canvas Stage */}
          <div className="border-t border-border bg-slate-50/70 dark:bg-bg-base/70 p-4 sm:p-8 flex flex-col items-center justify-center overflow-x-auto">
            <div className="w-full max-w-[840px] bg-white rounded-sm shadow-xl ring-1 ring-black/5 overflow-hidden">
              {selectedTemplate && (
                <CertificateCanvas
                  orientation={selectedTemplate.orientation}
                  backgroundUrl={selectedTemplate.background_url}
                  elements={selectedTemplate.layout_data}
                  sampleOrRealData={selectedPrintData}
                  isEditing={false}
                  verificationUrl={verificationUrl}
                />
              )}
            </div>
          </div>

          {/* Institutional Verification Footer */}
          <div className="px-4 sm:px-5 py-3 border-t border-border bg-bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-2xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
              <span>
                {sprintf(
                  __( 'Official credential verified and issued by %s.', 'codeclove-school-management' ),
                  certSchoolName
                )}
              </span>
            </div>

            {verificationUrl && (
              <a
                href={verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand hover:underline self-start sm:self-auto"
              >
                <span>{__( 'Verify Online', 'codeclove-school-management' )}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </Card>

        {/* Hidden Vector Print Document */}
        {printingCert && (
          <div className="hidden">
            <CertificateDocument
              ref={printRef}
              template={getFallbackTemplate(printingCert)}
              data={printingPrintData}
              verificationUrl={
                printingCert.verification_token
                  ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?codeclove_verify=cert&token=${encodeURIComponent(printingCert.verification_token)}`
                  : undefined
              }
            />
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PAGE 1: REFINED, PROFESSIONAL CERTIFICATES LIST
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Top Header */}
      <PageHeader
        title={__( 'Official Certificates', 'codeclove-school-management' )}
        description={__( 'View, download, and verify official institutional credentials issued for your student profile.', 'codeclove-school-management' )}
      />

      {/* Official Certificates List Card */}
      <Card className="rounded-xl border border-border overflow-hidden shadow-card">
        {/* Card Header Strip with Search for 3+ items */}
        <div className="px-5 py-3.5 border-b border-border bg-bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-brand shrink-0" />
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">
              {__( 'Issued Certificates', 'codeclove-school-management' )}
            </h3>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-brand-dim text-brand">
              {sprintf(
                certificates.length === 1
                  ? __( '%d Certificate', 'codeclove-school-management' )
                  : __( '%d Certificates', 'codeclove-school-management' ),
                certificates.length
              )}
            </span>
          </div>

          {/* Quick search input when 3 or more certificates exist */}
          {certificates.length >= 3 && (
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={__( 'Search certificates...', 'codeclove-school-management' )}
                className="w-full h-8 pl-8 pr-7 rounded-lg bg-bg-base border border-border text-xs text-text placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text text-xs p-0.5 cursor-pointer"
                  aria-label={__( 'Clear search', 'codeclove-school-management' )}
                >
                  &times;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Empty search results state */}
        {filteredCertificates.length === 0 && certificates.length > 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-text">
              {__( 'No matching certificates found', 'codeclove-school-management' )}
            </p>
            <p className="text-xs text-text-muted">
              {sprintf( __( 'No credentials match "%s".', 'codeclove-school-management' ), searchQuery )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="mt-1 h-7 text-xs text-brand font-semibold hover:underline cursor-pointer"
            >
              {__( 'Clear search query', 'codeclove-school-management' )}
            </Button>
          </div>
        ) : (
          /* Certificate Item Rows */
          <div className="divide-y divide-border">
            {filteredCertificates.map((cert) => {
              const academic = cert.metadata?.academic || {}
              const classLabel = academic.unit_name || currentStudent?.unit_name || unitLabel
              const sectionLabel = academic.group_name || currentStudent?.group_name || ''
              const sessionLabel = academic.session_name || __( 'Current Session', 'codeclove-school-management' )
              const title = getCertificateTitle(cert)
              const meta = getCertificateMeta(cert)
              const Icon = meta.icon
              const isCopied = copiedRefId === cert.id

              return (
                <div
                  key={cert.id}
                  onClick={() => setSelectedCertId(cert.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-hover-bg transition-colors cursor-pointer group"
                >
                  {/* Left: Icon & Certificate Information */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl ${meta.iconBg} ${meta.iconColor} shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-text group-hover:text-brand transition-colors">
                          {title}
                        </h4>

                        {/* Interactive Monospace Ref Number with click-to-copy */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyRef(cert.certificate_no, cert.id, e)}
                          title={__( 'Click to copy reference number', 'codeclove-school-management' )}
                          className="inline-flex items-center gap-1 font-mono text-2xs px-2 py-0.5 rounded bg-bg-base border border-border text-text-muted hover:border-brand-border hover:text-brand transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-success shrink-0" />
                              <span className="text-success font-semibold">{__( 'Copied', 'codeclove-school-management' )}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-text-subtle shrink-0 opacity-60" />
                              <span>{cert.certificate_no}</span>
                            </>
                          )}
                        </button>

                        <Badge variant="success" size="sm" className="gap-1 shrink-0 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{__( 'Verified', 'codeclove-school-management' )}</span>
                        </Badge>
                      </div>

                      <p className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
                        <span>{sprintf( __( 'Issued: %s', 'codeclove-school-management' ), formatDate(cert.issue_date) )}</span>
                        <span className="text-text-subtle">•</span>
                        <span>{classLabel}{sectionLabel ? ` • ${sectionLabel}` : ''}</span>
                        <span className="text-text-subtle">•</span>
                        <span>{sessionLabel}</span>
                      </p>

                      {cert.reason && (
                        <div className="flex items-baseline gap-1.5 text-xs">
                          <span className="text-3xs uppercase tracking-wider font-semibold text-text-subtle shrink-0">
                            {meta.citationLabel}:
                          </span>
                          <span className="italic text-text-muted line-clamp-1">
                            &ldquo;{cert.reason}&rdquo;
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div
                    className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPrintingCert(cert)}
                      className="h-8 px-3 text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-text-subtle" />
                      <span>{__( 'Print', 'codeclove-school-management' )}</span>
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setSelectedCertId(cert.id)}
                      className="h-8 px-3.5 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{__( 'View', 'codeclove-school-management' )}</span>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Hidden Vector Print Document */}
      {printingCert && (
        <div className="hidden">
          <CertificateDocument
            ref={printRef}
            template={getFallbackTemplate(printingCert)}
            data={printingPrintData}
            verificationUrl={
              printingCert.verification_token
                ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?codeclove_verify=cert&token=${encodeURIComponent(printingCert.verification_token)}`
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
