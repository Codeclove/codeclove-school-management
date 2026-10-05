import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Component, type ReactNode } from 'react'
import { ThemeProvider, useTheme } from './lib/theme'
import { FeedbackProvider, useFeedbackModal } from './lib/feedback-context'
import FeedbackModal from './components/feedback/FeedbackModal'
import { __ } from './lib/i18n'
import AppShell from './layouts/AppShell'
import DashboardPage   from './modules/dashboard/DashboardPage'
import SettingsPage    from './modules/settings/SettingsPage'
import SessionsPage    from './modules/academics/SessionsPage'
import UnitsPage       from './modules/academics/UnitsPage'
import GroupsPage      from './modules/academics/GroupsPage'
import SubjectsPage    from './modules/academics/SubjectsPage'
import { proRoutes } from './pro'
import StudentDirectoryPage from './modules/students/StudentDirectoryPage'
import StudentAdmitPage from './modules/students/StudentAdmitPage'
import StudentImportPage from './modules/students/StudentImportPage'
import StudentProfilePage from './modules/students/StudentProfilePage'
import StudentEditPage    from './modules/students/StudentEditPage'
import PromotionPage       from './modules/students/PromotionPage'
import AdmissionsPage       from './modules/students/AdmissionsPage'
import AdmissionDetailPage  from './modules/students/AdmissionDetailPage'
import AdmissionEditPage    from './modules/students/AdmissionEditPage'
import AdmissionConvertPage from './modules/students/AdmissionConvertPage'
import RolesPage from './modules/staff/RolesPage'
import StaffDirectoryPage from './modules/staff/StaffDirectoryPage'
import StaffFormPage from './modules/staff/StaffFormPage'
import StaffImportPage from './modules/staff/StaffImportPage'
import StaffProfilePage from './modules/staff/StaffProfilePage'
import StudentAttendanceLayout from './modules/attendance/StudentAttendanceLayout'
import StudentDailyAttendance from './modules/attendance/StudentDailyAttendance'
import StudentMonthlyAttendance from './modules/attendance/StudentMonthlyAttendance'
import StaffAttendanceLayout from './modules/attendance/StaffAttendanceLayout'
import StaffDailyAttendance from './modules/attendance/StaffDailyAttendance'
import StaffMonthlyAttendance from './modules/attendance/StaffMonthlyAttendance'
import FinanceDashboard from './modules/finance/FinanceDashboard'
import FeeTypesPage from './modules/finance/FeeTypesPage'
import FeeTypePage  from './modules/finance/FeeTypePage'
import InvoicesPage        from './modules/finance/InvoicesPage'
import CreateInvoicePage   from './modules/finance/CreateInvoicePage'
import InvoiceDetailPage   from './modules/finance/InvoiceDetailPage'
import RecordPaymentPage   from './modules/finance/RecordPaymentPage'
import PaymentsPage        from './modules/finance/PaymentsPage'
import DefaultersReportPage from './modules/finance/DefaultersReportPage'
import MyProfilePage from './modules/account/MyProfilePage'
import NoticeboardPage from './modules/announcements/NoticeboardPage'
import ProUpgradePage from './modules/upgrade/ProUpgradePage'
import { ToastProvider } from './lib/toast'
import { ConfirmProvider } from './lib/confirm'
import { ROUTES } from './lib/constants'
import { useSettings } from './api/settings'
import { useEffect } from 'react'
import { GraduationCap, Users, UserCog, AlertTriangle } from 'lucide-react'

// ─── Query Client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30 * 1000,
      gcTime:               5 * 60 * 1000,
      retry:                1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => console.error('[CodeClove] Mutation error:', error),
    },
  },
})

// ─── Appearance Sync ─────────────────────────────────────────────────────────

function AppearanceSync() {
  const { setTheme } = useTheme()
  const { data: settings } = useSettings()

  // Apply localStorage settings immediately on mount to prevent flash of unstyled layout
  useEffect(() => {
    const localLayout = localStorage.getItem('codeclove:layout') || 'boxed'
    const localSidebarDensity = localStorage.getItem('codeclove:sidebar-density') || 'comfortable'
    const localTableDensity = localStorage.getItem('codeclove:table-density') || 'comfortable'
    const localThemeColor = localStorage.getItem('codeclove:theme-color') || 'classic_indigo'
    const localScale = localStorage.getItem('codeclove:ui-scale') || '100%'

    const doc = document.documentElement
    doc.setAttribute('data-layout-density', localLayout)
    doc.setAttribute('data-sidebar-density', localSidebarDensity)
    doc.setAttribute('data-table-density', localTableDensity)
    doc.setAttribute('data-theme-color', localThemeColor)
    doc.style.setProperty('--codeclove-view-scale', localScale)
  }, [])

  useEffect(() => {
    const localLayout = localStorage.getItem('codeclove:layout') || settings?.appearance?.layout || 'boxed'
    const localSidebarDensity = localStorage.getItem('codeclove:sidebar-density') || settings?.appearance?.sidebar_density || 'comfortable'
    const localTableDensity = localStorage.getItem('codeclove:table-density') || settings?.appearance?.table_density || 'comfortable'
    const localThemeColor = localStorage.getItem('codeclove:theme-color') || settings?.appearance?.theme_color || 'classic_indigo'
    const localScale = localStorage.getItem('codeclove:ui-scale') || settings?.appearance?.ui_scale || '100%'

    const doc = document.documentElement
    doc.setAttribute('data-layout-density', localLayout)
    doc.setAttribute('data-sidebar-density', localSidebarDensity)
    doc.setAttribute('data-table-density', localTableDensity)
    doc.setAttribute('data-theme-color', localThemeColor)
    doc.style.setProperty('--codeclove-view-scale', localScale)

    // Only apply global theme mode from settings if there is no user-specific theme preference saved
    if (settings?.appearance?.mode && !localStorage.getItem('codeclove:theme')) {
      setTheme(settings.appearance.mode)
    }
  }, [settings?.appearance, setTheme])

  return null
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const isPro = window.CodeCloveConfig?.isPro ?? false

  return (
    // ThemeProvider must wrap everything so the dark class is applied before
    // any component renders, preventing a flash of wrong theme.
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <FeedbackProvider>
              <AppearanceSync />
            <HashRouter>
              <ErrorBoundary>
                <Routes>
            <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

            <Route element={<AppShell />}>
              <Route path={ROUTES.DASHBOARD}  element={<DashboardPage />} />

              {/* ── Academics ─────────────────────────────────────────── */}
              <Route path={ROUTES.SESSIONS}   element={<SessionsPage />} />
              <Route path={ROUTES.UNITS}      element={<UnitsPage />} />
              <Route path={ROUTES.GROUPS}     element={<GroupsPage />} />
              <Route path={ROUTES.SUBJECTS}   element={<SubjectsPage />} />
              {isPro && proRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}

              {/* ── Students ──────────────────────────────────────────── */}
              <Route path={ROUTES.STUDENT_DIRECTORY} element={<StudentDirectoryPage />} />
              <Route path="/students/new" element={<StudentAdmitPage />} />
              <Route path="/students/import" element={<StudentImportPage />} />
              <Route path="/students/:id" element={<StudentProfilePage />} />
              <Route path="/students/:id/edit" element={<StudentEditPage />} />
              <Route path={ROUTES.ADMISSIONS}        element={<AdmissionsPage />} />
              <Route path="/students/admissions/:id" element={<AdmissionDetailPage />} />
              <Route path="/students/admissions/:id/edit" element={<AdmissionEditPage />} />
              <Route path="/students/admissions/:id/convert" element={<AdmissionConvertPage />} />
              <Route path={ROUTES.ATTENDANCE} element={<StudentAttendanceLayout />}>
                <Route index element={<StudentDailyAttendance />} />
                <Route path="monthly" element={<StudentMonthlyAttendance />} />
              </Route>
              {isPro && <Route path={ROUTES.PROMOTION_ROLLOVER} element={<PromotionPage />} />}
              <Route path="/students/*"       element={<ComingSoon module="Students"             icon={Users}         color="text-brand"    bg="bg-brand-dim" />} />

              {/* ── Staff & HR ────────────────────────────────────────── */}
              <Route path={ROUTES.STAFF_DIRECTORY}   element={<StaffDirectoryPage />} />
              <Route path="/staff/new"     element={<StaffFormPage />} />
              <Route path="/staff/import"  element={<StaffImportPage />} />
              <Route path="/staff/:id"     element={<StaffProfilePage />} />
              <Route path="/staff/:id/edit" element={<StaffFormPage />} />
              <Route path="/staff/attendance" element={<StaffAttendanceLayout />}>
                <Route index element={<StaffDailyAttendance />} />
                <Route path="monthly" element={<StaffMonthlyAttendance />} />
              </Route>
              <Route path={ROUTES.ROLES_PERMISSIONS} element={<RolesPage />} />
              <Route path="/staff/*"          element={<ComingSoon module="Staff & HR"           icon={UserCog}       color="text-warning"  bg="bg-warning/10" />} />

              {/* ── Finance ───────────────────────────────────────────── */}
              {isPro ? (
                <Route path="/finance" element={<FinanceDashboard />} />
              ) : (
                <Route path="/finance" element={<Navigate to="/finance/invoices" replace />} />
              )}
              <Route path="/finance/fee-types"          element={<FeeTypesPage />} />
              <Route path="/finance/fee-types/new"       element={<FeeTypePage />} />
              <Route path="/finance/fee-types/:id/edit"  element={<FeeTypePage />} />
              <Route path="/finance/invoices"             element={<InvoicesPage />} />
              <Route path="/finance/invoices/new"         element={<CreateInvoicePage />} />
              <Route path="/finance/invoices/:id"         element={<InvoiceDetailPage />} />
              <Route path="/finance/invoices/:id/record-payment" element={<RecordPaymentPage />} />
              <Route path="/finance/payments"             element={<PaymentsPage />} />
              {isPro && <Route path="/finance/reports/defaulters" element={<DefaultersReportPage />} />}

              {/* ── Communication & Noticeboard ─────────────────────── */}
              {/* ── Communication & Noticeboard (Pro only) ───────────── */}
              {isPro && <Route path={ROUTES.ANNOUNCEMENTS} element={<NoticeboardPage />} />}

              {/* ── Settings ──────────────────────────────────────────── */}
              <Route path={ROUTES.SETTINGS}   element={<SettingsPage />} />
              {isPro ? (
                <Route path="/activity" element={<Navigate to="/settings?tab=activity_log" replace />} />
              ) : (
                <Route path="/activity" element={<Navigate to="/settings" replace />} />
              )}
              <Route path={ROUTES.MY_ACCOUNT} element={<MyProfilePage />} />
              {!isPro && <Route path="/pro-upgrade" element={<ProUpgradePage />} />}
            </Route>


            <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                </Routes>
                <FeedbackModal />
              </ErrorBoundary>
            </HashRouter>
            </FeedbackProvider>
          </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </ThemeProvider>
)
}

// ─── Coming Soon Placeholder ──────────────────────────────────────────────────

function ComingSoon({
  module,
  icon: Icon,
  color,
  bg,
}: {
  module: string
  icon: typeof GraduationCap
  color: string
  bg: string
}) {
  return (
    <div className="flex h-full items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4 max-w-sm">
        <div
          className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center mx-auto`}
        >
          <Icon size={24} className={color} />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-text">{module}</p>
          <p className="text-sm text-text-muted leading-relaxed">
            This module is coming in the next phase. The{' '}
            <span className="font-medium text-text">Academic Sessions</span> module
            is live — start there to set up your first academic year.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-brand font-medium bg-brand-dim px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          Scheduled for next sprint
        </div>
      </div>
    </div>
  )
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <div className="text-center space-y-3 max-w-md px-6">
          <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center mx-auto">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <p className="text-base font-semibold text-text">Something went wrong</p>
          <p className="text-sm text-text-muted">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-sm text-brand hover:text-brand-strong"
            >
              Try again
            </button>
            <ReportCrashButton error={this.state.error} />
          </div>
        </div>
      </div>
    )
  }
}

function ReportCrashButton({ error }: { error?: Error }) {
  const { openFeedback } = useFeedbackModal()
  return (
    <button
      type="button"
      onClick={() =>
        openFeedback({
          type: 'bug',
          priority: 'p0',
          initialTitle: error?.message ? `Fatal Crash: ${error.message}` : 'Application Crash',
          initialDescription: `The application crashed with the following error:

${error?.message || 'Unknown error'}

Stack:
${error?.stack || 'N/A'}`,
          errorStack: error?.stack,
          area: 'General',
        })
      }
      className="text-sm text-text-muted hover:text-text-primary underline underline-offset-2"
    >
      {__( 'Report this issue', 'codeclove-school-management' )}
    </button>
  )
}
