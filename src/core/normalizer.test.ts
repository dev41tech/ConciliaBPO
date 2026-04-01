import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { normalizeKey, normalizeValue } from './normalizer'

// ────────────────────────────────────────────────
// Testes unitários — normalizeKey
// ────────────────────────────────────────────────
describe('normalizeKey — unitários', () => {
  it('faz trim e lowercase', () => {
    expect(normalizeKey('  12.345.678/0001-99  ')).toBe('12.345.678/0001-99')
    expect(normalizeKey('CNPJ_ABC')).toBe('cnpj_abc')
    expect(normalizeKey('  ABC  ')).toBe('abc')
  })

  it('retorna string vazia para null, undefined e string vazia', () => {
    expect(normalizeKey(null)).toBe('')
    expect(normalizeKey(undefined)).toBe('')
    expect(normalizeKey('')).toBe('')
  })

  it('converte número para string normalizada', () => {
    expect(normalizeKey(12345)).toBe('12345')
  })
})

// ────────────────────────────────────────────────
// Testes unitários — normalizeValue
// ────────────────────────────────────────────────
describe('normalizeValue — unitários', () => {
  it('converte número inteiro', () => {
    expect(normalizeValue(1500)).toBe(1500)
  })

  it('converte número decimal', () => {
    expect(normalizeValue(1500.5)).toBe(1500.5)
  })

  it('arredonda para 2 casas decimais', () => {
    expect(normalizeValue(1500.999)).toBe(1501)
    expect(normalizeValue(1500.004)).toBe(1500)
    expect(normalizeValue(1.234)).toBe(1.23)
    expect(normalizeValue(1.235)).toBe(1.24)
    // Nota: 1.005 não é representável exatamente em IEEE 754;
    // parseFloat((1.005).toFixed(2)) = 1.00 — comportamento correto.
  })

  it('converte string com ponto decimal', () => {
    expect(normalizeValue('1500.50')).toBe(1500.5)
  })

  it('converte string com vírgula decimal (formato BR)', () => {
    expect(normalizeValue('1500,50')).toBe(1500.5)
  })

  it('converte string com milhar e vírgula (formato BR)', () => {
    expect(normalizeValue('1.500,00')).toBe(1500)
    expect(normalizeValue('10.000,50')).toBe(10000.5)
  })

  it('retorna null para string não numérica', () => {
    expect(normalizeValue('abc')).toBeNull()
    expect(normalizeValue('')).toBeNull()
  })

  it('retorna null para null e undefined', () => {
    expect(normalizeValue(null)).toBeNull()
    expect(normalizeValue(undefined)).toBeNull()
  })

  it('retorna null para NaN e Infinity', () => {
    expect(normalizeValue(NaN)).toBeNull()
    expect(normalizeValue(Infinity)).toBeNull()
    expect(normalizeValue(-Infinity)).toBeNull()
  })

  it('retorna null para objeto e array', () => {
    expect(normalizeValue({})).toBeNull()
    expect(normalizeValue([])).toBeNull()
  })
})

// ────────────────────────────────────────────────
// Testes PBT — Property 2: normalizeKey idempotente
// Feature: excel-reconciliation, Property 2: Normalização de chave é idempotente
// ────────────────────────────────────────────────
describe('PBT — Property 2: normalizeKey idempotente', () => {
  it('normalizeKey(normalizeKey(v)) === normalizeKey(v) para qualquer string', () => {
    fc.assert(
      fc.property(fc.string(), (v) => {
        const once = normalizeKey(v)
        const twice = normalizeKey(once)
        expect(twice).toBe(once)
      }),
      { numRuns: 100 }
    )
  })

  it('resultado não contém espaços nas bordas e está em minúsculas — strings unicode', () => {
    fc.assert(
      fc.property(fc.unicodeString(), (v) => {
        const result = normalizeKey(v)
        expect(result).toBe(result.trim())
        expect(result).toBe(result.toLowerCase())
      }),
      { numRuns: 100 }
    )
  })
})

// ────────────────────────────────────────────────
// Testes PBT — Property 3: normalizeValue produz número ou null
// Feature: excel-reconciliation, Property 3: Normalização de valor produz número ou nulo
// ────────────────────────────────────────────────
describe('PBT — Property 3: normalizeValue produz número ou null', () => {
  it('retorna null ou número finito com no máximo 2 casas decimais para qualquer entrada', () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const result = normalizeValue(v)

        // Nunca retorna undefined, NaN, Infinity ou string
        expect(result === null || typeof result === 'number').toBe(true)

        if (result !== null) {
          expect(isFinite(result)).toBe(true)
          expect(isNaN(result)).toBe(false)

          // No máximo 2 casas decimais: result * 100 deve ser inteiro
          // (válido para qualquer número finito IEEE 754)
          const centavos = result * 100
          expect(centavos).toBe(Math.round(centavos))
        }
      }),
      { numRuns: 100 }
    )
  })
})
