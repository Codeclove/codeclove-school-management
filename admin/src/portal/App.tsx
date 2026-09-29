/**
 * CodeClove Portal Application Root.
 *
 * Configures QueryClient, HashRouter, PortalProvider, and route hierarchy.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PortalProvider } from './lib/portal-context'
import { PortalShell } from './layouts/PortalShell'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { AttendancePage } from './modules/attendance/AttendancePage'
import { FinancePage } from './modules/finance/FinancePage'
import { TimetablePage } from './modules/timetable/TimetablePage'
import { AcademicsPage } from './modules/academics/AcademicsPage'
import { NotificationsPage } from './modules/notifications/NotificationsPage'
import { ProfilePage } from './modules/profile/ProfilePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
})

export default function App() {
  const isPro = window.CodeClovePortalConfig?.isPro ?? false

  return (
    <QueryClientProvider client={queryClient}>
      <PortalProvider>
        <HashRouter>
          <Routes>
            <Route element={<PortalShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/finance" element={<FinancePage />} />
              {isPro && <Route path="/timetable" element={<TimetablePage />} />}
              <Route path="/academics" element={<AcademicsPage />} />
              {isPro && <Route path="/notifications" element={<NotificationsPage />} />}
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </PortalProvider>
    </QueryClientProvider>
  )
}
