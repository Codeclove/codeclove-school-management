import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui'
import { FeedbackProvider } from '@/lib/feedback-context'
import Sidebar from '../layouts/Sidebar'
import { PortalHeader } from '../portal/layouts/PortalHeader'

let mockSettings: Record<string, any> = {
  school: {
    name: 'Test academy International',
    code: 'NIA-IN-01',
    logo: 'https://example.com/school-logo.png',
  },
}

vi.mock('@/api/settings', () => ({
  useSettings: () => ({
    data: mockSettings,
    isLoading: false,
  }),
  useUpdateSettings: () => ({
    mutate: vi.fn(),
  }),
}))

const mockPortalContext = {
  user: { id: 1, name: 'John Doe', email: 'john@example.com' },
  userRole: 'student' as const,
  logoutUrl: '/logout',
  students: [{ id: 10, display_name: 'Alex Doe' }],
  siteName: 'Test academy International',
  logoUrl: 'https://example.com/school-logo.png',
}

vi.mock('../portal/lib/portal-context', () => ({
  usePortal: () => mockPortalContext,
}))

describe('School Branding & Settings Synchronization', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    mockSettings = {
      school: {
        name: 'Test academy International',
        code: 'NIA-IN-01',
        logo: 'https://example.com/school-logo.png',
      },
    }
    globalThis.window = {
      CodeCloveConfig: {
        isPro: true,
        currentUser: { id: 1, name: 'Admin', email: 'admin@example.com', avatar: '', isAdmin: true },
        permissions: ['*'],
        school: {
          name: 'Test academy International',
          code: 'NIA-IN-01',
          logo: 'https://example.com/school-logo.png',
        },
      },
      CodeClovePortalConfig: {
        isPro: true,
      },
    } as unknown as Window & typeof globalThis
  })

  it('renders custom school name and logo image in SidebarBrand, removing CodeClove text', () => {
    const html = renderToString(
      <MemoryRouter>
        <FeedbackProvider>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </FeedbackProvider>
      </MemoryRouter>
    )

    // Contains the school name
    expect(html).toContain('Test academy International')
    // Removes the CodeClove brand headline when custom school is active
    expect(html).not.toContain('>CodeClove<')
    expect(html).not.toContain('>School Management<')
    // Contains the custom school logo image
    expect(html).toContain('src="https://example.com/school-logo.png"')
    expect(html).toContain('alt="Test academy International"')
    // Contains truncation title attribute
    expect(html).toContain('title="Test academy International"')
  })

  it('falls back to default CodeClove branding when no custom school name or logo is provided', () => {
    mockSettings = {
      school: {
        name: '',
        code: '',
        logo: '',
      },
    }
    globalThis.window = {
      CodeCloveConfig: {
        isPro: true,
        currentUser: { id: 1, name: 'Admin', email: 'admin@example.com', avatar: '', isAdmin: true },
        permissions: ['*'],
        school: {
          name: '',
          code: '',
          logo: '',
        },
      },
      CodeClovePortalConfig: {
        isPro: true,
      },
    } as unknown as Window & typeof globalThis

    const html = renderToString(
      <MemoryRouter>
        <FeedbackProvider>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </FeedbackProvider>
      </MemoryRouter>
    )

    // Falls back to CodeClove
    expect(html).toContain('CodeClove')
    expect(html).toContain('School Management')
    // Does not render custom school logo image
    expect(html).not.toContain('src="https://example.com/school-logo.png"')
  })

  it('renders custom school logo and institution name in PortalHeader', () => {
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PortalHeader
            isMobileOpen={false}
            onToggleMobileMenu={vi.fn()}
            isMaximized={false}
            onToggleMaximize={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(html).toContain('Test academy International')
    expect(html).toContain('src="https://example.com/school-logo.png"')
    expect(html).toContain('Student Portal')
  })
})
