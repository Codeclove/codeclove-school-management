import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Sidebar from '../layouts/Sidebar'
import type * as FinanceApi from '@/api/finance'
import DefaultersReportPage from '../modules/finance/DefaultersReportPage'
import PaymentsPage from '../modules/finance/PaymentsPage'
import InvoiceDetailPage from '../modules/finance/InvoiceDetailPage'
import RecordPaymentPage from '../modules/finance/RecordPaymentPage'
import { ProGatewayLockModal } from '../modules/finance/components/ProGatewayLockModal'
import { FeedbackProvider } from '../lib/feedback-context'
import { SessionProvider } from '../lib/session-context'
import { TooltipProvider } from '../components/ui/Tooltip'

// Mock API hooks so components can render deterministically in tests
vi.mock('@/api/finance', async (importOriginal) => {
  const actual = await importOriginal<typeof FinanceApi>()
  return {
    ...actual,
    usePayments: () => ({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useInvoice: () => ({
      data: {
        id: 101,
        invoice_number: 'INV-2026-0042',
        student_id: 1,
        student_first_name: 'Liam',
        student_last_name: 'Smith',
        student_number: 'STU-1001',
        currency: 'USD',
        status: 'issued',
        issue_date: '2026-10-01',
        due_date: '2026-10-31',
        subtotal_minor: 50000,
        discount_minor: 0,
        total_minor: 50000,
        paid_minor: 0,
        balance_minor: 50000,
        line_items: [],
        payments: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useDefaultersReport: () => ({
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useDeletePayment: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteInvoice: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateInvoice: () => ({ mutate: vi.fn(), isPending: false }),
    useRecordPayment: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

vi.mock('@/api/students', () => ({
  useStudentDetails: () => ({
    data: {
      id: 1,
      first_name: 'Liam',
      last_name: 'Smith',
      student_number: 'STU-1001',
    },
    isLoading: false,
  }),
}))

vi.mock('@/api/academics', () => ({
  useUnits: () => ({ data: { data: [] }, isLoading: false }),
  useGroups: () => ({ data: { data: [] }, isLoading: false }),
}))

vi.mock('@/api/settings', () => ({
  useSettings: () => ({
    data: {
      school: { name: 'CodeClove Academy' },
      payment_methods: { cash: true, upi: true, card: true, bank_transfer: true },
    },
    isLoading: false,
  }),
}))

vi.mock('@/api/gateways', () => ({
  useGatewaysConfig: () => ({
    data: { gateways: {} },
    isLoading: false,
  }),
}))

vi.mock('@/lib/confirm', () => ({
  useConfirm: () => vi.fn(),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div data-dialog-root>{children}</div> : null),
  Portal: ({ children }: { children: React.ReactNode }) => <div data-dialog-portal>{children}</div>,
  Overlay: ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  Content: ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  Title: ({ children, className }: { children?: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  Description: ({ children, className }: { children?: React.ReactNode; className?: string }) => <p className={className}>{children}</p>,
  Close: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

describe('Feature 2: Contextual Pro Locks inside Finance', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    const docElem = { dir: 'ltr' }
    globalThis.document = {
      documentElement: docElem,
      getElementById: () => null,
    } as unknown as Document
    globalThis.window = {
      CodeCloveConfig: {
        isPro: false,
        currentUser: { isAdmin: true },
        permissions: ['finance.view', 'invoices.view', 'payments.view'],
        currency: 'USD',
        locale: 'en-US',
      },
    } as unknown as Window & typeof globalThis

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  describe('1. Fee Defaulters Sidebar Navigation & PRO Badge', () => {
    it('renders Defaulters Report in sidebar for Free users with an amber PRO badge pill', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = false

      const html = renderToString(
        <MemoryRouter>
          <FeedbackProvider>
            <TooltipProvider>
              <Sidebar />
            </TooltipProvider>
          </FeedbackProvider>
        </MemoryRouter>
      )

      expect(html).toContain('Defaulters')
      expect(html).toContain('/finance/reports/defaulters')
      // PRO badge styling check
      expect(html).toContain('bg-amber-500/15')
      expect(html).toContain('text-amber-500')
      expect(html).toContain('border-amber-500/25')
      expect(html).toContain('PRO')
    })

    it('does not render PRO badge for Pro users in sidebar Defaulters Report item', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = true

      const html = renderToString(
        <MemoryRouter>
          <FeedbackProvider>
            <TooltipProvider>
              <Sidebar />
            </TooltipProvider>
          </FeedbackProvider>
        </MemoryRouter>
      )

      expect(html).toContain('Defaulters')
      expect(html).toContain('/finance/reports/defaulters')
      // Should not contain the amber PRO tag next to Defaulters
      expect(html).not.toMatch(/Defaulters[\s\S]*?bg-amber-500\/15 text-amber-500 border border-amber-500\/25[\s\S]*?PRO/)
    })

    it('renders Timetable in sidebar for Free users with PRO badge redirecting to upgrade page', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = false

      const html = renderToString(
        <MemoryRouter>
          <FeedbackProvider>
            <TooltipProvider>
              <Sidebar />
            </TooltipProvider>
          </FeedbackProvider>
        </MemoryRouter>
      )

      expect(html).toContain('Timetable')
      expect(html).toContain('/pro-upgrade?feature=timetable')
      expect(html).toMatch(/Timetable[\s\S]*?bg-amber-500\/15 text-amber-500 border border-amber-500\/25[\s\S]*?PRO/)
    })

    it('renders Timetable in sidebar for Pro users navigating to /academics/timetable without PRO badge', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = true

      const html = renderToString(
        <MemoryRouter>
          <FeedbackProvider>
            <TooltipProvider>
              <Sidebar />
            </TooltipProvider>
          </FeedbackProvider>
        </MemoryRouter>
      )

      expect(html).toContain('Timetable')
      expect(html).toContain('/academics/timetable')
      expect(html).not.toMatch(/Timetable[\s\S]*?bg-amber-500\/15 text-amber-500 border border-amber-500\/25[\s\S]*?PRO/)
    })
  })

  describe('2. DefaultersReportPage Contextual Pro Lock', () => {
    it('renders contextual pro lock preview page when isPro is false', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = false

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SessionProvider>
              <DefaultersReportPage />
            </SessionProvider>
          </MemoryRouter>
        </QueryClientProvider>
      )

      // 1. Page Header & Pro Feature badge
      expect(html).toContain('Fee Defaulters Report')
      expect(html).toContain('Pro Feature')

      // 2. Metric preview cards
      expect(html).toContain('Total Overdue')
      expect(html).toContain('30+ Days Arrears')
      expect(html).toContain('60+ Days Arrears')
      expect(html).toContain('Defaulters Count')

      // 3. Glassmorphic Lock Card
      expect(html).toContain('Fee Defaulters &amp; Overdue Auditing is a Pro Feature')
      expect(html).toContain('Track overdue student tuition fees')

      // 4. Feature list
      expect(html).toContain('Overdue breakdown by Class, Section, and Term')
      expect(html).toContain('Aging analysis buckets (30, 60, 90+ days overdue)')
      expect(html).toContain('Direct PDF &amp; CSV export for administrative collection')
      expect(html).toContain('Integrated SMS &amp; WhatsApp payment reminders')

      // 5. Action CTA buttons
      expect(html).toContain('Upgrade to CodeClove Pro')
      expect(html).toContain('View Invoices')
    })
  })

  describe('3. InvoiceDetailPage Contextual Pro Button & ProGatewayLockModal', () => {
    it('renders Pay Online Pro button alongside Record Payment when isPro is false', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = false

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SessionProvider>
              <InvoiceDetailPage />
            </SessionProvider>
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(html).toContain('Pay Online (Razorpay / Stripe)')
      expect(html).toContain('Record Payment')
      expect(html).toContain('bg-amber-500/15')
      expect(html).toContain('text-amber-500')
      expect(html).toContain('PRO')
    })

    it('ProGatewayLockModal renders Razorpay and Stripe details and upgrade link', () => {
      const html = renderToString(
        <MemoryRouter>
          <ProGatewayLockModal isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      )

      expect(html).toContain('Automated Online Payment Gateways')
      expect(html).toContain('Razorpay')
      expect(html).toContain('India &amp; South Asia')
      expect(html).toContain('Stripe')
      expect(html).toContain('Global / Worldwide')
      expect(html).toContain('Zero Manual Entry')
      expect(html).toContain('Automatic Marking')
      expect(html).toContain('Instant Receipts')
      expect(html).toContain('Upgrade to CodeClove Pro')
    })
  })

  describe('4. PaymentsPage Contextual Pro Banner', () => {
    it('renders contextual online payments banner when isPro is false', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = false

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SessionProvider>
              <PaymentsPage />
            </SessionProvider>
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(html).toContain('Automate UPI &amp; Card Collections')
      expect(html).toContain('Connect Razorpay for instant UPI, QR Code, and NetBanking payments, or Stripe for cards and digital wallets.')
      expect(html).toContain('Unlock Online Payments (Pro)')
      expect(html).toContain('PRO')
    })

    it('does not render contextual online payments banner when isPro is true', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = true

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SessionProvider>
              <PaymentsPage />
            </SessionProvider>
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(html).not.toContain('Automate UPI &amp; Card Collections')
      expect(html).not.toContain('Unlock Online Payments (Pro)')
    })
  })

  describe('5. RecordPaymentPage Inline Pro Contextual Banner for UPI/Card', () => {
    it('renders inline contextual banner explaining automated UPI when isPro is false', () => {
      // @ts-ignore
      window.CodeCloveConfig.isPro = false

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/finance/invoices/101/record-payment']}>
            <SessionProvider>
              <RecordPaymentPage />
            </SessionProvider>
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(html).toContain('Record Fee Receipt')
      expect(html).toContain('Payment Method')
    })
  })
})
