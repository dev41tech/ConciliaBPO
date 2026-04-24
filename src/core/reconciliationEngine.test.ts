import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { reconcile } from './reconciliationEngine'
import type { Row, ReconciliationConfig } from '../types'

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function makeConfig(overrides?: Partial<ReconciliationConfig>): ReconciliationConfig {
  return {
    base1: { sheet: 'Sheet1', keyField: 'CNPJ', valueColumn: 'VALOR', selectedDisplayFields: [] },
    base2: { sheet: 'Sheet1', keyField: 'CNPJ', valueColumn: 'VALOR', selectedDisplayFields: [] },
    valueTolerance: 0,
    ...overrides,
  }
}

function row(cnpj: string | null, valor: number | null, extra?: Record<string, string | number | null>): Row {
  return { CNPJ: cnpj, VALOR: valor, ...extra }
}

// ────────────────────────────────────────────────
// Testes unitários — comportamento básico
// ────────────────────────────────────────────────
describe('reconcile — unitários', () => {
  it('De Acordo quando chave e total de valores correspondem', () => {
    const { report } = reconcile([row('A', 100)], [row('A', 100)], makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
    expect(report.records[0].valueBase1).toBe(100)
    expect(report.records[0].valueBase2).toBe(100)
  })

  it('Valor Divergente quando chave existe mas totais diferem — exibe ambos os valores', () => {
    const { report } = reconcile([row('A', 200)], [row('A', 100)], makeConfig())
    expect(report.records[0].status).toBe('Valor Divergente')
    expect(report.records[0].valueBase1).toBe(200)
    expect(report.records[0].valueBase2).toBe(100)
  })

  it('Nota não encontrada quando chave não existe na Base_1', () => {
    const { report } = reconcile([row('B', 100)], [row('A', 100)], makeConfig())
    expect(report.records[0].status).toBe('Nota não encontrada')
    expect(report.records[0].valueBase1).toBeNull()
  })

  it('ignora linhas com campo-chave vazio na Base_2', () => {
    const { report } = reconcile([row('A', 100)], [row(null, 100), row('', 50)], makeConfig())
    expect(report.records).toHaveLength(0)
  })

  it('ignora linhas com campo-chave vazio na Base_1', () => {
    const { report } = reconcile([row(null, 100), row('A', 200)], [row('A', 200)], makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
  })

  it('normalização: compara sem distinção de case e espaços', () => {
    const { report } = reconcile([row('  ABC  ', 50)], [row('abc', 50)], makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
  })

  // ── Agregação ──────────────────────────────────────────────────────────

  it('múltiplas linhas da Base_1 com mesma chave têm valores somados', () => {
    const b1 = [row('X', 100), row('X', 150), row('X', 250)]  // total = 500
    const b2 = [row('X', 500)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
    expect(report.records[0].valueBase1).toBe(500)
  })

  it('múltiplas linhas da Base_2 com mesma chave têm valores somados', () => {
    const b1 = [row('X', 600)]
    const b2 = [row('X', 200), row('X', 200), row('X', 200)]  // total = 600
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
    expect(report.records[0].valueBase2).toBe(600)
  })

  it('ambas as bases com duplicatas: somas comparadas corretamente', () => {
    // Base_1: Motorista X → 100 + 200 = 300
    // Base_2: Motorista X → 150 + 150 = 300
    const b1 = [row('X', 100), row('X', 200)]
    const b2 = [row('X', 150), row('X', 150)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records[0].status).toBe('De Acordo')
    expect(report.records[0].valueBase1).toBe(300)
    expect(report.records[0].valueBase2).toBe(300)
  })

  it('resultado tem um registro por chave única — não um por linha', () => {
    // 5 linhas, mas apenas 2 chaves únicas na Base_2
    const b1 = [row('A', 100), row('B', 200)]
    const b2 = [row('A', 40), row('A', 60), row('B', 80), row('B', 80), row('B', 40)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.records).toHaveLength(2)
  })

  it('resumo conta corretamente por chave única', () => {
    const b1 = [row('A', 10), row('B', 20)]
    const b2 = [row('A', 10), row('B', 99), row('C', 30)]
    const { report } = reconcile(b1, b2, makeConfig())
    expect(report.summary.deAcordo).toBe(1)    // A
    expect(report.summary.divergente).toBe(1)   // B
    expect(report.summary.naoEncontrada).toBe(1) // C
    expect(report.summary.total).toBe(3)
  })

  it('Base_2 vazia retorna relatório com 0 registros', () => {
    const { report } = reconcile([row('X', 100)], [], makeConfig())
    expect(report.records).toHaveLength(0)
  })

  it('visibleColumns[0] é o nome do keyField da Base_2', () => {
    const { report } = reconcile([], [], makeConfig())
    expect(report.visibleColumns.slice(0, 4)).toEqual([
      'CNPJ',
      'Valor da Nota (Base_2)',
      'Valor da Nota (Base_1)',
      'Status',
    ])
  })

  it('aviso emitido quando há linhas com campo-chave vazio', () => {
    const b2 = [row(null, 100), row('A', 50)]
    const { warnings } = reconcile([], b2, makeConfig())
    expect(warnings.some((w) => w.includes('Base_2') && w.includes('vazio'))).toBe(true)
  })
})

// ────────────────────────────────────────────────
// Tolerância de valor
// ────────────────────────────────────────────────
describe('reconcile — tolerância de valor', () => {
  it('dentro da tolerância → De Acordo', () => {
    const { report } = reconcile([row('A', 100)], [row('A', 107)], makeConfig({ valueTolerance: 10 }))
    expect(report.records[0].status).toBe('De Acordo')
  })

  it('exatamente no limite → De Acordo', () => {
    const { report } = reconcile([row('A', 100)], [row('A', 110)], makeConfig({ valueTolerance: 10 }))
    expect(report.records[0].status).toBe('De Acordo')
  })

  it('acima do limite → Valor Divergente com ambos os valores', () => {
    const { report } = reconcile([row('A', 100)], [row('A', 115)], makeConfig({ valueTolerance: 10 }))
    expect(report.records[0].status).toBe('Valor Divergente')
    expect(report.records[0].valueBase1).toBe(100)
    expect(report.records[0].valueBase2).toBe(115)
  })

  it('tolerância aplicada sobre os totais somados', () => {
    // Base_1: 50 + 55 = 105; Base_2: 100; diferença = 5 <= tolerância 10
    const b1 = [row('A', 50), row('A', 55)]
    const { report } = reconcile(b1, [row('A', 100)], makeConfig({ valueTolerance: 10 }))
    expect(report.records[0].status).toBe('De Acordo')
  })
})

// ────────────────────────────────────────────────
// PBT — propriedades do modelo aggregate-first
// ────────────────────────────────────────────────

const rowArb = fc.record({
  CNPJ: fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.constant(null)),
  VALOR: fc.oneof(fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }), fc.constant(null)),
})

// Conta chaves únicas não-vazias em um array de rows
function uniqueKeys(rows: Row[]): number {
  const s = new Set<string>()
  for (const r of rows) {
    const k = r.CNPJ !== null && r.CNPJ !== undefined ? String(r.CNPJ).trim().toLowerCase() : ''
    if (k) s.add(k)
  }
  return s.size
}

describe('PBT — número de registros = chaves únicas não-vazias da Base_2', () => {
  it('report.records.length === uniqueKeys(base2Rows)', () => {
    fc.assert(
      fc.property(fc.array(rowArb), fc.array(rowArb), (b1, b2) => {
        const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())
        expect(report.records).toHaveLength(uniqueKeys(b2 as Row[]))
      }),
      { numRuns: 100 }
    )
  })
})

describe('PBT — status exaustivo e mutuamente exclusivo', () => {
  it('cada registro tem exatamente um dos três status válidos', () => {
    const valid = new Set(['De Acordo', 'Valor Divergente', 'Nota não encontrada'])
    fc.assert(
      fc.property(fc.array(rowArb), fc.array(rowArb), (b1, b2) => {
        const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())
        for (const rec of report.records) expect(valid.has(rec.status)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})

describe('PBT — valueBase1 correto conforme status', () => {
  it('De Acordo e Valor Divergente → valueBase1 sempre preenchido; Nota não encontrada → null', () => {
    fc.assert(
      fc.property(fc.array(rowArb), fc.array(rowArb), (b1, b2) => {
        const { report } = reconcile(b1 as Row[], b2 as Row[], makeConfig())
        for (const rec of report.records) {
          if (rec.status === 'De Acordo' || rec.status === 'Valor Divergente') {
            expect(rec.valueBase1).not.toBeNull()
          } else {
            expect(rec.valueBase1).toBeNull()
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})

describe('PBT — campos adicionais não afetam status', () => {
  it('alterar selectedDisplayFields não muda o status de nenhum registro', () => {
    fc.assert(
      fc.property(
        fc.array(rowArb, { maxLength: 10 }),
        fc.array(rowArb, { maxLength: 10 }),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
        (b1, b2, extraFields) => {
          const base = makeConfig()
          const withFields: ReconciliationConfig = {
            ...base,
            base1: { ...base.base1, selectedDisplayFields: extraFields },
            base2: { ...base.base2, selectedDisplayFields: extraFields },
          }
          const { report: r1 } = reconcile(b1 as Row[], b2 as Row[], base)
          const { report: r2 } = reconcile(b1 as Row[], b2 as Row[], withFields)
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
