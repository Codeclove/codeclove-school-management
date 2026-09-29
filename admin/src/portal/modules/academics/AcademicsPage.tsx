/**
 * Portal Academics Page.
 *
 * Displays student academic enrollment details (Session, Grade, Section, Roll #)
 * and assigned core and elective subjects using shared CodeClove design system primitives.
 */

import React from 'react'
import {
  BookMarked,
  BookOpen,
  GraduationCap,
} from 'lucide-react'
import { __, _n, sprintf } from '@/lib/i18n'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { useAcademics } from '../../api/portal'
import { formatDate } from '../../lib/formatter'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
} from '@/components/ui'

export const AcademicsPage: React.FC = () => {
  const { currentStudent } = usePortal()
  const { getLabel } = usePortalLabels()
  const { data: academicsData, isLoading } = useAcademics(currentStudent?.id)

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-bg-surface shadow-card">
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
          <Card className="rounded-xl border border-border/80 shadow-card bg-bg-surface">
            <CardHeader className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-text">
                  {sprintf( __( 'Enrolled %s', 'codeclove-school-management' ), subjectPlural )}
                </h3>
              </div>
              <Badge variant="default" size="sm">
                {sprintf(
                  _n( '%d Subject', '%d Subjects', subjects.length, 'codeclove-school-management' ),
                  subjects.length
                )}
              </Badge>
            </CardHeader>

            <CardContent>
              {subjects.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={__( 'No subjects assigned', 'codeclove-school-management' )}
                  description={__( 'No subject curriculum records found for this class division.', 'codeclove-school-management' )}
                  className="py-12"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjects.map((sub, idx) => {
                    const isCore = !sub.type || sub.type.toLowerCase() === 'core'

                    return (
                      <div
                        key={`${sub.name}-${idx}`}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-bg-surface p-3.5 hover:border-border/90 hover:bg-bg-base/40 hover:shadow-card transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 flex-shrink-0 ${
                              isCore ? 'bg-brand-dim text-brand' : 'bg-warning-dim text-warning'
                            }`}
                          >
                            <BookMarked className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-text leading-snug">
                              {sub.name}
                            </h4>
                            <p className="text-2xs font-medium text-text-muted mt-0.5">
                              {sub.code ? sprintf( __( 'Code: %s', 'codeclove-school-management' ), sub.code ) : __( 'Curriculum Subject', 'codeclove-school-management' )}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant={isCore ? 'brand' : 'warning'}
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
        </>
      )}
    </div>
  )
}
