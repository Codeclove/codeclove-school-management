/**
 * Dependency-free, pure TypeScript QR Code matrix generator (ISO/IEC 18004).
 * Supports Versions 1 through 10 with Byte mode encoding and Reed-Solomon Error Correction.
 */

// Galois field tables for GF(256) with primitive polynomial 0x11d (285)
const EXP: Uint8Array = new Uint8Array(512)
const LOG: Uint8Array = new Uint8Array(256)

let gfX = 1
for (let i = 0; i < 255; i++) {
  EXP[i] = gfX
  LOG[gfX] = i
  gfX <<= 1
  if (gfX & 256) gfX ^= 0x11d
}
for (let i = 255; i < 512; i++) {
  EXP[i] = EXP[i - 255]!
}

function gmul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a]! + LOG[b]!]!
}

function rsGenPoly(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gmul(poly[j]!, EXP[i]!)
      next[j + 1] ^= poly[j]!
    }
    poly = next
  }
  return poly
}

function rsCalculate(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenPoly(ecCount)
  const res = new Uint8Array(ecCount)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i]! ^ res[0]!
    for (let j = 0; j < ecCount - 1; j++) {
      res[j] = res[j + 1]! ^ gmul(gen[j + 1]!, factor)
    }
    res[ecCount - 1] = gmul(gen[ecCount]!, factor)
  }
  return res
}

// Version table for Error Correction Level L & M (Versions 1-10)
// [totalCodewords, dataCodewords, ecPerBlock, numBlocksG1, dataPerBlockG1, numBlocksG2, dataPerBlockG2]
type VersionEntry = [number, number, number, number, number, number, number]

const VERSION_TABLE_M: VersionEntry[] = [
  [0, 0, 0, 0, 0, 0, 0], // index 0 unused
  [26, 16, 10, 1, 16, 0, 0], // V1
  [44, 28, 16, 1, 28, 0, 0], // V2
  [70, 44, 26, 1, 44, 0, 0], // V3
  [100, 64, 18, 2, 32, 0, 0], // V4 (holds up to 62 bytes)
  [134, 86, 24, 2, 43, 0, 0], // V5 (holds up to 84 bytes)
  [172, 108, 16, 4, 27, 0, 0], // V6 (holds up to 106 bytes)
  [196, 124, 18, 4, 31, 0, 0], // V7 (holds up to 122 bytes)
  [242, 154, 22, 2, 38, 2, 39], // V8
  [292, 182, 22, 3, 36, 2, 37], // V9
  [346, 216, 26, 4, 43, 1, 44], // V10
]

const ALIGNMENT_PATTERN_POS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

// Precomputed format info for Error Correction Level M, masks 0..7
const FORMAT_INFO_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
]

/**
 * Generates a boolean 2D matrix representing a QR code.
 */
export function createQrMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder()
  const rawBytes = encoder.encode(text)

  // Choose smallest version that fits data (Level M)
  let version = 1
  while (version <= 10 && rawBytes.length > VERSION_TABLE_M[version]![1] - 3) {
    version++
  }
  if (version > 10) version = 10

  const [, dataCW, ecPerBlock, b1, d1, b2, d2] = VERSION_TABLE_M[version]!
  const size = version * 4 + 17

  // 1. Bitstream packing (Byte Mode = 0b0100)
  const bits: number[] = []
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1)
    }
  }

  pushBits(0b0100, 4) // Mode
  pushBits(rawBytes.length, version < 10 ? 8 : 16) // Character count indicator
  for (const b of rawBytes) {
    pushBits(b, 8)
  }

  // Terminator
  const maxBits = dataCW * 8
  const termLen = Math.min(4, maxBits - bits.length)
  pushBits(0, termLen)

  // Pad to 8-bit boundary
  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  // Convert to data bytes
  const dataBytes: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | bits[i + j]!
    }
    dataBytes.push(byteVal)
  }

  // Pad with alternating 0xEC, 0x11
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (dataBytes.length < dataCW) {
    dataBytes.push(padBytes[padIdx % 2]!)
    padIdx++
  }

  // 2. Block division and Reed-Solomon generation
  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []
  let offset = 0

  for (let i = 0; i < b1; i++) {
    const slice = new Uint8Array(dataBytes.slice(offset, offset + d1))
    dataBlocks.push(slice)
    ecBlocks.push(rsCalculate(slice, ecPerBlock))
    offset += d1
  }
  for (let i = 0; i < b2; i++) {
    const slice = new Uint8Array(dataBytes.slice(offset, offset + d2))
    dataBlocks.push(slice)
    ecBlocks.push(rsCalculate(slice, ecPerBlock))
    offset += d2
  }

  // Interleave data codewords
  const finalCodewords: number[] = []
  const maxDataBlockLen = Math.max(d1, d2)
  for (let i = 0; i < maxDataBlockLen; i++) {
    for (let b = 0; b < dataBlocks.length; b++) {
      if (i < dataBlocks[b]!.length) {
        finalCodewords.push(dataBlocks[b]![i]!)
      }
    }
  }

  // Interleave error correction codewords
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < ecBlocks.length; b++) {
      finalCodewords.push(ecBlocks[b]![i]!)
    }
  }

  // 3. Matrix layout
  const matrix: Array<Int8Array> = Array.from({ length: size }, () => new Int8Array(size).fill(-1))
  const isFunction: Array<Uint8Array> = Array.from({ length: size }, () => new Uint8Array(size))

  function setModule(r: number, c: number, val: number) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r]![c] = val ? 1 : 0
      isFunction[r]![c] = 1
    }
  }

  // Finder patterns + Separator (7x7 finders + 1px white border)
  function addFinder(top: number, left: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r
        const col = left + c
        if (row < 0 || row >= size || col < 0 || col >= size) continue
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            setModule(row, col, 1)
          } else {
            setModule(row, col, 0)
          }
        } else {
          setModule(row, col, 0)
        }
      }
    }
  }

  addFinder(0, 0)
  addFinder(0, size - 7)
  addFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6]![i]) setModule(6, i, i % 2 === 0 ? 1 : 0)
    if (!isFunction[i]![6]) setModule(i, 6, i % 2 === 0 ? 1 : 0)
  }

  // Alignment patterns (for Version >= 2)
  const alignPos = ALIGNMENT_PATTERN_POS[version] || []
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      const r = alignPos[i]!
      const c = alignPos[j]!
      if (isFunction[r]![c]) continue

      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2
          const isCenter = dr === 0 && dc === 0
          setModule(r + dr, c + dc, isBorder || isCenter ? 1 : 0)
        }
      }
    }
  }

  // Dark module
  setModule(size - 8, 8, 1)

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8]![i]) isFunction[8]![i] = 1
    if (!isFunction[i]![8]) isFunction[i]![8] = 1
  }
  for (let i = size - 8; i < size; i++) {
    if (!isFunction[8]![i]) isFunction[8]![i] = 1
    if (!isFunction[i]![8]) isFunction[i]![8] = 1
  }

  // 4. Place Data Modules
  let bitIdx = 0
  const totalDataBits = finalCodewords.length * 8

  let inc = -1
  let row = size - 1
  let col = size - 1

  while (col > 0) {
    if (col === 6) col-- // Skip vertical timing line

    while (row >= 0 && row < size) {
      for (let c = 0; c < 2; c++) {
        const currCol = col - c
        if (!isFunction[row]![currCol]) {
          let bit = 0
          if (bitIdx < totalDataBits) {
            const byteIndex = Math.floor(bitIdx / 8)
            const bitOffset = 7 - (bitIdx % 8)
            bit = (finalCodewords[byteIndex]! >> bitOffset) & 1
            bitIdx++
          }
          matrix[row]![currCol] = bit
        }
      }
      row += inc
    }
    inc = -inc
    row += inc
    col -= 2
  }

  // 5. Apply Mask (Standard Mask 0: (row + col) % 2 === 0)
  for (let r = 0; r < size; r++) {
    const rowArr = matrix[r]!
    const funcArr = isFunction[r]!
    for (let c = 0; c < size; c++) {
      if (!funcArr[c]) {
        if ((r + c) % 2 === 0) {
          rowArr[c] = (rowArr[c]! ^ 1)
        }
      }
    }
  }

  // 6. Write Format Information (Mask 0, Level M: 0x5412)
  const formatInfo = FORMAT_INFO_M[0]!
  for (let i = 0; i < 15; i++) {
    const bit = (formatInfo >> (14 - i)) & 1
    if (i < 6) {
      setModule(8, i, bit)
    } else if (i < 8) {
      setModule(8, i + 1, bit)
    } else {
      setModule(14 - i, 8, bit)
    }

    if (i < 8) {
      setModule(size - 1 - i, 8, bit)
    } else {
      setModule(8, size - 15 + i, bit)
    }
  }

  // Convert to clean boolean[][]
  return matrix.map((r) => Array.from(r).map((v) => v === 1))
}
