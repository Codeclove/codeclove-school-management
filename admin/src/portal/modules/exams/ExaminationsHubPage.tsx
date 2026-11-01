/**
 * Portal Examinations Page.
 *
 * Clean, simple, and functional access to:
 *   - Admit Cards (Hall Tickets) with one-click Print
 *   - Report Cards (Exam Results) with one-click Print
 */

import React, { useState, useRef, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText,
  IdCard,
  Printer,
} from 'lucide-react'
import { __, _n, sprintf } from '@/lib/i18n'
import { usePortal } from '../../lib/portal-context'
import { usePortalExams } from '../../api/portal'
import { formatDate } from '../../lib/formatter'
import { printElement } from '@/lib/print'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { SegmentedTabs, type SegmentedTab } from '../../components/SegmentedTabs'
import AdmitCardDocument from '@/modules/exams/components/AdmitCardDocument'
import { ReportCardDocument } from '@/modules/exams/components/ReportCardDocument'
import type { AdmitCardsDataset, ReportCardData } from '@/modules/exams/types'

type ExamTabId = 'admit-cards' | 'report-cards'

export const ExaminationsHubPage: React.FC = () => {
  const { currentStudent } = usePortal()
  const { data: examsData, isLoading } = usePortalExams(currentStudent?.id)
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedAdmitCard, setSelectedAdmitCard] = useState<AdmitCardsDataset | null>(null)
  const [selectedReportCard, setSelectedReportCard] = useState<ReportCardData | null>(null)

  const portalAdmitPrintRef = useRef<HTMLDivElement | null>(null)
  const portalReportPrintRef = useRef<HTMLDivElement | null>(null)

  // 1. Resolve available Admit Cards
  const admitCardItems = useMemo(() => {
    const fromCards = (examsData?.admit_cards || [])
      .filter((c) => Boolean(c.dataset?.students?.length))
      .map((c) => ({
        examId: c.exam_id,
        examName: c.exam_name,
        startsOn: c.starts_on,
        endsOn: c.ends_on,
        canDownload: true,
        dataset: c.dataset,
      }))
    const seenIds = new Set(fromCards.map((c) => c.examId))
    const fromUpcoming = (examsData?.upcoming_exams || [])
      .filter((u) => !seenIds.has(u.id))
      .map((u) => {
        const hasCard = Boolean(u.can_download_admit_card && u.admit_card?.students?.length)
        return {
          examId: u.id,
          examName: u.name,
          startsOn: u.starts_on,
          endsOn: u.ends_on,
          canDownload: hasCard,
          dataset: hasCard ? u.admit_card! : undefined,
        }
      })
    return [...fromCards, ...fromUpcoming]
  }, [examsData])

  const publishedExams = examsData?.published_exams || []

  const hasAdmitCards = admitCardItems.some((item) => item.canDownload)
  const hasReportCards = publishedExams.length > 0

  // 2. Active Tab
  const paramTab = searchParams.get('tab') as ExamTabId | null
  const defaultTab: ExamTabId = hasAdmitCards ? 'admit-cards' : hasReportCards ? 'report-cards' : 'admit-cards'

  const [activeTab, setActiveTab] = useState<ExamTabId>(() => {
    if (paramTab === 'admit-cards' || paramTab === 'report-cards') {
      return paramTab
    }
    return defaultTab
  })

  useEffect(() => {
    if (paramTab && (paramTab === 'admit-cards' || paramTab === 'report-cards')) {
      if (paramTab !== activeTab) {
        setActiveTab(paramTab)
      }
    }
  }, [paramTab, activeTab])

  const handleTabChange = (tabId: ExamTabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId }, { replace: true })
  }

  const tabsConfig = useMemo<SegmentedTab<ExamTabId>[]>(() => [
    {
      id: 'admit-cards',
      label: __('Admit Cards', 'codeclove-school-management'),
      icon: IdCard,
      count: admitCardItems.filter((i) => i.canDownload).length,
    },
    {
      id: 'report-cards',
      label: __('Report Cards', 'codeclove-school-management'),
      icon: FileText,
      count: publishedExams.length,
    },
  ], [admitCardItems, publishedExams.length])

  // Direct print handlers
  const handlePrintAdmitCard = (dataset: AdmitCardsDataset) => {
    setSelectedAdmitCard(dataset)
    setTimeout(() => {
      if (portalAdmitPrintRef.current) {
        printElement(portalAdmitPrintRef.current)
      }
    }, 60)
  }

  const handlePrintReportCard = (card: ReportCardData) => {
    setSelectedReportCard(card)
    setTimeout(() => {
      if (portalReportPrintRef.current) {
        printElement(portalReportPrintRef.current)
      }
    }, 60)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={__('Examinations', 'codeclove-school-management')}
        description={__('Official candidate admit cards and published examination report cards.', 'codeclove-school-management')}
      />

      <SegmentedTabs<ExamTabId>
        tabs={tabsConfig}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel={__('Examination views', 'codeclove-school-management')}
        size="md"
      />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* ─── Tab 1: Admit Cards ────────────────────────────────────────── */}
          {activeTab === 'admit-cards' && (
            admitCardItems.length === 0 ? (
              <EmptyState
                icon={IdCard}
                title={__('No Admit Cards Released', 'codeclove-school-management')}
                description={__('Examination admit cards have not been released yet.', 'codeclove-school-management')}
              />
            ) : (
              <Card className="rounded-xl border border-border overflow-hidden shadow-card">
                <div className="divide-y divide-border">
                  {admitCardItems.map((item) => {
                    const dataset = item.dataset
                    const student = dataset?.students?.[0]
                    const papersCount = student?.papers?.length || 0

                    return (
                      <div
                        key={item.examId}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-hover-bg/60 transition-colors"
                      >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div className="p-2.5 rounded-xl bg-brand-dim text-brand shrink-0">
                            <IdCard className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-sm font-bold text-text truncate">
                              {item.examName}
                            </h4>
                            <p className="text-xs text-text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{formatDate(item.startsOn)} – {formatDate(item.endsOn)}</span>
                              {dataset?.exam?.academic_session_name && (
                                <>
                                  <span className="text-border-strong">•</span>
                                  <span>{dataset.exam.academic_session_name}</span>
                                </>
                              )}
                              {papersCount > 0 && (
                                <>
                                  <span className="text-border-strong">•</span>
                                  <span>
                                    {sprintf(
                                      _n('%d Paper Scheduled', '%d Papers Scheduled', papersCount, 'codeclove-school-management'),
                                      papersCount
                                    )}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          {item.canDownload && item.dataset ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePrintAdmitCard(item.dataset!)}
                              className="h-8 gap-1.5 text-xs font-semibold"
                            >
                              <Printer className="w-3.5 h-3.5 text-text-subtle" />
                              <span>{__('Print Admit Card', 'codeclove-school-management')}</span>
                            </Button>
                          ) : (
                            <span className="text-2xs font-semibold px-2.5 py-1 rounded-full border border-border bg-bg-surface text-text-muted">
                              {__('Admit Card Pending', 'codeclove-school-management')}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          )}

          {/* ─── Tab 2: Report Cards ───────────────────────────────────────── */}
          {activeTab === 'report-cards' && (
            publishedExams.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={__('No Report Cards Published', 'codeclove-school-management')}
                description={__('Examination report cards have not been published yet.', 'codeclove-school-management')}
              />
            ) : (
              <Card className="rounded-xl border border-border overflow-hidden shadow-card">
                <div className="divide-y divide-border">
                  {publishedExams.map((pubExam) => {
                    const examCode = pubExam.code || ''
                    return (
                      <div
                        key={pubExam.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-hover-bg/60 transition-colors"
                      >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div className="p-2.5 rounded-xl bg-brand-dim text-brand shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-sm font-bold text-text truncate">
                              {pubExam.name}
                            </h4>
                            <p className="text-xs text-text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{formatDate(pubExam.starts_on)} – {formatDate(pubExam.ends_on)}</span>
                              {examCode && (
                                <>
                                  <span className="text-border-strong">•</span>
                                  <span>{examCode}</span>
                                </>
                              )}
                              <span className="text-border-strong">•</span>
                              <span>{__('Official Transcript', 'codeclove-school-management')}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePrintReportCard(pubExam.report_card)}
                            className="h-8 gap-1.5 text-xs font-semibold"
                          >
                            <Printer className="w-3.5 h-3.5 text-text-subtle" />
                            <span>{__('Print Report Card', 'codeclove-school-management')}</span>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          )}
        </>
      )}

      {/* ─── Hidden Off-screen Print Targets ───────────────────────────────── */}
      {selectedAdmitCard && selectedAdmitCard.students[0] && (
        <div
          ref={portalAdmitPrintRef}
          style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm' }}
          aria-hidden="true"
        >
          <AdmitCardDocument
            exam={selectedAdmitCard.exam}
            school={selectedAdmitCard.school}
            student={selectedAdmitCard.students[0]}
            instructions={selectedAdmitCard.instructions}
            showPhoto={selectedAdmitCard.exam.admit_card_config?.show_photo !== false}
            showInstructions={selectedAdmitCard.exam.admit_card_config?.show_instructions !== false}
            showInvigilatorSign={Boolean(selectedAdmitCard.exam.admit_card_config?.show_invigilator_sign)}
            signatoryTitle={selectedAdmitCard.exam.admit_card_config?.signatory_title || 'Controller of Examinations'}
          />
        </div>
      )}

      {selectedReportCard && (
        <div
          ref={portalReportPrintRef}
          style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm' }}
          aria-hidden="true"
        >
          <ReportCardDocument
            data={selectedReportCard}
            options={{
              showGradingScale: true,
              showAttendance: true,
              showRemarks: true,
              showSignatures: true,
              paperSize: 'a4',
            }}
          />
        </div>
      )}
    </div>
  )
}
