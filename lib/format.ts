/**
 * Display formatting. No React here.
 *
 * Money arrives from Drizzle `numeric` columns as STRINGS (e.g. "1234.50").
 * Parsing to float loses precision on large values, so the whole-rupee path
 * formats straight from the string. Floats are used only for compact display
 * and for sign detection, where precision does not matter.
 */

const RUPEE = '₹'

const inr = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
})

const inr2 = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export interface MoneyOptions {
  /** Show two decimal places. Default false — whole rupees. */
  decimals?: boolean
  /** Short form: 12.5k / 1.2L / 3.4Cr. Default false. */
  compact?: boolean
}

interface ParsedMoney {
  negative: boolean
  /** Integer part, digits only, no sign. */
  whole: string
  /** Exactly two fraction digits, digits only. */
  fraction: string
}

/** Split a numeric string / number into sign + integer + 2-digit fraction, without float maths. */
function parseMoney(value: string | number): ParsedMoney {
  const raw = typeof value === 'number' ? String(value) : (value ?? '').trim()
  if (raw === '' || raw === '-' || Number.isNaN(Number(raw))) {
    return { negative: false, whole: '0', fraction: '00' }
  }
  // Exponential notation cannot be split textually — normalise it first.
  const text = /e/i.test(raw) ? Number(raw).toFixed(2) : raw
  const negative = text.startsWith('-')
  const unsigned = negative ? text.slice(1) : text.replace(/^\+/, '')
  const [wholeRaw = '0', fractionRaw = ''] = unsigned.split('.')
  const whole = wholeRaw.replace(/\D/g, '') || '0'
  const fraction = (fractionRaw.replace(/\D/g, '') + '00').slice(0, 2)
  return { negative, whole, fraction }
}

/** Indian lakh/crore digit grouping applied to a plain digit string. */
function groupIndian(digits: string): string {
  const clean = digits.replace(/^0+(?=\d)/, '')
  if (clean.length <= 3) return clean
  const head = clean.slice(0, -3)
  const tail = clean.slice(-3)
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail
}

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const trim = (n: number) => {
    const s = n.toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
  if (abs >= 1_00_00_000) return `${sign}${RUPEE}${trim(abs / 1_00_00_000)}Cr`
  if (abs >= 1_00_000) return `${sign}${RUPEE}${trim(abs / 1_00_000)}L`
  if (abs >= 1_000) return `${sign}${RUPEE}${trim(abs / 1_000)}k`
  return `${sign}${RUPEE}${inr.format(Math.round(abs))}`
}

/**
 * Format money the Indian way, always prefixed with the rupee sign.
 * `formatMoney('1234567.5')`                  => "₹12,34,568"
 * `formatMoney('1234567.5', { decimals: true })` => "₹12,34,567.50"
 * `formatMoney('1234567.5', { compact: true })`  => "₹12.3L"
 */
export function formatMoney(
  value: string | number,
  opts: MoneyOptions = {}
): string {
  if (opts.compact) return formatCompact(toNumber(value))

  const { negative, whole, fraction } = parseMoney(value)
  if (opts.decimals) {
    const body = `${groupIndian(whole)}.${fraction}`
    return `${negative ? '-' : ''}${RUPEE}${body}`
  }
  // Round half-up to whole rupees using string maths, so big values stay exact.
  const rounded = Number(fraction) >= 50 ? incrementDigits(whole) : whole
  const body = groupIndian(rounded)
  const isZero = /^0*$/.test(rounded)
  return `${negative && !isZero ? '-' : ''}${RUPEE}${body}`
}

/** Add one to a digit string without going through Number. */
function incrementDigits(digits: string): string {
  const out = digits.split('')
  let i = out.length - 1
  while (i >= 0) {
    if (out[i] === '9') {
      out[i] = '0'
      i -= 1
    } else {
      out[i] = String(Number(out[i]) + 1)
      return out.join('')
    }
  }
  return '1' + out.join('')
}

/** Parse for comparison / grouping only. Never use the result for display. */
export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0
  const n = Number(String(value).trim())
  return Number.isFinite(n) ? n : 0
}

/** Sign of an amount, derived from the string where possible. */
export function moneySign(value: string | number): -1 | 0 | 1 {
  const { negative, whole, fraction } = parseMoney(value)
  const isZero = /^0*$/.test(whole) && fraction === '00'
  if (isZero) return 0
  return negative ? -1 : 1
}

export type DateStyleName = 'short' | 'medium' | 'long' | 'day' | 'month'

const IST = 'Asia/Kolkata'

function toDate(d: Date | string | number | null | undefined): Date | null {
  if (d == null) return null
  const date = d instanceof Date ? d : new Date(d)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Format a date in IST.
 * short  => 31/08/26
 * medium => 31 Aug 2026   (default)
 * long   => Monday, 31 August 2026
 * day    => Mon 31
 * month  => Aug 2026
 */
export function formatDate(
  d: Date | string | number | null | undefined,
  style: DateStyleName = 'medium'
): string {
  const date = toDate(d)
  if (!date) return '—'
  const base: Intl.DateTimeFormatOptions = { timeZone: IST }
  const byStyle: Record<DateStyleName, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit', year: '2-digit' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    day: { weekday: 'short', day: '2-digit' },
    month: { month: 'short', year: 'numeric' },
  }
  return new Intl.DateTimeFormat('en-IN', { ...base, ...byStyle[style] }).format(date)
}

/** 31 Aug 2026, 4:05 pm — always IST. */
export function formatDateTime(
  d: Date | string | number | null | undefined
): string {
  const date = toDate(d)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/** 4:05 pm — always IST. */
export function formatTime(
  d: Date | string | number | null | undefined
): string {
  const date = toDate(d)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/** Whole-number counts, Indian grouping. */
export function formatCount(n: string | number | null | undefined): string {
  return inr.format(Math.round(toNumber(n)))
}

/** 12.5% — pass 12.5, not 0.125. */
export function formatPercent(
  n: string | number | null | undefined,
  decimals = 1
): string {
  const value = toNumber(n)
  const fixed = value.toFixed(decimals)
  return `${fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed}%`
}

export { inr2 }
