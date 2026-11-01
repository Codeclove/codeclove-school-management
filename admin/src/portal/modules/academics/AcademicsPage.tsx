/**
 * Portal Academics Page.
 *
 * Displays student academic enrollment details (Session, Grade, Section, Roll #)
 * and assigned core and elective subjects using shared CodeClove design system primitives.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  FileCheck2,
  GraduationCap,
} from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { useAcademics } from '../../api/portal'
import { formatDate } from '../../lib/formatter'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  PageHeader,
  Spinner,
} from '@/components/ui'

export const AcademicsPage: React.FC = () => {
  const { currentStudent } = usePortal()
  const { getLabel } = usePortalLabels()
  const { data: academicsData, isLoading } = useAcademics(currentStudent?.id)
  const isPro = window.CodeClovePortalConfig?.isPro ?? false

  const sessionLabel = getLabel('academic_session', false, __( 'Academic Session', 'codeclove-school-management' ))
  const unitLabel = getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))
  const subjectPlural = getLabel('subject', true, __( 'Subjects', 'codeclove-school-management' ))

  const enrollment = academicsData?.enrollment
  const subjects = academicsData?.subjects ?? []

  const sessionName = enrollment?.session_name ?? sprintf( __( 'Current %s', 'codeclove-school-management' ), sessionLabel )
  const unitName = enrollment?.unit_name ?? currentStudent?.unit_name ?? unitLabel
  const groupName = enrollment?.group_name ?? currentStudent?.group_name ?? '—'
  const rollNumber = enrollment?.roll_number ?? currentStudent?.roll_number ?? '—'
  const startsOn = enrollment?.starts_on

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={__( 'Academic Overview', 'codeclove-school-management' )}
        description={sprintf( __( '%1$s, schedule, and %2$s details', 'codeclove-school-management' ), subjectPlural, sessionLabel.toLowerCase() )}
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Academic Enrollment Summary Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-bg-elevated shadow-card">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-dim text-brand shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">
                  {[unitName, groupName].filter((v) => v && v !== '—').join(' • ') || __( 'Enrolled Curriculum', 'codeclove-school-management' )}
                  {rollNumber && rollNumber !== '—' && (
                    <span className="text-brand font-mono font-bold ml-2">
                      {sprintf( __( '• Roll #%s', 'codeclove-school-management' ), rollNumber )}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {sessionName}
                  {startsOn && sprintf( __( ' • Started %s', 'codeclove-school-management' ), formatDate(startsOn) )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="brand" size="sm">
                {sprintf(
                  __( '%1$d %2$s Enrolled', 'codeclove-school-management' ),
                  subjects.length,
                  getLabel('subject', subjects.length !== 1, subjects.length === 1 ? __( 'Subject', 'codeclove-school-management' ) : __( 'Subjects', 'codeclove-school-management' ))
                )}
              </Badge>
            </div>
          </div>

          {/* Assigned Subjects Card */}
          <Card className="rounded-xl">
            <CardHeader className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-text">
                  {sprintf( __( 'Enrolled %s', 'codeclove-school-management' ), subjectPlural )}
                </h3>
              </div>
              <span className="text-2xs font-semibold text-text-muted">
                {sprintf( __( '%d %s', 'codeclove-school-management' ), subjects.length, subjectPlural )}
              </span>
            </CardHeader>
            <CardContent>
              {subjects.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-xs">
                  <BookMarked className="w-8 h-8 mx-auto text-text-subtle mb-2 opacity-50" />
                  <p>{sprintf( __( 'No %s enrolled for this student yet.', 'codeclove-school-management' ), subjectPlural.toLowerCase() )}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjects.map((sub, idx) => {
                    const isCore = (sub.type ?? 'core').toLowerCase() === 'core'
                    const isActivity = (sub.type ?? '').toLowerCase() === 'activity'

                    return (
                      <div
                        key={sub.id ?? idx}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-bg-surface hover:border-border-strong hover:shadow-card transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                            isCore
                              ? 'bg-brand-dim text-brand'
                              : isActivity
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                          }`}>
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-text truncate">
                              {sub.name}
                            </h4>
                            <p className="text-2xs font-medium text-text-muted mt-0.5">
                              {sub.code ? `${__( 'Code', 'codeclove-school-management' )}: ${sub.code}` : (isCore ? __( 'Core Subject', 'codeclove-school-management' ) : __( 'Elective', 'codeclove-school-management' ))}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant={isCore ? 'brand' : isActivity ? 'neutral' : 'warning'}
                          size="sm"
                          className="flex-shrink-0"
                        >
                          {sub.type ?? __( 'Core', 'codeclove-school-management' )}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick link to Examinations */}
          {isPro && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-bg-surface hover:border-border-strong transition-all">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-dim text-brand shrink-0">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text">
                    {__( 'Examinations, Admit Cards & Report Cards', 'codeclove-school-management' )}
                  </h4>
                  <p className="text-2xs text-text-muted mt-0.5">
                    {__( 'Access your official candidate hall tickets and published term report cards.', 'codeclove-school-management' )}
                  </p>
                </div>
              </div>

              <Link
                to="/examinations"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline shrink-0 self-start sm:self-auto"
              >
                <span>{__( 'Go to Examinations', 'codeclove-school-management' )}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
