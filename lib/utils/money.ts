/**
 * Decimal-safe money helpers.
 * All arithmetic happens in integer cents — no float representation errors.
 */

/**
 * Converts a string or number amount to integer cents.
 * e.g. '1000.00' → 100000, 0.10 → 10
 */
export function toCents(val: string | number): number {
  const str = typeof val === 'number' ? val.toFixed(2) : (val ?? '0')
  const [whole, frac = '00'] = str.split('.')
  return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0').slice(0, 2), 10)
}

/**
 * Converts integer cents back to a fixed-2 decimal string.
 * e.g. 100000 → '1000.00', 1 → '0.01'
 */
export function fromCents(cents: number): string {
  const whole = Math.floor(cents / 100)
  const frac = (cents % 100).toString().padStart(2, '0')
  return `${whole}.${frac}`
}
