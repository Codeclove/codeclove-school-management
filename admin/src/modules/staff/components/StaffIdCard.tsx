import { User } from 'lucide-react'
import { Barcode, type SchoolSettings } from '@/components/ui'
import { type Staff } from '@/api/staff'
import { __ } from '@/lib/i18n'

export type StaffCardColorScheme = 'blue' | 'purple' | 'rose'

export interface StaffIdCardProps {
  staff: Staff
  school?: SchoolSettings
  sessionLabel?: string
  formatDate?: (dateStr: string) => string
  dual?: boolean
  colorScheme?: StaffCardColorScheme
}

const COLOR_THEMES: Record<StaffCardColorScheme, {
  headerBg: string
  headerGradient: string
  headerBorder: string
  headerBorderClass: string
  subtitleColor: string
  subtitleClass: string
  logoGradient: string
  logoBg: string
  pillText: string
  pillBorder: string
  pillTextClass: string
  pillBorderClass: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  badgeBgClass: string
  bottomGradient: string
  bottomGradientClass: string
}> = {
  blue: {
    headerBg: '#1e3a8a',
    headerGradient: 'linear-gradient(135deg, #172554 0%, #1e40af 100%)',
    headerBorder: '#60a5fa',
    headerBorderClass: 'border-blue-400',
    subtitleColor: '#bfdbfe',
    subtitleClass: 'text-blue-200',
    logoGradient: 'from-blue-600 to-blue-800 border-blue-400/60',
    logoBg: '#2563eb',
    pillText: '#dbeafe',
    pillBorder: '#60a5fa',
    pillTextClass: 'text-blue-100',
    pillBorderClass: 'border-blue-400/80',
    badgeBg: '#eff6ff',
    badgeText: '#1e3a8a',
    badgeBorder: '#bfdbfe',
    badgeBgClass: 'bg-blue-50 text-blue-900 border-blue-200/80',
    bottomGradient: 'linear-gradient(to right, #172554, #1e40af, #38bdf8)',
    bottomGradientClass: 'from-blue-950 via-blue-800 to-sky-400',
  },
  purple: {
    headerBg: '#581c87',
    headerGradient: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 100%)',
    headerBorder: '#c084fc',
    headerBorderClass: 'border-purple-400',
    subtitleColor: '#e9d5ff',
    subtitleClass: 'text-purple-200',
    logoGradient: 'from-purple-600 to-purple-800 border-purple-400/60',
    logoBg: '#7c3aed',
    pillText: '#f3e8ff',
    pillBorder: '#c084fc',
    pillTextClass: 'text-purple-100',
    pillBorderClass: 'border-purple-400/80',
    badgeBg: '#faf5ff',
    badgeText: '#581c87',
    badgeBorder: '#e9d5ff',
    badgeBgClass: 'bg-purple-50 text-purple-900 border-purple-200/80',
    bottomGradient: 'linear-gradient(to right, #3b0764, #7c3aed, #c084fc)',
    bottomGradientClass: 'from-purple-950 via-purple-800 to-purple-400',
  },
  rose: {
    headerBg: '#881337',
    headerGradient: 'linear-gradient(135deg, #4c0519 0%, #9f1239 100%)',
    headerBorder: '#fb7185',
    headerBorderClass: 'border-rose-400',
    subtitleColor: '#fecdd3',
    subtitleClass: 'text-rose-200',
    logoGradient: 'from-rose-500 to-rose-700 border-rose-400/60',
    logoBg: '#e11d48',
    pillText: '#ffe4e6',
    pillBorder: '#fb7185',
    pillTextClass: 'text-rose-100',
    pillBorderClass: 'border-rose-400/80',
    badgeBg: '#ffe4e6',
    badgeText: '#881337',
    badgeBorder: '#fecdd3',
    badgeBgClass: 'bg-rose-50 text-rose-900 border-rose-200/80',
    bottomGradient: 'linear-gradient(to right, #4c0519, #be123c, #fb7185)',
    bottomGradientClass: 'from-rose-950 via-rose-800 to-rose-400',
  },
}

/**
 * Standard CR80 Faculty & Staff Identity Badge.
 * Supports single-sided (front only) or dual-sided (foldable front + back).
 * Follows CodeClove typography standards, adaptive text scaling, and physical badge tolerances.
 */
export function StaffIdCard({
  staff,
  school,
  sessionLabel = 'Current Session',
  formatDate,
  dual = true,
  colorScheme = 'blue',
}: StaffIdCardProps) {
  const theme = COLOR_THEMES[colorScheme] || COLOR_THEMES.blue
  const schoolName = school?.name || 'School Name'
  const fullName = [staff.first_name, staff.middle_name, staff.last_name].filter(Boolean).join(' ')
  const designation = staff.designation || staff.role_name || __( 'STAFF', 'codeclove-school-management' )
  const pillLabel = designation.toUpperCase()
  const pillFontSize = pillLabel.length > 22 ? '6px' : pillLabel.length > 15 ? '6.5px' : '7px'
  const cleanSessionLabel = (sessionLabel || '').replace(/\s*academic\s*year\s*/gi, '').trim() || 'Current Session'
  const department = staff.department || 'Academic Faculty'
  const joinedDate = staff.joined_on && formatDate ? formatDate(staff.joined_on) : staff.joined_on || '—'
  const location = [staff.city, staff.state].filter(Boolean).join(', ') || '—'
  // Adaptive typography
  const nameLen = fullName.length
  const nameFontSize = nameLen <= 18 ? '15px' : nameLen <= 26 ? '13px' : '11.5px'
  const schoolLen = schoolName.length
  const schoolFontSize = schoolLen <= 24 ? '11px' : schoolLen <= 36 ? '9.5px' : '8.5px'

  const renderHeader = (subtitle: string) => (
    <div
      className={`text-white px-3 text-center border-b-2 ${theme.headerBorderClass} shrink-0 relative flex flex-col justify-between items-center`}
      style={{ background: theme.headerGradient, backgroundColor: theme.headerBg, color: '#ffffff', borderBottom: `2px solid ${theme.headerBorder}`, minHeight: '58px', height: '58px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '5px 12px 6px', boxSizing: 'border-box' }}
    >
      {/* Lanyard punch slot guide */}
      <div
        className="w-7 h-1 rounded-full border border-dashed border-white/25 mx-auto shrink-0"
        style={{ width: '28px', height: '3.5px', borderRadius: '9999px', border: '1px dashed rgba(255,255,255,0.25)', margin: '0 auto 2px' }}
        title="Punch slot zone"
      />
      {/* Balanced 3-column header: logo left, text centered, spacer right */}
      <div
        className="grid grid-cols-[28px_1fr_28px] items-center w-full min-w-0"
        style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', alignItems: 'center', width: '100%', minWidth: 0 }}
      >
        <div className="flex items-center justify-center w-[28px] shrink-0" style={{ width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {school?.logo && !school.logo.includes('defaults/logo.svg') ? (
            <div
              className="w-[28px] h-[28px] rounded-full bg-white p-0.5 shadow-2xs border border-white/30 flex items-center justify-center shrink-0"
              style={{ width: '28px', height: '28px', minWidth: '28px', maxWidth: '28px', minHeight: '28px', maxHeight: '28px', backgroundColor: '#ffffff', borderRadius: '9999px', padding: '1.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }}
            >
              <img src={school.logo} alt={schoolName} className="w-full h-full object-contain rounded-full" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '9999px' }} />
            </div>
          ) : (
            <div
              className={`w-[26px] h-[26px] rounded-full bg-gradient-to-br ${theme.logoGradient} shadow-2xs flex items-center justify-center text-2xs font-black text-white shrink-0`}
              style={{ width: '26px', height: '26px', minWidth: '26px', maxWidth: '24px', minHeight: '26px', maxHeight: '26px', borderRadius: '9999px', backgroundColor: theme.logoBg, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
            >
              {schoolName[0] || 'N'}
            </div>
          )}
        </div>
        <div className="text-center min-w-0 px-1 flex items-center justify-center">
          <span
            className="font-bold tracking-tight uppercase !text-white leading-tight line-clamp-2 block text-center"
            style={{ fontSize: schoolFontSize, lineHeight: '1.18', fontWeight: 700, color: '#ffffff', textAlign: 'center' }}
          >
            {schoolName}
          </span>
        </div>
        <div className="w-[28px] shrink-0" style={{ width: '28px' }} aria-hidden="true" />
      </div>
      <p
        className={`text-[7px] uppercase tracking-[0.15em] ${theme.subtitleClass} font-semibold text-center leading-none`}
        style={{ fontSize: '7px', lineHeight: '1', fontWeight: 600, color: theme.subtitleColor, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0, padding: 0, textAlign: 'center' }}
      >
        {subtitle}
      </p>
    </div>
  )

  const watermarkNode = school?.logo && !school.logo.includes('defaults/logo.svg') ? (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none z-0"
      style={{ position: 'absolute', top: '58px', left: 0, right: 0, bottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      <img
        src={school.logo}
        alt=""
        className="w-36 h-36 object-contain select-none"
        style={{ width: '136px', height: '136px', maxWidth: '136px', maxHeight: '136px', objectFit: 'contain', opacity: 0.08, filter: 'grayscale(100%)', pointerEvents: 'none', userSelect: 'none' }}
      />
    </div>
  ) : null
  return (
    <div
      className="id-card-print-container flex flex-row items-center justify-center gap-6 sm:gap-8 print:gap-1 print:my-0 flex-wrap sm:flex-nowrap"
      style={{ lineHeight: 1.25 }}
    >
      <style>{`
        @page {
          size: A4 portrait;
          margin: 15mm;
        }
        .id-card-print-container {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          line-height: 1.25 !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .id-card-print-container * {
          box-sizing: border-box !important;
        }
        .id-card-print-container p {
          margin: 0 !important;
          padding: 0 !important;
        }
        .id-card-print-container h1,
        .id-card-print-container h2,
        .id-card-print-container h3 {
          margin: 0 !important;
          padding: 0 !important;
          font-size: inherit;
        }
        .id-card-print-container img {
          max-width: none;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .id-card-print-container {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            margin: 30mm auto 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* ─── FRONT SIDE ───────────────────────────────────────────────────────────── */}
      <div
        className="w-[240px] h-[385px] bg-white rounded-xl print:rounded-lg border border-slate-300 print:border-gray-400 overflow-hidden flex flex-col justify-between shadow-sm print:shadow-none text-slate-800 shrink-0 relative"
        style={{ position: 'relative', width: '240px', height: '385px', minWidth: '240px', maxWidth: '240px', minHeight: '385px', maxHeight: '385px', backgroundColor: '#ffffff', color: '#1e293b', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}
      >
        {/* School Header */}
        {renderHeader(__( 'Faculty & Staff Identity Card', 'codeclove-school-management' ))}

        {/* Institutional Security Watermark */}
        {watermarkNode}

        {/* Body Container */}
        <div
          className="flex-1 flex flex-col items-center justify-between py-2 px-3 relative z-10"
          style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', boxSizing: 'border-box', zIndex: 10 }}
        >

          {/* Primary Identity Group */}
          <div className="flex flex-col items-center w-full space-y-1.5 z-10">
            {/* Photo with Role Badge overlap */}
            <div
              className="relative flex flex-col items-center"
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div
                className="w-[84px] h-[98px] rounded-lg border border-slate-300/80 ring-2 ring-slate-100 overflow-hidden bg-slate-100 flex items-center justify-center shadow-xs shrink-0"
                style={{ width: '84px', height: '98px', minWidth: '84px', minHeight: '98px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                {staff.photo_url && !staff.photo_url.endsWith('avatar.svg') ? (
                  <img src={staff.photo_url} alt={fullName} className="w-full h-full object-cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 text-slate-400" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <User className="w-9 h-9 text-slate-400" style={{ width: '36px', height: '36px' }} />
                  </div>
                )}
              </div>
              {/* Designation Ribbon */}
              <span
                className={`absolute -bottom-2 ${theme.pillTextClass} font-black uppercase tracking-wider rounded-full border ${theme.pillBorderClass} shadow-xs max-w-[155px] truncate ring-1 ring-blue-500/30`}
                style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: pillFontSize, fontWeight: 900, letterSpacing: '0.1em', background: theme.headerGradient, color: theme.pillText, padding: '1.5px 10px', borderRadius: '9999px', border: `1px solid ${theme.pillBorder}`, maxWidth: '155px', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
                title={designation}
              >
                {pillLabel}
              </span>
            </div>
            {/* Name, ID & Session Badge */}
            <div className="text-center w-full px-1 pt-1.5">
              <h2
                className="font-extrabold text-slate-900 leading-tight line-clamp-2"
                style={{
                  fontSize: nameFontSize,
                  lineHeight: '1.2',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: 0,
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {fullName}
              </h2>
              <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="font-mono text-[8px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200/90 shadow-2xs"
                  style={{ fontSize: '8px', lineHeight: '1.2', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, backgroundColor: '#f1f5f9', color: '#334155', padding: '1.5px 8px', borderRadius: '9999px', border: '1px solid #e2e8f0' }}
                >
                  ID: {staff.staff_number}
                </span>
                {cleanSessionLabel && (
                  <span
                    className={`text-[7.5px] font-bold ${theme.badgeBgClass} px-2.5 py-0.5 rounded-full shadow-2xs`}
                    style={{ fontSize: '7.5px', lineHeight: '1.2', fontWeight: 700, backgroundColor: theme.badgeBg, color: theme.badgeText, padding: '1.5px 7px', borderRadius: '9999px', border: `1px solid ${theme.badgeBorder}` }}
                  >
                    {cleanSessionLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3-Row Credential Matrix */}
          <div
            className="w-full bg-slate-50/95 border border-slate-200/90 rounded-lg px-2.5 py-1.5 text-[8.5px] space-y-1 z-10 shadow-2xs"
            style={{ width: '100%', fontSize: '8.5px', lineHeight: 1.25, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px' }}
          >
            <div className="flex justify-between items-center border-b border-slate-200/70 pb-0.5" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Department', 'codeclove-school-management' )}</span>
              <span className="font-bold text-slate-900 truncate max-w-[130px]" style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f172a', maxWidth: '130px' }}>{department}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/70 pb-0.5" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Role', 'codeclove-school-management' )}</span>
              <span className="font-bold text-slate-900 truncate max-w-[130px]" style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f172a', maxWidth: '130px' }}>{staff.role_name || __( 'Faculty & Staff', 'codeclove-school-management' )}</span>
            </div>
            <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Joined Date', 'codeclove-school-management' )}</span>
              <span className="font-bold text-slate-900" style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f172a' }}>{joinedDate}</span>
            </div>
          </div>

          {/* Bottom Verification & Signature Bar */}
          <div className="w-full flex items-center justify-between px-1 pt-1 z-10 border-t border-slate-100" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0', borderTop: '1px solid #f1f5f9' }}>
            <div className="flex flex-col text-left leading-none" style={{ lineHeight: 1 }}>
              <span className="text-[5.5px] uppercase font-bold text-slate-400 tracking-wider" style={{ fontSize: '5.5px', lineHeight: '1.1', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Employee ID', 'codeclove-school-management' )}</span>
              <span className="font-mono text-[7.5px] font-bold text-slate-700 mt-0.5" style={{ fontSize: '7.5px', lineHeight: '1.1', fontWeight: 700, color: '#334155' }}>{staff.staff_number}</span>
            </div>

            <div className="flex flex-col items-center justify-end" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div className="w-20 border-b border-slate-400/80 mb-0.5 h-3" style={{ width: '80px', borderBottom: '1px solid #94a3b8', marginBottom: '2px', height: '12px' }} />
              <span className="text-[6px] font-bold uppercase tracking-wider text-slate-500" style={{ fontSize: '6px', lineHeight: '1.1', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Cardholder Signature', 'codeclove-school-management' )}</span>
            </div>
          </div>
        </div>

        <div className={`h-1 bg-gradient-to-r ${theme.bottomGradientClass} shrink-0`} style={{ height: '4px', background: theme.bottomGradient }} />
      </div>

      {/* ─── FOLD DIVIDER (when dual-sided) ───────────────────────────────────────── */}
      {dual && (
        <div
          className="hidden sm:flex print:flex flex-col items-center justify-center text-[7px] text-gray-400 font-mono select-none px-0.5"
          style={{ height: '385px', minHeight: '385px', maxHeight: '385px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="flex-1 border-l border-dashed border-gray-400 my-1" style={{ flex: 1, borderLeft: '1px dashed #9ca3af', margin: '4px 0' }} />
          <span
            className="rotate-90 whitespace-nowrap inline-block font-bold tracking-wider"
            style={{ fontSize: '7px', fontFamily: "'JetBrains Mono', monospace", color: '#9ca3af', transform: 'rotate(90deg)', display: 'inline-block', whiteSpace: 'nowrap' }}
          >
            ✂ FOLD / CUT
          </span>
          <div className="flex-1 border-l border-dashed border-gray-400 my-1" style={{ flex: 1, borderLeft: '1px dashed #9ca3af', margin: '4px 0' }} />
        </div>
      )}

      {/* ─── BACK SIDE (when dual-sided) ─────────────────────────────────────────── */}
      {dual && (
        <div
          className="w-[240px] h-[385px] bg-white rounded-xl print:rounded-lg border border-slate-300 print:border-gray-400 overflow-hidden flex flex-col justify-between shadow-sm print:shadow-none text-slate-800 shrink-0 relative"
          style={{ position: 'relative', width: '240px', height: '385px', minWidth: '240px', maxWidth: '240px', minHeight: '385px', maxHeight: '385px', backgroundColor: '#ffffff', color: '#1e293b', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}
        >
          {/* School Header */}
          {renderHeader(__( 'Official Employee Record', 'codeclove-school-management' ))}

          {/* Institutional Security Watermark */}
          {watermarkNode}

          {/* Barcode representation */}
          <div className="mx-3 mt-1 p-1 text-center shrink-0" style={{ margin: '4px 12px 0', padding: '4px', textAlign: 'center', border: 'none', boxShadow: 'none' }}>
            <Barcode value={staff.staff_number} height={18} />
          </div>

          {/* Details list */}
          <div
            className="mx-3 bg-slate-50/80 border border-slate-200/80 rounded-lg p-2 text-[8.5px] divide-y divide-slate-200/70 shrink-0 z-10 shadow-2xs"
            style={{ fontSize: '8.5px', lineHeight: 1.25, margin: '2px 12px 0', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '5px 8px', position: 'relative', zIndex: 10 }}
          >
            <div className="flex justify-between pb-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2px' }}>
              <span className="text-slate-400 uppercase text-[7px] font-bold tracking-wider" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Department', 'codeclove-school-management' )}</span>
              <span className="font-bold text-slate-900 truncate max-w-[125px]" style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f172a', maxWidth: '125px' }}>{department}</span>
            </div>
            <div className="flex justify-between py-0.5" style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span className="text-slate-400 uppercase text-[7px] font-bold tracking-wider" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Official Email', 'codeclove-school-management' )}</span>
              <span className="font-bold text-slate-900 truncate max-w-[125px]" style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f172a', maxWidth: '125px' }}>{staff.email}</span>
            </div>
            <div className="flex justify-between py-0.5" style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span className="text-slate-400 uppercase text-[7px] font-bold tracking-wider" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Contact Phone', 'codeclove-school-management' )}</span>
              <span className="font-mono font-bold text-slate-900" style={{ fontSize: '8.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0f172a' }}>{staff.phone || '—'}</span>
            </div>
            <div className="flex justify-between py-0.5" style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span className="text-slate-400 uppercase text-[7px] font-bold tracking-wider" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Campus Location', 'codeclove-school-management' )}</span>
              <span className="font-bold text-slate-700 truncate max-w-[125px]" style={{ fontSize: '8px', fontWeight: 700, color: '#334155', maxWidth: '125px' }}>{location}</span>
            </div>
            {(school?.phone || school?.website || school?.email) && (
              <div className="flex justify-between pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                <span className="text-slate-400 uppercase text-[7px] font-bold tracking-wider" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'School Contact', 'codeclove-school-management' )}</span>
                <span className="font-mono text-[7.5px] font-semibold text-slate-600 truncate max-w-[130px]" style={{ fontSize: '7.5px', fontWeight: 600, color: '#475569', maxWidth: '130px' }}>
                  {school?.phone || school?.email || school?.website}
                </span>
              </div>
            )}
          </div>

          {/* Signatory + Disclaimer */}
          <div className="px-3 pb-1.5 shrink-0 z-10" style={{ padding: '0 12px 6px', position: 'relative', zIndex: 10 }}>
            <p
              className="text-[7.5px] text-slate-600 leading-tight mb-1 text-center font-medium"
              style={{ fontSize: '7.5px', lineHeight: '1.2', color: '#475569', margin: '0 0 4px 0', padding: 0, textAlign: 'center', fontWeight: 500 }}
            >
              Property of {schoolName}. If found, please return to the school administration office.
            </p>
            <div className="flex justify-between items-end pb-0.5 min-h-[22px]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', paddingBottom: '2px', minHeight: '22px' }}>
              <div className="flex flex-col text-left">
                <span className="font-mono text-[8.5px] font-bold text-slate-800 tracking-tight" style={{ fontSize: '8.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0f172a' }}>
                  {joinedDate}
                </span>
              </div>
              <div className="flex flex-col items-center justify-end" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                {school?.signature ? (
                  <img
                    src={school.signature}
                    alt={__( 'Authorized Signature', 'codeclove-school-management' )}
                    className="h-4 max-w-[65px] object-contain mb-0.5"
                    style={{ height: '16px', maxWidth: '65px', objectFit: 'contain', marginBottom: '2px' }}
                  />
                ) : (
                  <svg className="w-16 h-4 text-slate-600 mb-0.5" viewBox="0 0 100 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 18 C18 8, 22 4, 36 14 C48 24, 54 6, 68 15 C78 20, 84 10, 96 14" />
                  </svg>
                )}
              </div>
            </div>
            <div className="border-t border-slate-300 pt-1 flex justify-between items-center text-[6.5px] text-slate-500 font-bold uppercase tracking-wider" style={{ borderTop: '1px solid #cbd5e1', paddingTop: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#64748b' }}>
              <span>{__( 'Date of Issue', 'codeclove-school-management' )}</span>
              <span>{__( 'Authorized Signature', 'codeclove-school-management' )}</span>
            </div>
          </div>

          <div className={`h-1 bg-gradient-to-r ${theme.bottomGradientClass} shrink-0`} style={{ height: '4px', background: theme.bottomGradient }} />
        </div>
      )}
    </div>
  )
}
