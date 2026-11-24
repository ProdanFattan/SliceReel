interface ByteUnit {
  label: string
  size: number
  decimals: number
}

/** Decimal units, matching how operating systems and the 2 GB upload limit are shown. */
const UNITS: readonly ByteUnit[] = [
  { label: 'B', size: 1, decimals: 0 },
  { label: 'KB', size: 1e3, decimals: 0 },
  { label: 'MB', size: 1e6, decimals: 0 },
  { label: 'GB', size: 1e9, decimals: 2 },
]

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Formats a byte count with the smallest unit that keeps the number under 1000
 * after rounding, so 999.6 MB shows as `1.00 GB`, not `1000 MB`.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError(`Cannot format a byte count of ${bytes}`)
  }

  for (const [index, unit] of UNITS.entries()) {
    const value = roundTo(bytes / unit.size, unit.decimals)
    const isLargestUnit = index === UNITS.length - 1
    if (value < 1000 || isLargestUnit) {
      return `${value.toFixed(unit.decimals)} ${unit.label}`
    }
  }
  throw new Error('unreachable: UNITS is empty')
}
