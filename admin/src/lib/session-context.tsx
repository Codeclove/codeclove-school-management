/**
 * Session Context — global academic session selector state.
 *
 * The selected session affects all session-scoped modules:
 * Academics, Students, Attendance, Finance, Reports.
 *
 * Usage:
 *   // Wrap in AppShell (already done via App.tsx providers)
 *   const { sessionId, sessionLabel, setSession } = useSession()
 */
import { createContext, useCallback, useContext, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionInfo {
  id: number
  label: string
  status: 'active' | 'archived' | 'future'
}

interface SessionContextValue {
  session: SessionInfo | null
  setSession: (session: SessionInfo) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SessionContext = createContext<SessionContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<SessionInfo | null>(null)

  const setSession = useCallback((next: SessionInfo) => {
    try {
      localStorage.setItem('codeclove_selected_session', JSON.stringify(next))
    } catch (e) {
      console.warn('Failed to save academic session to localStorage:', e)
    }
    setSessionState(next)
  }, [])

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>')
  }
  return ctx
}
