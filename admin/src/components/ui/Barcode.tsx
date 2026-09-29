const CODE39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
  '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010',
}

export interface BarcodeProps {
  value: string
  height?: number
  className?: string
  showAsterisks?: boolean
}

/**
 * Dependency-free SVG Code 39 barcode renderer.
 * Vector-crisp across screen and print.
 */
export function Barcode({ value, height = 18, className = '', showAsterisks = false }: BarcodeProps) {
  const raw = `*${(value || 'ID').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '')}*`
  const narrow = 1
  const wide = 2.2
  const bars: { x: number; w: number }[] = []
  let x = 0

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] ?? '*'
    const pat = CODE39[ch] || CODE39['*'] || '010010100'
    for (let b = 0; b < pat.length; b++) {
      const w = pat[b] === '1' ? wide : narrow
      if (b % 2 === 0) bars.push({ x, w })
      x += w
    }
    x += narrow
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox={`0 0 ${x} ${height}`} className="w-full h-5 max-w-[170px]" preserveAspectRatio="none">
        {bars.map((bar, idx) => (
          <rect key={idx} x={bar.x} y={0} width={bar.w} height={height} fill="#0f172a" />
        ))}
      </svg>
      <span className="font-mono text-[8.5px] print:text-[7.5px] font-bold tracking-widest text-slate-700 mt-0.5">
        {showAsterisks ? `*${value}*` : value}
      </span>
    </div>
  )
}
