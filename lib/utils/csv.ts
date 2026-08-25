/**
 * CSV sanitization utilities.
 *
 * Prevents formula injection (CSV injection / Excel macro injection) by
 * prefixing values that start with =, +, -, @, TAB, or CR with a single quote.
 * Handles quoting of values that contain commas, newlines, or double-quotes.
 */

/**
 * Sanitizes a single string value for safe CSV inclusion.
 * Prefixes dangerous leading characters with a single quote so spreadsheet
 * applications do not interpret them as formulas.
 */
export function sanitizeCsvValue(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}

/**
 * Converts an array of values into a single CSV row string.
 * - Null/undefined → empty string
 * - Applies formula-injection sanitization
 * - Quotes values containing commas, newlines, or double-quotes
 */
export function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map(v => {
      const str = v == null ? '' : String(v)
      const sanitized = sanitizeCsvValue(str)
      // Quote if the value contains a comma, newline, or double-quote
      if (/[,\n"]/.test(sanitized)) return `"${sanitized.replace(/"/g, '""')}"`
      return sanitized
    })
    .join(',')
}

/**
 * Builds a complete CSV string from a header row and data rows.
 * Each row is terminated with CRLF per RFC 4180.
 */
export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\r\n')
}
