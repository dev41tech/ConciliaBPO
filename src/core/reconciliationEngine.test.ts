import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { reconcile } from './reconciliationEngine'
import type { Row, ReconciliationConfig } from '../types'

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function makeConfig(overrides?: Partial<ReconciliationConfig>): ReconciliationConfig {
  return {
    base1: {
      sheet: 'Sheet1',
      cnpjColumn: 'CNPJ',
      valueColumn: 'VALOR',
      selectedDisplayFields: [],
    },
    base2: {
      sheet: 'Sheet1',
      cnpjColumn: 'CNPJ',
      valueColumn: 'VALOR',
      selectedDisplayFields: [],
    },
    ...overrides,
  }
}

function makeRow(cnpj: string | null, valor: number | null, extra?: Record<string, string | number | null>): Row {
  return { CNPJ: cnpj, VALOR: valor, ...extra }
}

// Gerador arbitrário de Row (CNPJ e valor simples para testes de propriedade)
const rowArb = fc.record({
  CNPJ: fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.constant(null)),
  VALOR: fc.oneof(fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e10, max: 1e10 }), fc.constant(null)),
})

// ────────────────────────────────────────────────
// Testes unitários
// ────────────────────────────────────────────────
describe('reconcile — unitários', () => {
  it('De Acordo quando CNPJ e valor correspondem', () => {
    const b1 = [makeRow('12345', 100)]
    const b2 = [makeRow('12345', 100)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
    expect(report.records[0].valueBase1).toBe(100)
  })

  it('Valor Divergente quando CNPJ existe mas valor difere', () => {
    const b1 = [makeRow('12345', 200)]
    const b2 = [makeRow('12345', 100)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('Valor Divergente')
    expect(report.records[0].valueBase1).toBeNull()
  })

  it('Nota não encontrada quando CNPJ não existe na Base_1', () => {
    const b1 = [makeRow('99999', 100)]
    const b2 = [makeRow('12345', 100)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('Nota não encontrada')
    expect(report.records[0].valueBase1).toBeNull()
  })

  it('Nota não encontrada quando CNPJ é vazio na Base_2', () => {
    const b1 = [makeRow('12345', 100)]
    const b2 = [makeRow(null, 100), makeRow('', 50)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records).toHaveLength(2)
    expect(report.records[0].status).toBe('Nota não encontrada')
    expect(report.records[1].status).toBe('Nota não encontrada')
  })

  it('ignora registros com CNPJ vazio na Base_1', () => {
    const b1 = [makeRow(null, 100), makeRow('12345', 200)]
    const b2 = [makeRow('12345', 200)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
  })

  it('normalização: compara sem distinção de case e espaços', () => {
    const b1 = [makeRow('  ABC  ', 50)]
    const b2 = [makeRow('abc', 50)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
  })

  it('anti-double-matching: mesma ocorrência da Base_1 não pode ser usada duas vezes', () => {
    // Base_1: um registro com CNPJ=X, valor=100
    // Base_2: dois registros com CNPJ=X, valor=100
    // Esperado: primeiro "De Acordo", segundo "Valor Divergente"
    const b1 = [makeRow('X', 100)]
    const b2 = [makeRow('X', 100), makeRow('X', 100)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
    expect(report.records[1].status).toBe('Valor Divergente')
  })

  it('múltiplas ocorrências na Base_1: cada uma pode ser usada uma vez', () => {
    const b1 = [makeRow('X', 100), makeRow('X', 100)]
    const b2 = [makeRow('X', 100), makeRow('X', 100)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
    expect(report.records[1].status).toBe('De Acordo')
  })

  it('resumo conta corretamente os status', () => {
    const b1 = [makeRow('A', 10), makeRow('B', 20)]
    const b2 = [makeRow('A', 10), makeRow('B', 99), makeRow('C', 30)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.summary.deAcordo).toBe(1)
    expect(report.summary.divergente).toBe(1)
    expect(report.summary.naoEncontrada).toBe(1)
    expect(report.summary.total).toBe(3)
  })

  it('emite aviso para CNPJs duplicados na Base_1', () => {
    const b1 = [makeRow('X', 100), makeRow('X', 200)]
    const b2 = [makeRow('X', 100)]
    const { warnings } = reconcile(b1, b2, makeConfig())
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('duplicados')
  })

  it('Base_2 vazia retorna relatório com 0 registros', () => {
    const b1 = [makeRow('X', 100)]
    const b2: Row[] = []
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records).toHaveLength(0)
    expect(report.summary.total).toBe(0)
  })

  it('visibleColumns inclui colunas padrão na ordem correta', () => {
    const b1: Row[] = []
    const b2: Row[] = []
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.visibleColumns.slice(0, 4)).toEqual([
      'CNPJ',
      'Valor da Nota (Base_2)',
      'Valor da Nota (Base_1)',
      'Status',
    ])
  })
})

// ────────────────────────────────────────────────
// PBT — Property 5: todo registro da Base_2 aparece no relatório
// Feature: excel-reconciliation, Property 5: Todo registro válido da Base_2 aparece no relatório
// ────────────────────────────────────────────────
describe('PBT — Property 5: todo registro da Base_2 aparece no relatório', () => {
  it('report.records.length === base2Rows.length para qualquer entrada', () => {
    fc.assert(
      fc.property(
        fc.array(rowArb),
        fc.array(rowArb),
        (b1, b2) => {
          const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())
          expect(report.records).toHaveLength(b2.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ────────────────────────────────────────────────
// PBT — Property 6: status exaustivo, semântico e anti-double-matching
// Feature: excel-reconciliation, Property 6: Status exaustivo, mutuamente exclusivo e semanticamente correto com anti-double-matching
// ────────────────────────────────────────────────
describe('PBT — Property 6: status exaustivo e semântico', () => {
  it('cada registro tem exatamente um dos três status válidos', () => {
    fc.assert(
      fc.property(
        fc.array(rowArb),
        fc.array(rowArb),
        (b1, b2) => {
          const validStatuses = new Set(['De Acordo', 'Valor Divergente', 'Nota não encontrada'])
          const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())
          for (const rec of report.records) {
            expect(validStatuses.has(rec.status)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('anti-double-matching: uma ocorrência da Base_1 não é usada em dois matches', () => {
    fc.assert(
      fc.property(
        // Base_1 com CNPJs repetidos
        fc.array(
          fc.record({ CNPJ: fc.constantFrom('A', 'B', 'C'), VALOR: fc.integer({ min: 1, max: 100 }) }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.array(
          fc.record({ CNPJ: fc.constantFrom('A', 'B', 'C'), VALOR: fc.integer({ min: 1, max: 100 }) }),
          { minLength: 1, maxLength: 10 }
        ),
        (b1, b2) => {
          const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())

          // Contar quantas vezes cada par (CNPJ, VALOR) da Base_1 foi consumido
          const b1Counts = new Map<string, number>()
          for (const row of b1) {
            const key = `${String(row.CNPJ).toLowerCase()}:${row.VALOR}`
            b1Counts.set(key, (b1Counts.get(key) ?? 0) + 1)
          }

          // Quantas vezes o mesmo par foi marcado "De Acordo" na Base_2
          const b2Used = new Map<string, number>()
          for (const rec of report.records) {
            if (rec.status === 'De Acordo') {
              const key = `${rec.cnpj}:${rec.valueBase1}`
              b2Used.set(key, (b2Used.get(key) ?? 0) + 1)
            }
          }

          // Uso de "De Acordo" não deve exceder disponibilidade na Base_1
          for (const [key, count] of b2Used.entries()) {
            const available = b1Counts.get(key) ?? 0
            expect(count).toBeLessThanOrEqual(available)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ────────────────────────────────────────────────
// PBT — Property 7: campos adicionais não afetam status
// Feature: excel-reconciliation, Property 7: Campos adicionais não afetam o status
// ────────────────────────────────────────────────
describe('PBT — Property 7: campos adicionais não afetam o status', () => {
  it('alterar selectedDisplayFields não muda o status de nenhum registro', () => {
    fc.assert(
      fc.property(
        fc.array(rowArb, { minLength: 0, maxLength: 10 }),
        fc.array(rowArb, { minLength: 0, maxLength: 10 }),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
        (b1, b2, extraFields) => {
          const configWithoutFields = makeConfig()
          const configWithFields: ReconciliationConfig = {
            ...configWithoutFields,
            base1: { ...configWithoutFields.base1, selectedDisplayFields: extraFields },
            base2: { ...configWithoutFields.base2, selectedDisplayFields: extraFields },
          }

          const { report: r1 } = reconcile(b1 as Row[], b2 as Row[], configWithoutFields)
          const { report: r2 } = reconcile(b1 as Row[], b2 as Row[], configWithFields)

          expect(r1.records.length).toBe(r2.records.length)
          for (let i = 0; i < r1.records.length; i++) {
            expect(r1.records[i].status).toBe(r2.records[i].status)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ────────────────────────────────────────────────
// PBT — Property 8: completude de matching com múltiplas ocorrências
// Feature: excel-reconciliation, Property 8: Completude de matching com múltiplas ocorrências
// ────────────────────────────────────────────────
describe('PBT — Property 8: completude de matching com múltiplas ocorrências', () => {
  it('cada ocorrência da Base_2 gera linha independente no relatório', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ CNPJ: fc.constantFrom('X', 'Y'), VALOR: fc.integer({ min: 1, max: 50 }) }),
          { minLength: 0, maxLength: 15 }
        ),
        fc.array(
          fc.record({ CNPJ: fc.constantFrom('X', 'Y'), VALOR: fc.integer({ min: 1, max: 50 }) }),
          { minLength: 0, maxLength: 15 }
        ),
        (b1, b2) => {
          const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())
          // Cada linha da Base_2 → exatamente uma linha no relatório
          expect(report.records).toHaveLength(b2.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ────────────────────────────────────────────────
// PBT — Property 13: valueBase1 preenchido conforme status
// Feature: excel-reconciliation, Property 13: valueBase1 é preenchido corretamente conforme o status
// ────────────────────────────────────────────────
describe('PBT — Property 13: valueBase1 correto conforme status', () => {
  it('valueBase1 !== null se e somente se status === De Acordo', () => {
    fc.assert(
      fc.property(
        fc.array(rowArb),
        fc.array(rowArb),
        (b1, b2) => {
          const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())
          for (const rec of report.records) {
            if (rec.status === 'De Acordo') {
              expect(rec.valueBase1).not.toBeNull()
            } else {
              expect(rec.valueBase1).toBeNull()
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
