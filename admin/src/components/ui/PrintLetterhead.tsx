import React from 'react'

export interface SchoolSettings {
  name?: string
  logo?: string
  address?: string
  email?: string
  phone?: string
  website?: string
  signature?: string
  code?: string
}

export interface PrintLetterheadMetaRow {
  label: string
  value: string
}

export interface PrintLetterheadProps {
  school?: SchoolSettings
  documentType: string
  documentNumber?: string
  metaRows?: PrintLetterheadMetaRow[]
  className?: string
  style?: React.CSSProperties
  compact?: boolean
  showCode?: boolean
}

/**
 * Standardized institutional print letterhead component.
 * Used across Invoices, Receipts, Timetables, and Substitution Registers.
 * ponytail: clean Tailwind layout instead of 120 lines of manual inline style objects.
 */
export function PrintLetterhead({
  school,
  documentType,
  documentNumber,
  metaRows = [],
  className = '',
  style = {},
  compact = false,
  showCode = true,
}: PrintLetterheadProps) {
  const schoolName = school?.name || 'School Name'
  const logoSize = compact ? 'h-10 w-10' : 'h-14 w-14'
  return (
    <div
      className={`border-b-2 border-gray-200 ${compact ? 'pb-2 mb-3' : 'pb-4 mb-5'} text-gray-900 ${className}`}
      style={style}
    >
      <div className="flex items-start justify-between gap-6">
        {/* School identity (Left) */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          {school?.logo ? (
            <img
              src={school.logo}
              alt={schoolName}
              className={`${logoSize} object-contain rounded-md mt-0.5 shrink-0`}
            />
          ) : (
            <div className={`${logoSize} rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center mt-0.5 shrink-0`}>
              <span className={`text-gray-800 font-extrabold ${compact ? 'text-lg' : 'text-xl'}`}>
                {schoolName[0]?.toUpperCase() || 'S'}
              </span>
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`${compact ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-gray-900 tracking-tight leading-tight m-0`}>
                {schoolName}
              </h1>
              {showCode && school?.code && (
                <span className="text-3xs font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                  {school.code}
                </span>
              )}
            </div>
            {school?.address && (
              <p className={`mt-0.5 ${compact ? 'text-2xs' : 'text-xs'} text-gray-600 leading-normal max-w-md`}>
                {school.address}
              </p>
            )}
            {(school?.phone || school?.email) && (
              <div className={`mt-0.5 flex items-center gap-2 ${compact ? 'text-2xs' : 'text-xs'} text-gray-500 leading-normal flex-wrap`}>
                {school?.phone && <span>{school.phone}</span>}
                {school?.phone && school?.email && <span className="text-gray-300" aria-hidden="true">•</span>}
                {school?.email && <span>{school.email}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Document identity (Right) */}
        <div className="text-right shrink-0 flex flex-col items-end">
          <p className="text-2xs font-bold uppercase tracking-wider text-gray-500 m-0">
            {documentType}
          </p>
          {documentNumber && (
            <p className={`${compact ? 'text-sm' : 'text-base'} font-bold text-gray-900 tracking-tight font-mono my-0.5`}>
              #{documentNumber.replace(/^#/, '')}
            </p>
          )}

          {metaRows.length > 0 && (
            <div className="flex flex-col gap-0.5 text-2xs text-gray-500 mt-0.5">
              {metaRows.map((row) => (
                <div key={row.label} className="flex justify-end items-center gap-1.5">
                  <span>{row.label}:</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
