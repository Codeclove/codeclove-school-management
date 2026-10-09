import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SettingsPage, { PRO_TAB_UPGRADE_MAP } from '../modules/settings/SettingsPage'
import { FeedbackProvider } from '../lib/feedback-context'
import { ConfirmProvider } from '../lib/confirm'
import { ToastProvider } from '../lib/toast'

vi.mock('@/api/settings', () => ({
  useSettings: () => ({
    data: {
      school: { name: 'CodeClove Academy' },
      localization: { currency: 'USD', number_format: 'standard' },
    },
    isLoading: false,
    isError: false,
  }),
  usePresets: () => ({ data: [] }),
  useApplyPreset: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSettings: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe('Settings Pro Direct Upgrade Links', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    globalThis.window = {
      CodeCloveConfig: {
        isPro: false,
        proUrl: 'https://codeclove.com/?utm_source=test',
        currentUser: { isAdmin: true },
        permissions: ['*'],
      },
    } as unknown as Window & typeof globalThis

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    })
  })

  it('renders all Pro tabs in Settings sidebar with PRO badges for Free users', () => {
    // @ts-ignore
    window.CodeCloveConfig.isPro = false

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/settings?tab=general']}>
          <ToastProvider>
            <ConfirmProvider>
              <FeedbackProvider>
                <SettingsPage />
              </FeedbackProvider>
            </ConfirmProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Pro tabs should be visible in the nav
    expect(html).toContain('Payment Gateways')
    expect(html).toContain('SMS Alerts')
    expect(html).toContain('WhatsApp Alerts')
    expect(html).toContain('In-App Alerts')
    expect(html).toContain('Activity Log')

    // Amber PRO badge should be rendered
    expect(html).toContain('PRO')
    expect(html).toContain('bg-amber-500/15')
    expect(html).toContain('text-amber-500')
  })

  it('binds direct pro-upgrade feature URLs to Pro tab items in Free edition', () => {
    // @ts-ignore
    window.CodeCloveConfig.isPro = false

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/settings?tab=general']}>
          <ToastProvider>
            <ConfirmProvider>
              <FeedbackProvider>
                <SettingsPage />
              </FeedbackProvider>
            </ConfirmProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Verify direct data-pro-upgrade links
    expect(html).toContain('data-pro-upgrade="/pro-upgrade?feature=payment_gateways"')
    expect(html).toContain('data-pro-upgrade="/pro-upgrade?feature=sms"')
    expect(html).toContain('data-pro-upgrade="/pro-upgrade?feature=audit_log"')
  })

  it('maps all Pro tabs to valid feature anchors in PRO_TAB_UPGRADE_MAP', () => {
    expect(PRO_TAB_UPGRADE_MAP.gateways).toBe('payment_gateways')
    expect(PRO_TAB_UPGRADE_MAP.sms_notifications).toBe('sms')
    expect(PRO_TAB_UPGRADE_MAP.whatsapp_notifications).toBe('sms')
    expect(PRO_TAB_UPGRADE_MAP.in_app_notifications).toBe('sms')
    expect(PRO_TAB_UPGRADE_MAP.activity_log).toBe('audit_log')
  })

  it('does not render PRO badge or pro-upgrade attributes for Pro users', () => {
    // @ts-ignore
    window.CodeCloveConfig.isPro = true

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/settings?tab=general']}>
          <ToastProvider>
            <ConfirmProvider>
              <FeedbackProvider>
                <SettingsPage />
              </FeedbackProvider>
            </ConfirmProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Pro tabs should be visible
    expect(html).toContain('Payment Gateways')
    expect(html).toContain('SMS Alerts')

    // Nav items should NOT contain the amber PRO tag or data-pro-upgrade
    expect(html).not.toMatch(/Payment Gateways[\s\S]*?bg-amber-500\/15 text-amber-500 border border-amber-500\/25[\s\S]*?PRO/)
    expect(html).not.toContain('data-pro-upgrade')
  })
})
