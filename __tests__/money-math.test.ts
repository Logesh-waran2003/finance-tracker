/**
 * Boundary / property tests for decimal-safe money helpers.
 * The classic float trap: 0.1 + 0.2 !== 0.3 in JS — toCents must avoid it.
 */
import { describe, it, expect } from 'bun:test'
import { toCents, fromCents } from '@/lib/utils/money'

describe('toCents — float trap', () => {
  it('0.10 + 0.20 === 0.30 in cents (no float error)', () => {
    expect(toCents('0.10') + toCents('0.20')).toBe(toCents('0.30'))
  })
})

describe('toCents — known values', () => {
  it('toCents("1000.00") === 100000', () => {
    expect(toCents('1000.00')).toBe(100000)
  })

  it('toCents(0) === 0', () => {
    expect(toCents(0)).toBe(0)
  })

  it('toCents("999.99") === 99999', () => {
    expect(toCents('999.99')).toBe(99999)
  })

  it('toCents("0.01") === 1 (minimum unit)', () => {
    expect(toCents('0.01')).toBe(1)
  })

  it('toCents("0") === 0', () => {
    expect(toCents('0')).toBe(0)
  })

  it('toCents of large amount: "99999999.99" === 9999999999', () => {
    expect(toCents('99999999.99')).toBe(9999999999)
  })
})

describe('fromCents — known values', () => {
  it('fromCents(100000) === "1000.00"', () => {
    expect(fromCents(100000)).toBe('1000.00')
  })

  it('fromCents(1) === "0.01"', () => {
    expect(fromCents(1)).toBe('0.01')
  })

  it('fromCents(0) === "0.00"', () => {
    expect(fromCents(0)).toBe('0.00')
  })
})

describe('toCents / fromCents — round-trip', () => {
  it('fromCents(toCents("123.45")) === "123.45"', () => {
    expect(fromCents(toCents('123.45'))).toBe('123.45')
  })

  it('fromCents(toCents("0.01")) === "0.01"', () => {
    expect(fromCents(toCents('0.01'))).toBe('0.01')
  })

  it('fromCents(toCents("999.99")) === "999.99"', () => {
    expect(fromCents(toCents('999.99'))).toBe('999.99')
  })

  it('fromCents(toCents("1000.00")) === "1000.00"', () => {
    expect(fromCents(toCents('1000.00'))).toBe('1000.00')
  })
})
