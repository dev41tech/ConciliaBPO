import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import * as XLSX from 'xlsx'
import { buildWorksheet } from './exporter'
import type { ReconciliationReport, ReconciliationRecord, ReconciliationStatus } from '../types'

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function makeReport(records: ReconciliationRecord[]): ReconciliationReport {
  const summary = {
    total: records.length,
    deAcordo: records.filter((r) => r.status === 'De Acordo').length,
    divergente: records.filter((r) => r.status === 'Valor Divergente').length,
    naoEncontrada: records.filter((r) => r.status === 'Nota não encontrada').length,
  }
  return {
    records,
    visibleColumns: ['CNPJ', 'Valor da Nota (Base_2)', 'Valor da Nota (Base_1)', 'Status'],
    summary,
    generatedAt: new Date(),
  }
}

function makeRecord(
  cnpj: string,
  valueBase2: number | null,
  valueBase1: number | null,
  status: ReconciliationStatus
): ReconciliationRecord {
  return { cnpj, valueBase2, valueBase1, status, displayFields: {} }
}

// Gerador de ReconciliationRecord arbitrário
const statusArb = fc.constantFrom<ReconciliationStatus>(
  'De Acordo',
  'Valor Divergente',
  'Nota não encontrada'
)

const recordArb = fc.record({
  cnpj: fc.string({ maxLength: 20 }),
  valueBase2: fc.oneof(fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 }), fc.constant(null)),
  valueBase1: fc.oneof(fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 }), fc.constant(null)),
  status: statusArb,
  displayFields: fc.constant({}),
})

const reportArb = fc.array(recordArb, { maxLength: 50 }).map(makeReport)

// ────────────────────────────────────────────────
// Testes unitários
// ────────────────────────────────────────────────
describe('buildWorksheet — unitários', () => {
  it('primeira linha contém os 4 cabeçalhos padrão', () => {
    const ws = buildWorksheet(makeReport([]))
    expect(XLSX.utils.sheet_to_json(ws, { header: 1 })[0]).toEqual([
      'CNPJ',
      'Valor da Nota (Base_2)',
      'Valor da Nota (Base_1)',
      'Status',
    ])
  })

  it('número de linhas de dados = número de registros', () => {
    const records = [
      makeRecord('A', 100, 100, 'De Acordo'),
      makeRecord('B', 200, null, 'Valor Divergente'),
    ]
    const ws = buildWorksheet(makeReport(records))
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
    expect(rows).toHaveLength(3) // 1 header + 2 records
  })

  it('valores corretos na primeira linha de dados', () => {
    const records = [makeRecord('12345', 1500, 1500, 'De Acordo')]
    const ws = buildWorksheet(makeReport(records))
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
    const dataRow = rows[1] as unknown[]
    expect(dataRow[0]).toBe('12345')
    expect(dataRow[1]).toBe(1500)
    expect(dataRow[2]).toBe(1500)
    expect(dataRow[3]).toBe('De Acordo')
  })

  it('valueBase1 null aparece como null/undefined na célula (não como string)', () => {
    const records = [makeRecord('X', 800, null, 'Nota não encontrada')]
    const ws = buildWorksheet(makeReport(records))
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
    const dataRow = rows[1] as unknown[]
    expect(dataRow[2]).toBeNull()
  })
})

// ────────────────────────────────────────────────
// PBT — Property 9: round-trip de exportação
// Feature: excel-reconciliation, Property 9: Round-trip de exportação preserva dados e formato de colunas
// ────────────────────────────────────────────────
describe('PBT — Property 9: round-trip de exportação', () => {
  it('(a) número de registros preservado no round-trip', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const ws = buildWorksheet(report)
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
        // header row + N data rows
        expect(rows).toHaveLength(report.records.length + 1)
      }),
      { numRuns: 100 }
    )
  })

  it('(b) ordem das 4 colunas padrão é preservada', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const ws = buildWorksheet(report)
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
        const header = rows[0] as string[]
        expect(header.slice(0, 4)).toEqual([
          'CNPJ',
          'Valor da Nota (Base_2)',
          'Valor da Nota (Base_1)',
          'Status',
        ])
      }),
      { numRuns: 100 }
    )
  })

  it('(c) valores de Status são equivalentes aos originais', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const ws = buildWorksheet(report)
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
        const statusKey = 'Status'
        report.records.forEach((rec, i) => {
          expect(rows[i]?.[statusKey]).toBe(rec.status)
        })
      }),
      { numRuns: 100 }
    )
  })
})
