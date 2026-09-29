import { User } from 'lucide-react'
import { Barcode, type SchoolSettings } from '@/components/ui'
import { __ } from '@/lib/i18n'

export interface StudentIdCardProps {
  student: {
    id: number
    first_name: string
    middle_name?: string
    last_name?: string
    student_number: string
    admission_number?: string
    date_of_birth?: string
    blood_group?: string
    photo_url?: string
    address?: string
    city?: string
    guardian?: { first_name: string; last_name?: string; phone?: string; email?: string } | null
    father?: { first_name: string; last_name?: string; phone?: string; email?: string } | null
    mother?: { first_name: string; last_name?: string; phone?: string; email?: string } | null
    enrollment?: { roll_number?: string | null; academic_unit_id?: number | null; academic_group_id?: number | null } | null
  }
  unitName?: string
  groupName?: string
  unitLabel?: string
  groupLabel?: string
  rollNumber?: string
  school?: SchoolSettings
  sessionLabel?: string
  formatDate?: (dateStr: string) => string
  dual?: boolean
}

/**
 * Standard CR80 School Identity Badge (85.6mm x 54mm equivalent ratio).
 * Supports single-sided (front only) or dual-sided (foldable front + back).
 * Follows CodeClove typography standards, adaptive text scaling, and physical badge tolerances.
 */
export function StudentIdCard({
  student,
  unitName,
  groupName,
  unitLabel = 'Class',
  groupLabel = 'Section',
  rollNumber,
  school,
  sessionLabel = 'Current Session',
  formatDate,
  dual = true,
}: StudentIdCardProps) {
  const schoolName = school?.name || 'School Name'
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
  const cleanSessionLabel = (sessionLabel || '').replace(/\s*academic\s*year\s*/gi, '').trim() || 'Current Session'
  const resolvedRoll = rollNumber || student.enrollment?.roll_number || '—'
  const guardian = student.guardian || student.father || student.mother
  const guardianName = guardian ? [guardian.first_name, guardian.last_name].filter(Boolean).join(' ') : '—'
  const emergencyPhone = guardian?.phone || school?.phone || '—'
  const address = [student.address, student.city].filter(Boolean).join(', ') || '—'

  // Adaptive font sizing for student name per CodeClove design memory
  const nameLen = fullName.length
  const nameFontSize = nameLen <= 18 ? '15px' : nameLen <= 26 ? '13px' : '11.5px'

  // Adaptive school name size
  const schoolLen = schoolName.length
  const schoolFontSize = schoolLen <= 24 ? '11px' : schoolLen <= 36 ? '9.5px' : '8.5px'

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
        .id-card-print-container,
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
            margin: 25mm auto 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* ─── FRONT SIDE ───────────────────────────────────────────────────────────── */}
      <div
        className="w-[240px] h-[385px] bg-white rounded-xl print:rounded-lg border border-slate-300 print:border-gray-400 overflow-hidden flex flex-col justify-between shadow-sm print:shadow-none text-slate-800 shrink-0 relative"
        style={{ width: '240px', height: '385px', minWidth: '240px', maxWidth: '240px', minHeight: '385px', maxHeight: '385px', backgroundColor: '#ffffff', color: '#1e293b', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}
      >
        {/* School Header */}
        <div
          className="bg-slate-900 text-white px-3 pt-2 pb-1.5 text-center border-b-2 border-amber-400 shrink-0 relative"
          style={{ backgroundColor: '#0f172a', color: '#ffffff', borderBottom: '2px solid #fbbf24', minHeight: '58px', height: '58px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '6px 12px', boxSizing: 'border-box' }}
        >
          {/* Lanyard punch slot guide */}
          <div
            className="w-7 h-1 rounded-full border border-dashed border-white/30 mx-auto mb-1 shrink-0"
            style={{ width: '28px', height: '4px', borderRadius: '9999px', border: '1px dashed rgba(255,255,255,0.3)', margin: '0 auto 4px' }}
            title="Punch slot zone"
          />
          <div
            className="grid grid-cols-[30px_1fr_30px] items-center w-full min-w-0"
            style={{ display: 'grid', gridTemplateColumns: '30px 1fr 30px', alignItems: 'center', width: '100%', minWidth: 0 }}
          >
            <div className="flex items-center justify-start" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              {school?.logo && !school.logo.includes('defaults/logo.svg') ? (
                <div
                  className="w-[30px] h-[30px] flex items-center justify-center shrink-0"
                  style={{ width: '30px', height: '30px', minWidth: '30px', maxWidth: '30px', minHeight: '30px', maxHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img
                    src={school.logo}
                    alt={schoolName}
                    className="w-full h-full object-contain"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/60 shadow-2xs flex items-center justify-center text-2xs font-black text-slate-950 shrink-0"
                  style={{ width: '24px', height: '24px', minWidth: '24px', maxWidth: '24px', minHeight: '24px', maxHeight: '24px', borderRadius: '9999px', backgroundColor: '#f59e0b', color: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
                >
                  {schoolName[0] || 'N'}
                </div>
              )}
            </div>
            <div className="text-center min-w-0 px-1" style={{ textAlign: 'center', minWidth: 0, padding: '0 4px' }}>
              <span
                className="font-bold tracking-tight uppercase !text-white leading-tight line-clamp-2 block text-center"
                style={{ fontSize: schoolFontSize, lineHeight: '1.2', fontWeight: 700, color: '#ffffff', textAlign: 'center' }}
              >
                {schoolName}
              </span>
            </div>
            <div className="w-[30px]" style={{ width: '30px' }} aria-hidden="true" />
          </div>
          <p
            className="text-[8px] uppercase tracking-widest text-amber-300 font-semibold mt-0.5 text-center"
            style={{ fontSize: '8px', lineHeight: '1', fontWeight: 600, color: '#fcd34d', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '2px 0 0 0', padding: 0, textAlign: 'center' }}
          >
            {__( 'Student Identity Card', 'codeclove-school-management' )}
          </p>
        </div>

        {/* Body Container */}
        <div
          className="flex-1 flex flex-col items-center justify-between py-2 px-3 relative"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', boxSizing: 'border-box' }}
        >
          {/* Institutional Security Watermark */}
          {school?.logo && !school.logo.includes('defaults/logo.svg') && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none z-0"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none', zIndex: 0 }}
              aria-hidden="true"
            >
              <img
                src={school.logo}
                alt=""
                className="w-32 h-32 object-contain select-none"
                style={{ width: '128px', height: '128px', maxWidth: '128px', maxHeight: '128px', objectFit: 'contain', opacity: 0.045, filter: 'grayscale(100%)', pointerEvents: 'none', userSelect: 'none' }}
              />
            </div>
          )}

          {/* Primary Identity Group */}
          <div className="flex flex-col items-center w-full space-y-1.5 z-10">
            {/* Photo with Role Badge overlap */}
            <div
              className="relative flex flex-col items-center"
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div
                className="w-[82px] h-[98px] rounded-lg border-2 border-slate-200/90 overflow-hidden bg-slate-100 flex items-center justify-center shadow-xs shrink-0"
                style={{ width: '82px', height: '98px', minWidth: '82px', minHeight: '98px', backgroundColor: '#f1f5f9', border: '2px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {student.photo_url && !student.photo_url.endsWith('avatar.svg') ? (
                  <img src={student.photo_url} alt={fullName} className="w-full h-full object-cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 text-slate-400" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <User className="w-9 h-9 text-slate-400" style={{ width: '36px', height: '36px' }} />
                  </div>
                )}
              </div>
              {/* Executive Role Ribbon */}
              <span
                className="absolute -bottom-2 bg-slate-900 text-amber-300 font-extrabold uppercase tracking-widest text-[7px] px-2 py-0.5 rounded-full border border-amber-400/80 shadow-2xs"
                style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: '7px', fontWeight: 800, letterSpacing: '0.12em', backgroundColor: '#0f172a', color: '#fcd34d', borderColor: '#fbbf24', padding: '1px 8px', borderRadius: '9999px', border: '1px solid #fbbf24', zIndex: 20 }}
              >
                {__( 'STUDENT', 'codeclove-school-management' )}
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
              <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
                <span
                  className="font-mono text-[8.5px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200/90"
                  style={{ fontSize: '8.5px', lineHeight: '1.2', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, backgroundColor: '#f1f5f9', color: '#334155', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  ID: {student.student_number}
                </span>
                {cleanSessionLabel && (
                  <span
                    className="text-[7.5px] font-bold bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200/80"
                    style={{ fontSize: '7.5px', lineHeight: '1.2', fontWeight: 700, backgroundColor: '#fef3c7', color: '#78350f', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a' }}
                  >
                    {cleanSessionLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4-Row Credential Matrix */}
          <div
            className="w-full bg-slate-50/95 border border-slate-200/90 rounded-lg px-2.5 py-1.5 text-[8.5px] space-y-1 z-10 shadow-2xs"
            style={{ width: '100%', fontSize: '8.5px', lineHeight: 1.25, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '5px 8px' }}
          >
            <div className="flex justify-between items-center border-b border-slate-200/70 pb-0.5" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Admission No', 'codeclove-school-management' )}</span>
              <span className="font-mono font-bold text-slate-900" style={{ fontSize: '8.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0f172a' }}>
                {student.admission_number || student.student_number}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/70 pb-0.5" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>
                {unitLabel} & {groupLabel}
              </span>
              <span className="font-bold text-slate-900 truncate max-w-[130px]" style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f172a', maxWidth: '130px' }}>
                {[unitName, groupName].filter(Boolean).join(' — ') || '—'}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/70 pb-0.5" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>
                {student.blood_group ? __( 'Roll & Blood', 'codeclove-school-management' ) : __( 'Roll Number', 'codeclove-school-management' )}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900" style={{ fontSize: '8.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0f172a' }}>{resolvedRoll}</span>
                {student.blood_group && (
                  <span
                    className="font-bold text-red-700 bg-red-50 border border-red-200/90 rounded px-1 text-[7px]"
                    style={{ fontSize: '7px', fontWeight: 700, color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '0 4px', borderRadius: '3px' }}
                  >
                    {student.blood_group}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400" style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Date of Birth', 'codeclove-school-management' )}</span>
              <span className="font-bold text-slate-900" style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f172a' }}>
                {student.date_of_birth && formatDate ? formatDate(student.date_of_birth) : student.date_of_birth || '—'}
              </span>
            </div>
          </div>

          {/* Bottom Verification & Signature Bar */}
          <div className="w-full flex items-center justify-between px-1 pt-1 z-10 border-t border-slate-100" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0', borderTop: '1px solid #f1f5f9' }}>
            <div className="flex flex-col text-left leading-none" style={{ lineHeight: 1 }}>
              <span className="text-[5.5px] uppercase font-bold text-slate-400 tracking-wider" style={{ fontSize: '5.5px', lineHeight: '1.1', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>{__( 'Official Badge', 'codeclove-school-management' )}</span>
              <span className="font-mono text-[7.5px] font-bold text-slate-700 mt-0.5" style={{ fontSize: '7.5px', lineHeight: '1.1', fontWeight: 700, color: '#334155' }}>{student.student_number}</span>
            </div>

            <div className="flex flex-col items-center justify-end" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div className="w-20 border-b border-slate-400/80 mb-0.5 h-3" style={{ width: '80px', borderBottom: '1px solid #94a3b8', marginBottom: '2px', height: '12px' }} />
              <span className="text-[6px] font-bold uppercase tracking-wider text-slate-500" style={{ fontSize: '6px', lineHeight: '1.1', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Student Signature', 'codeclove-school-management' )}</span>
            </div>
          </div>
        </div>
        {/* Bottom Accent */}
        <div
          className="h-1 bg-gradient-to-r from-slate-900 via-blue-900 to-amber-400 shrink-0"
          style={{ height: '4px', background: 'linear-gradient(to right, #0f172a, #1e3a8a, #fbbf24)' }}
        />
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
          style={{ width: '240px', height: '385px', minWidth: '240px', maxWidth: '240px', minHeight: '385px', maxHeight: '385px', backgroundColor: '#ffffff', color: '#1e293b', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}
        >
          {/* School Header (consistent 3-column grid) */}
          <div
            className="bg-slate-900 text-white px-3 pt-2 pb-1.5 text-center border-b-2 border-amber-400 shrink-0 relative"
            style={{ backgroundColor: '#0f172a', color: '#ffffff', borderBottom: '2px solid #fbbf24', minHeight: '58px', height: '58px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '6px 12px', boxSizing: 'border-box' }}
          >
            {/* Lanyard punch slot guide */}
            <div
              className="w-7 h-1 rounded-full border border-dashed border-white/30 mx-auto mb-1 shrink-0"
              style={{ width: '28px', height: '4px', borderRadius: '9999px', border: '1px dashed rgba(255,255,255,0.3)', margin: '0 auto 4px' }}
              title="Punch slot zone"
            />

            <div
              className="grid grid-cols-[30px_1fr_30px] items-center w-full min-w-0"
              style={{ display: 'grid', gridTemplateColumns: '30px 1fr 30px', alignItems: 'center', width: '100%', minWidth: 0 }}
            >
              <div className="flex items-center justify-start" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                {school?.logo && !school.logo.includes('defaults/logo.svg') ? (
                  <div
                    className="w-[30px] h-[30px] flex items-center justify-center shrink-0"
                    style={{ width: '30px', height: '30px', minWidth: '30px', maxWidth: '30px', minHeight: '30px', maxHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <img
                      src={school.logo}
                      alt={schoolName}
                      className="w-full h-full object-contain"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/60 shadow-2xs flex items-center justify-center text-2xs font-black text-slate-950 shrink-0"
                    style={{ width: '24px', height: '24px', minWidth: '24px', maxWidth: '24px', minHeight: '24px', maxHeight: '24px', borderRadius: '9999px', backgroundColor: '#f59e0b', color: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
                  >
                    {schoolName[0] || 'N'}
                  </div>
                )}
              </div>
              <div className="text-center min-w-0 px-1" style={{ textAlign: 'center', minWidth: 0, padding: '0 4px' }}>
                <span
                  className="font-bold tracking-tight uppercase !text-white leading-tight line-clamp-2 block text-center"
                  style={{ fontSize: schoolFontSize, lineHeight: '1.2', fontWeight: 700, color: '#ffffff', textAlign: 'center' }}
                >
                  {schoolName}
                </span>
              </div>
              <div className="w-[30px]" style={{ width: '30px' }} aria-hidden="true" />
            </div>
            <p
              className="text-[8px] uppercase tracking-widest text-slate-300 font-semibold mt-0.5 text-center"
              style={{ fontSize: '8px', lineHeight: '1', fontWeight: 600, color: '#cbd5e1', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '2px 0 0 0', padding: 0, textAlign: 'center' }}
            >
            {__( 'Official Student Record', 'codeclove-school-management' )}
            </p>
          </div>
          {/* Institutional Security Watermark */}
          {school?.logo && !school.logo.includes('defaults/logo.svg') && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none z-0"
              style={{ position: 'absolute', top: '58px', left: 0, right: 0, bottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none', zIndex: 0 }}
              aria-hidden="true"
            >
              <img
                src={school.logo}
                alt=""
                className="w-32 h-32 object-contain select-none"
                style={{ width: '128px', height: '128px', maxWidth: '128px', maxHeight: '128px', objectFit: 'contain', opacity: 0.045, filter: 'grayscale(100%)', pointerEvents: 'none', userSelect: 'none' }}
              />
            </div>
          )}

          {/* Barcode representation */}
          <div className="mx-3 mt-1.5 p-1 text-center shrink-0" style={{ margin: '6px 12px 0', padding: '4px', textAlign: 'center', border: 'none', boxShadow: 'none' }}>
            <Barcode value={student.student_number} height={18} />
          </div>
          <div
            className="mx-3 text-[8.5px] space-y-0.5 divide-y divide-slate-100 shrink-0"
            style={{ fontSize: '8.5px', lineHeight: 1.25, margin: '0 12px' }}
          >
            <div className="flex justify-between pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
              <span className="text-slate-500 uppercase text-[7px] font-bold" style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Admission No', 'codeclove-school-management' )}</span>
              <span className="font-mono font-semibold text-slate-900" style={{ fontSize: '8.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#0f172a' }}>{student.admission_number || student.student_number}</span>
            </div>
            <div className="flex justify-between pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
              <span className="text-slate-500 uppercase text-[7px] font-bold" style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Valid Session', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-slate-900" style={{ fontSize: '8.5px', fontWeight: 600, color: '#0f172a' }}>{cleanSessionLabel}</span>
            </div>
            <div className="flex justify-between pt-0.5 items-center" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px', alignItems: 'center' }}>
              <span className="text-slate-500 uppercase text-[7px] font-bold" style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Blood Group', 'codeclove-school-management' )}</span>
              {student.blood_group ? (
                <span className="font-bold text-red-700 bg-red-50 border border-red-200/90 rounded px-1 text-[8px]" style={{ fontSize: '8px', fontWeight: 700, color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '0 4px', borderRadius: '3px' }}>
                  {student.blood_group}
                </span>
              ) : (
                <span className="text-slate-400 text-[8px]" style={{ fontSize: '8px', color: '#94a3b8' }}>{__( 'Not Recorded', 'codeclove-school-management' )}</span>
              )}
            </div>
            <div className="flex justify-between pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
              <span className="text-slate-500 uppercase text-[7px] font-bold" style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Guardian', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-slate-900 truncate max-w-[125px]" style={{ fontSize: '8.5px', fontWeight: 600, color: '#0f172a', maxWidth: '125px' }}>{guardianName}</span>
            </div>
            <div className="flex justify-between pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
              <span className="text-slate-500 uppercase text-[7px] font-bold" style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Emergency Contact', 'codeclove-school-management' )}</span>
              <span className="font-mono font-semibold text-slate-900" style={{ fontSize: '8.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#0f172a' }}>{emergencyPhone}</span>
            </div>
            <div className="flex justify-between pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
              <span className="text-slate-500 uppercase text-[7px] font-bold" style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'Address', 'codeclove-school-management' )}</span>
              <span
                className="text-slate-700 max-w-[130px] text-right line-clamp-2"
                style={{ fontSize: '8px', color: '#334155', maxWidth: '130px', textAlign: 'right', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                title={address}
              >
                {address}
              </span>
            </div>
            {(school?.phone || school?.website) && (
              <div className="flex justify-between pt-0.5" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                <span className="text-slate-500 uppercase text-[7px] font-bold" style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{__( 'School Contact', 'codeclove-school-management' )}</span>
                <span className="font-mono text-[7.5px] text-slate-600 truncate max-w-[130px]" style={{ fontSize: '7.5px', color: '#475569', maxWidth: '130px' }}>
                  {school?.phone || school?.website}
                </span>
              </div>
            )}
          </div>

          <div className="px-3 pb-1.5 shrink-0" style={{ padding: '0 12px 6px' }}>
            <p
              className="text-[7.5px] text-slate-600 leading-tight mb-1 text-center font-medium"
              style={{ fontSize: '7.5px', lineHeight: '1.2', color: '#475569', margin: '0 0 4px 0', padding: 0, textAlign: 'center', fontWeight: 500 }}
            >
              Property of {schoolName}. If found, please return to the school administration office.
            </p>
            <div className="flex justify-between items-end pb-0.5 min-h-[22px]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '2px', minHeight: '22px' }}>
              <div className="flex flex-col text-left">
                <span className="font-mono text-[8px] text-slate-900 font-bold tracking-tight" style={{ fontSize: '8px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0f172a' }}>
                  {student.student_number}
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
            <div className="border-t border-slate-600 pt-0.5 flex justify-between items-center text-[7px] text-slate-600 font-semibold uppercase" style={{ borderTop: '1px solid #475569', paddingTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7px', fontWeight: 600, textTransform: 'uppercase', color: '#475569' }}>
              <span style={{ fontSize: '7px', fontWeight: 600, textTransform: 'uppercase', color: '#475569' }}>{__( 'Student ID', 'codeclove-school-management' )}</span>
              <span style={{ fontSize: '7px', fontWeight: 600, textTransform: 'uppercase', color: '#475569' }}>{__( 'Authorized Signature', 'codeclove-school-management' )}</span>
            </div>
          </div>
          <div
            className="h-1 bg-gradient-to-r from-slate-900 via-blue-900 to-amber-400 shrink-0"
            style={{ height: '4px', background: 'linear-gradient(to right, #0f172a, #1e3a8a, #fbbf24)' }}
          />
        </div>
      )}
    </div>
  )
}
