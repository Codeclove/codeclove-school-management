import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Clock,
  Smartphone,
  Layers,
  ArrowRight,
  HelpCircle,
  Star,
  Award,
  TrendingUp,
  History,
} from 'lucide-react'
import { __ } from '@/lib/i18n'

export default function ProUpgradePage() {
  const [searchParams] = useSearchParams()
  const highlightedFeature = searchParams.get('feature') || ''
  const proUrl = window.CodeCloveConfig?.proUrl || 'https://codeclove.com/?utm_source=wp_plugin&utm_medium=pro_page&utm_campaign=upgrade'

  const features = useMemo(() => [
    {
      id: 'payment_gateways',
      title: __( 'Online Payment Gateways', 'codeclove-school-management' ),
      description: __( 'Accept tuition fee payments online. Webhook callbacks automatically mark invoices paid and generate digital payment receipts.', 'codeclove-school-management' ),
      icon: CreditCard,
      badge: __( 'Payment Gateways', 'codeclove-school-management' ),
      perks: [
        __( 'Stripe for global cards, Apple Pay, and Google Pay', 'codeclove-school-management' ),
        __( 'Razorpay for India: UPI, NetBanking, and domestic cards', 'codeclove-school-management' ),
        __( 'Automated invoice reconciliation via webhook callbacks', 'codeclove-school-management' ),
      ],
    },
    {
      id: 'timetable',
      title: __( 'Clash-Free Timetables & Substitutes', 'codeclove-school-management' ),
      description: __( 'Build weekly schedules without teacher or room collisions. Reassign absent staff in two clicks with complete substitution logs.', 'codeclove-school-management' ),
      icon: Clock,
      badge: __( 'Scheduling', 'codeclove-school-management' ),
      perks: [
        __( 'Real-time clash detection for teachers, rooms, and sections', 'codeclove-school-management' ),
        __( 'Daily substitute assignment with audit trail', 'codeclove-school-management' ),
        __( 'Live schedules sync directly to student and guardian portal', 'codeclove-school-management' ),
      ],
    },
    {
      id: 'defaulters',
      title: __( 'Fee Defaulters & Revenue Reports', 'codeclove-school-management' ),
      description: __( 'Spot unpaid tuition before it becomes bad debt. Filter defaulters by grade and export actionable collection lists.', 'codeclove-school-management' ),
      icon: TrendingUp,
      badge: __( 'Cash Flow', 'codeclove-school-management' ),
      perks: [
        __( 'Filter overdue balances by class, session, and days late', 'codeclove-school-management' ),
        __( 'Collection breakdown by cash, bank transfer, and online', 'codeclove-school-management' ),
        __( 'One-click CSV export for payment reminders and board reports', 'codeclove-school-management' ),
      ],
    },
    {
      id: 'sms',
      title: __( 'Automated SMS & Parent Alerts', 'codeclove-school-management' ),
      description: __( 'Alert parents immediately when a student is absent or fees are due. Uses your own provider at direct wholesale carrier rates.', 'codeclove-school-management' ),
      icon: Smartphone,
      badge: __( 'Instant Delivery', 'codeclove-school-management' ),
      perks: [
        __( 'Built-in drivers for Twilio, MSG91, Fast2SMS, and Vonage', 'codeclove-school-management' ),
        __( 'Instant absence alerts triggered during morning roll call', 'codeclove-school-management' ),
        __( 'Custom message templates with dynamic student and fee tags', 'codeclove-school-management' ),
      ],
    },
    {
      id: 'promotion',
      title: __( 'Batch Student Promotion', 'codeclove-school-management' ),
      description: __( 'Roll your entire school over to the next academic session in minutes without re-entering student records.', 'codeclove-school-management' ),
      icon: Layers,
      badge: __( 'Session Rollover', 'codeclove-school-management' ),
      perks: [
        __( 'One-click clone of classes, sections, and subject structures', 'codeclove-school-management' ),
        __( 'Batch promote, retain, or graduate with individual overrides', 'codeclove-school-management' ),
        __( 'Preserves past session grades, enrollments, and balances', 'codeclove-school-management' ),
      ],
    },
    {
      id: 'audit_log',
      title: __( 'Audit Trail & Activity Log', 'codeclove-school-management' ),
      description: __( 'Track administrative actions across the system to resolve fee disputes, grade edits, and staff permission changes.', 'codeclove-school-management' ),
      icon: History,
      badge: __( 'Security & Audit', 'codeclove-school-management' ),
      perks: [
        __( 'Event tracking across finance, admissions, staff, and attendance', 'codeclove-school-management' ),
        __( 'Captures user ID, timestamp, IP address, and change payload', 'codeclove-school-management' ),
        __( 'Filterable timeline to investigate any record modification', 'codeclove-school-management' ),
      ],
    },
  ], [])

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* ─── Hero Header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand-strong to-indigo-700 text-white p-8 md:p-10 shadow-lg">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
            <Sparkles size={14} className="text-amber-300" />
            {__( 'School Management Pro Upgrade', 'codeclove-school-management' )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {__( 'Run Your Entire School on Autopilot with Pro', 'codeclove-school-management' )}
          </h1>

          <p className="text-base md:text-lg text-white/90 leading-relaxed max-w-2xl">
            {__( 'Collect fees online, build clash-free timetables, and send automated SMS alerts. All your existing student and academic records remain intact.', 'codeclove-school-management' )}
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <a
              href={proUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold bg-white text-brand hover:text-brand-strong hover:bg-slate-50 transition-all duration-150 shadow-md hover:shadow-lg active:scale-95"
            >
              <Star size={16} className="text-amber-500 fill-amber-500" />
              <span>{__( 'Upgrade to Pro Now', 'codeclove-school-management' )}</span>
              <ExternalLink size={15} />
            </a>

            <div className="flex items-center gap-2 text-xs text-white/80 font-medium">
              <ShieldCheck size={16} className="text-emerald-300" />
              <span>{__( '100% Data Preserved • 14-Day Money-Back Guarantee', 'codeclove-school-management' )}</span>
            </div>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ─── Highlights Cards ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="text-xl font-bold text-text">
              {__( 'Pro Modules at a Glance', 'codeclove-school-management' )}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {__( 'Automate fee collection, class scheduling, parent communication, and session rollovers.', 'codeclove-school-management' )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => {
            const Icon = feat.icon
            const isTargeted = highlightedFeature === feat.id

            return (
              <div
                key={feat.id}
                id={`feature-${feat.id}`}
                className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all duration-200 bg-bg-surface ${
                  isTargeted
                    ? 'border-brand ring-2 ring-brand/20 shadow-md'
                    : 'border-border hover:border-brand/40 hover:shadow-sm'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                    <span className="text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                      {feat.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-text leading-snug">{feat.title}</h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{feat.description}</p>
                  </div>

                  <ul className="space-y-1.5 pt-2.5 border-t border-border/60">
                    {feat.perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text-subtle">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 mt-3 border-t border-border/50">
                  <a
                    href={`${proUrl}&feature=${feat.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong transition-colors"
                  >
                    <span>{__( 'Unlock in Pro', 'codeclove-school-management' )}</span>
                    <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* Priority Updates & Direct Support Full-Width Trust Card */}
        <div
          id="feature-priority_updates"
          className={`p-4 sm:p-5 rounded-xl border transition-all duration-200 bg-bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            highlightedFeature === 'priority_updates'
              ? 'border-brand ring-2 ring-brand/20 shadow-md'
              : 'border-border hover:border-brand/40 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text">
                  {__( 'Priority Updates & Direct Helpdesk Support', 'codeclove-school-management' )}
                </h3>
                <span className="text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                  {__( 'Official License', 'codeclove-school-management' )}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                {__( 'One-click in-dashboard updates, direct email support from core developers, and 14-day refund guarantee.', 'codeclove-school-management' )}
              </p>
            </div>
          </div>

          <a
            href={`${proUrl}&feature=priority_updates`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong transition-colors shrink-0 self-start sm:self-center"
          >
            <span>{__( 'Unlock in Pro', 'codeclove-school-management' )}</span>
            <ArrowRight size={13} />
          </a>
        </div>
      </div>

      {/* ─── Comparison Matrix ─────────────────────────────────────────────────── */}
      <div className="space-y-4 pt-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-xl font-bold text-text">
            {__( 'Compare Free vs Pro Editions', 'codeclove-school-management' )}
          </h2>
          <p className="text-xs text-text-muted">
            {__( 'See exactly what is included in each version.', 'codeclove-school-management' )}
          </p>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-bg-base border-b border-border">
                  <th className="py-3 px-4 font-bold text-text">{__( 'Core Feature', 'codeclove-school-management' )}</th>
                  <th className="py-3 px-4 font-bold text-text w-36 text-center">{__( 'Free Edition', 'codeclove-school-management' )}</th>
                  <th className="py-3 px-4 font-bold text-brand w-36 text-center bg-brand/5">{__( 'Pro Edition', 'codeclove-school-management' )}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {([
                  [__( 'Unlimited Student Records & Profiles', 'codeclove-school-management' ), true, true],
                  [__( 'Staff & Faculty Management', 'codeclove-school-management' ), true, true],
                  [__( 'Academic Sessions, Terms & Subjects', 'codeclove-school-management' ), true, true],
                  [__( 'Daily Student Attendance Marking & Logs', 'codeclove-school-management' ), true, true],
                  [__( 'Multi-Country Presets (IN, US, GB)', 'codeclove-school-management' ), true, true],
                  [__( 'Online Admissions & Public Application Form', 'codeclove-school-management' ), true, true],
                  [__( 'Fee Types, Invoicing & Manual Receipts', 'codeclove-school-management' ), true, true],
                  [__( 'Bulk CSV Spreadsheet Import (Students & Staff)', 'codeclove-school-management' ), true, true],
                  [__( 'Online Payment Gateways (Stripe & Razorpay)', 'codeclove-school-management' ), false, true],
                  [__( 'Financial Analytics & Revenue Breakdown Charts', 'codeclove-school-management' ), false, true],
                  [__( 'Fee Defaulters Reports & Overdue Auditing', 'codeclove-school-management' ), false, true],
                  [__( 'Student & Guardian Portal (Attendance, Fees & Academics)', 'codeclove-school-management' ), true, true],
                  [__( 'Portal Class Timetables & Schedules Viewer', 'codeclove-school-management' ), false, true],
                  [__( 'Weekly Timetable Matrix & Teacher Substitutions', 'codeclove-school-management' ), false, true],
                  [__( 'Automated Overdue Recalculation Cron', 'codeclove-school-management' ), false, true],
                  [__( 'Multi-Gateway SMS Notifications (Twilio, Vonage, MSG91, Fast2SMS)', 'codeclove-school-management' ), false, true],
                  [__( 'Digital Noticeboard & Announcements Broadcast', 'codeclove-school-management' ), false, true],
                  [__( 'Portal In-App Alerts & Push Notifications', 'codeclove-school-management' ), false, true],
                  [__( 'Automated Batch Student Promotion Rollover', 'codeclove-school-management' ), false, true],
                  [__( 'System Activity Log & Full Audit Trail', 'codeclove-school-management' ), false, true],
                  [__( 'Granular Custom Role & Permission Matrix', 'codeclove-school-management' ), false, true],
                  [__( 'One-Click In-Dashboard Automatic Updates', 'codeclove-school-management' ), false, true],
                  [__( 'Early Access to New Country Presets & Features', 'codeclove-school-management' ), false, true],
                  [__( 'Direct Email & Helpdesk Support', 'codeclove-school-management' ), false, true],
                ] as const).map(([label, free, pro]) => (
                  <tr key={label}>
                    <td className="py-3 px-4 font-medium text-text">{label}</td>
                    <td className="py-3 px-4 text-center">
                      {free ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" /> : <XCircle size={16} className="text-text-muted/40 mx-auto" />}
                    </td>
                    <td className="py-3 px-4 text-center bg-brand/5">
                      {pro ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" /> : <XCircle size={16} className="text-text-muted/40 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Upgrade Call to Action ───────────────────────────────────────────── */}
      <div className="bg-bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <Award className="text-amber-500" size={20} />
            <h3 className="text-lg font-bold text-text">{__( 'Ready to upgrade to Pro?', 'codeclove-school-management' )}</h3>
          </div>
          <p className="text-xs text-text-muted max-w-lg">
            {__( 'Install Pro directly onto your WordPress site. All your current students, sessions, staff, and attendance logs are automatically preserved with 100% compatibility.', 'codeclove-school-management' )}
          </p>
        </div>

        <a
          href={proUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold bg-brand text-white hover:text-white hover:bg-brand-strong transition-all duration-150 shadow-md hover:shadow-lg flex-shrink-0"
        >
          <span className="text-white">{__( 'Get Pro Now', 'codeclove-school-management' )}</span>
          <ExternalLink size={15} className="text-white" />
        </a>
      </div>

      {/* ─── Frequently Asked Questions ───────────────────────────────────────── */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-brand" />
          <h3 className="text-base font-bold text-text">{__( 'Upgrade FAQ', 'codeclove-school-management' )}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1.5">
            <h4 className="text-xs font-bold text-text">{__( 'Will I lose any existing data when upgrading to Pro?', 'codeclove-school-management' )}</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              {__( 'No. Pro uses the exact same database tables. When you activate Pro, all your students, classes, invoices, and attendance logs carry over automatically with zero data migration needed.', 'codeclove-school-management' )}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1.5">
            <h4 className="text-xs font-bold text-text">{__( 'How do I activate Pro after purchasing?', 'codeclove-school-management' )}</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              {__( 'After purchase on CodeClove, download the Pro plugin zip from your account, upload it in Plugins → Add New, activate it, and enter your license key.', 'codeclove-school-management' )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
