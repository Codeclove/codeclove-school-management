/**
 * Hierarchical TanStack Query cache key factories for CodeClove.
 *
 * Provides type-safe, centralized query keys for all domain modules.
 * Standardises cache invalidation and query deduplication across the SPA.
 */

export const queryKeys = {
  // ─── Academics ─────────────────────────────────────────────────────────────
  sessions: {
    all: ['codeclove', 'sessions'] as const,
    lists: () => [...queryKeys.sessions.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.sessions.lists(), filters] as const,
    details: () => [...queryKeys.sessions.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.sessions.details(), id] as const,
  },
  terms: {
    all: ['codeclove', 'terms'] as const,
    lists: () => [...queryKeys.terms.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.terms.lists(), filters] as const,
    bySession: (sessionId: number) => [...queryKeys.terms.all, { session_id: sessionId }] as const,
    details: () => [...queryKeys.terms.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.terms.details(), id] as const,
  },
  units: {
    all: ['codeclove', 'units'] as const,
    lists: () => [...queryKeys.units.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.units.lists(), filters] as const,
    details: () => [...queryKeys.units.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.units.details(), id] as const,
    subjects: (unitId: number) => [...queryKeys.units.all, 'subjects', unitId] as const,
  },
  groups: {
    all: ['codeclove', 'groups'] as const,
    lists: () => [...queryKeys.groups.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.groups.lists(), filters] as const,
    details: () => [...queryKeys.groups.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.groups.details(), id] as const,
  },
  subjects: {
    all: ['codeclove', 'subjects'] as const,
    lists: () => [...queryKeys.subjects.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.subjects.lists(), filters] as const,
    details: () => [...queryKeys.subjects.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.subjects.details(), id] as const,
  },
  unitSubjects: {
    all: ['codeclove', 'unit-subjects'] as const,
    byUnit: (unitId: number) => [...queryKeys.unitSubjects.all, unitId] as const,
  },
  academics: {
    all: ['codeclove', 'academics'] as const,
    sessions: () => queryKeys.sessions,
    terms: () => queryKeys.terms,
    units: () => queryKeys.units,
    groups: () => queryKeys.groups,
    subjects: () => queryKeys.subjects,
    unitSubjects: (unitId: number) => queryKeys.unitSubjects.byUnit(unitId),
  },

  // ─── Students & Guardians ──────────────────────────────────────────────────
  students: {
    all: ['codeclove', 'students'] as const,
    lists: () => [...queryKeys.students.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.students.lists(), filters] as const,
    details: () => [...queryKeys.students.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.students.details(), id] as const,
    enrollmentCounts: () => [...queryKeys.students.all, 'enrollment-counts'] as const,
  },
  guardians: {
    all: ['codeclove', 'guardians'] as const,
    lists: () => [...queryKeys.guardians.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.guardians.lists(), filters] as const,
    details: () => [...queryKeys.guardians.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.guardians.details(), id] as const,
  },

  // ─── Admissions ────────────────────────────────────────────────────────────
  admissions: {
    all: ['codeclove', 'admissions'] as const,
    lists: () => [...queryKeys.admissions.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.admissions.lists(), filters] as const,
    details: () => [...queryKeys.admissions.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.admissions.details(), id] as const,
  },

  // ─── Finance ───────────────────────────────────────────────────────────────
  finance: {
    all: ['codeclove', 'finance'] as const,
    summary: (sessionId?: number, range?: string) =>
      sessionId !== undefined
        ? ([...queryKeys.finance.all, 'summary', sessionId, range] as const)
        : ([...queryKeys.finance.all, 'summary'] as const),
    feeTypes: {
      all: ['codeclove', 'finance', 'fee-types'] as const,
      lists: () => [...queryKeys.finance.feeTypes.all, 'list'] as const,
      list: (filters?: unknown) => [...queryKeys.finance.feeTypes.lists(), filters] as const,
      details: () => [...queryKeys.finance.feeTypes.all, 'detail'] as const,
      detail: (id: number) => [...queryKeys.finance.feeTypes.details(), id] as const,
      classRates: (feeTypeId: number) => [...queryKeys.finance.feeTypes.all, 'class-rates', feeTypeId] as const,
    },
    invoices: {
      all: ['codeclove', 'finance', 'invoices'] as const,
      lists: () => [...queryKeys.finance.invoices.all, 'list'] as const,
      list: (filters?: unknown) => [...queryKeys.finance.invoices.lists(), filters] as const,
      details: () => [...queryKeys.finance.invoices.all, 'detail'] as const,
      detail: (id: number) => [...queryKeys.finance.invoices.details(), id] as const,
    },
    payments: {
      all: ['codeclove', 'finance', 'payments'] as const,
      lists: () => [...queryKeys.finance.payments.all, 'list'] as const,
      list: (filters?: unknown) => [...queryKeys.finance.payments.lists(), filters] as const,
      details: () => [...queryKeys.finance.payments.all, 'detail'] as const,
      detail: (id: number) => [...queryKeys.finance.payments.details(), id] as const,
    },
    resolveFeeAmount: (params?: unknown) =>
      [...queryKeys.finance.all, 'resolve-fee-amount', params] as const,
    defaulters: (filters?: unknown) =>
      [...queryKeys.finance.all, 'reports', 'defaulters', filters] as const,
  },
  invoices: ['invoices'] as const,

  // ─── Attendance ────────────────────────────────────────────────────────────
  attendance: {
    all: ['codeclove', 'attendance'] as const,
    registers: () => [...queryKeys.attendance.all, 'register'] as const,
    register: (filters?: unknown) => [...queryKeys.attendance.all, 'register', filters] as const,
    studentHistories: () => [...queryKeys.attendance.all, 'history', 'student'] as const,
    studentHistory: (studentId: number) => [...queryKeys.attendance.all, 'history', 'student', studentId] as const,
    staffRegisters: () => [...queryKeys.attendance.all, 'register-staff'] as const,
    staffRegister: (date?: string) => [...queryKeys.attendance.all, 'register-staff', date] as const,
    staffHistories: () => [...queryKeys.attendance.all, 'history', 'staff'] as const,
    staffHistory: (staffMemberId: number) => [...queryKeys.attendance.all, 'history', 'staff', staffMemberId] as const,
    monthlyStudent: (filters?: unknown) =>
      filters ? ([...queryKeys.attendance.all, 'monthly-student', filters] as const) : ([...queryKeys.attendance.all, 'monthly-student'] as const),
    monthlyStaff: (year?: number, month?: number) =>
      year || month ? ([...queryKeys.attendance.all, 'monthly-staff', { year, month }] as const) : ([...queryKeys.attendance.all, 'monthly-staff'] as const),
  },

  // ─── Staff & HR ────────────────────────────────────────────────────────────
  staff: {
    all: ['codeclove', 'staff'] as const,
    lists: () => [...queryKeys.staff.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.staff.lists(), filters] as const,
    details: () => [...queryKeys.staff.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.staff.details(), id] as const,
    applications: {
      all: ['codeclove', 'staff-applications'] as const,
      lists: () => [...queryKeys.staff.applications.all, 'list'] as const,
      list: (filters?: unknown) => [...queryKeys.staff.applications.lists(), filters] as const,
      details: () => [...queryKeys.staff.applications.all, 'detail'] as const,
      detail: (id: number) => [...queryKeys.staff.applications.details(), id] as const,
    },
  },

  // ─── Roles & Permissions ───────────────────────────────────────────────────
  roles: {
    all: ['codeclove', 'roles'] as const,
    lists: () => [...queryKeys.roles.all, 'list'] as const,
    list: () => [...queryKeys.roles.lists()] as const,
    details: () => [...queryKeys.roles.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.roles.details(), id] as const,
    systemPermissions: () => [...queryKeys.roles.all, 'permissions'] as const,
  },

  // ─── Timetable ─────────────────────────────────────────────────────────────
  timetable: {
    all: ['codeclove', 'timetable'] as const,
    periods: {
      all: ['codeclove', 'timetable', 'periods'] as const,
      lists: () => [...queryKeys.timetable.periods.all, 'list'] as const,
      list: (filters?: unknown) => [...queryKeys.timetable.periods.lists(), filters] as const,
    },
    slots: {
      all: ['codeclove', 'timetable', 'slots'] as const,
      lists: () => [...queryKeys.timetable.slots.all, 'list'] as const,
      list: (filters?: unknown) => [...queryKeys.timetable.slots.lists(), filters] as const,
    },
    conflicts: (sessionId?: number) =>
      sessionId !== undefined
        ? ([...queryKeys.timetable.all, 'conflicts', sessionId] as const)
        : ([...queryKeys.timetable.all, 'conflicts'] as const),
    substitutes: {
      all: ['codeclove', 'timetable', 'substitutes'] as const,
      lists: () => [...queryKeys.timetable.substitutes.all, 'list'] as const,
      list: (filters?: unknown) => [...queryKeys.timetable.substitutes.lists(), filters] as const,
    },
  },
  // ─── Settings & Presets ────────────────────────────────────────────────────
  settings: {
    all: ['codeclove', 'settings'] as const,
    detail: () => [...queryKeys.settings.all] as const,
    presets: () => [...queryKeys.settings.all, 'presets'] as const,
    health: () => [...queryKeys.settings.all, 'health'] as const,
  },
  presets: {
    all: ['codeclove', 'settings', 'presets'] as const,
    list: () => [...queryKeys.presets.all] as const,
  },

  // ─── Activity Log ──────────────────────────────────────────────────────────
  activity: {
    all: ['codeclove', 'activity-log'] as const,
    lists: () => [...queryKeys.activity.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.activity.lists(), filters] as const,
  },

  // ─── Notifications ─────────────────────────────────────────────────────────
  notifications: {
    all: ['codeclove', 'notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (page?: number, perPage?: number) => [...queryKeys.notifications.lists(), page, perPage] as const,
    preferences: () => [...queryKeys.notifications.all, 'preferences'] as const,
  },
  announcements: {
    all: ['codeclove', 'announcements'] as const,
    lists: () => [...queryKeys.announcements.all, 'list'] as const,
    list: (filters?: unknown) => [...queryKeys.announcements.lists(), filters] as const,
  },

  // ─── Me / Current User ─────────────────────────────────────────────────────
  me: {
    all: ['codeclove', 'me'] as const,
    details: () => [...queryKeys.me.all] as const,
  },

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    all: ['codeclove', 'dashboard-stats'] as const,
    stats: (sessionId?: number, range?: string) => [...queryKeys.dashboard.all, sessionId, range] as const,
  },

  // ─── Promotion & Rollover ──────────────────────────────────────────────────
  promotion: {
    all: ['codeclove', 'promotion'] as const,
    eligible: (filters?: unknown) => [...queryKeys.promotion.all, 'eligible', filters] as const,
  },

  // ─── Demo Data ─────────────────────────────────────────────────────────────
  demoData: {
    all: ['codeclove', 'demo-data'] as const,
    status: () => [...queryKeys.demoData.all, 'status'] as const,
  },
} as const
