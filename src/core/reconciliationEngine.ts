import type {
  Row,
  ReconciliationConfig,
  ReconciliationRecord,
  ReconciliationReport,
} from '../types'
import { normalizeKey, normalizeValue } from './normalizer'

export interface ReconcileResult {
  report: ReconciliationReport
  warnings: string[]
}

/**
 * Executa a conciliação entre Base_1 e Base_2.
 *
 * Modelo: aggregate-first (agrupa por chave antes de comparar)
 * 1. Agrupar Base_1 por chave normalizada, somando os valores de cada grupo
 * 2. Agrupar Base_2 por chave normalizada, somando os valores de cada grupo
 * 3. Para cada chave única da Base_2:
 *    a. Se não existe na Base_1 → "Nota não encontrada"
 *    b. Se |totalBase1 - totalBase2| <= valueTolerance → "De Acordo"
 *    c. Caso contrário → "Valor Divergente" (exibe ambos os totais)
 * 4. Linhas com campo-chave vazio são ignoradas e geram aviso
 */
export function reconcile(
  base1Rows: Row[],
  base2Rows: Row[],
  config: ReconciliationConfig
): ReconcileResult {
  const warnings: string[] = []
  const tolerance = config.valueTolerance ?? 0

  // ── Tipo auxiliar para o agregado de cada chave ───────────────────────
  interface Aggregate {
    total: number
    firstRow: Row  // para os campos de exibição adicionais
  }

  // ── 1. Agregar Base_1 por chave ───────────────────────────────────────
  const base1: Map<string, Aggregate> = new Map()
  let emptyBase1 = 0

  for (const row of base1Rows) {
    const keyNorm = normalizeKey(row[config.base1.keyField])
    if (!keyNorm) { emptyBase1++; continue }

    const v = normalizeValue(row[config.base1.valueColumn]) ?? 0
    const existing = base1.get(keyNorm)
    if (existing) {
      existing.total += v
    } else {
      base1.set(keyNorm, { total: v, firstRow: row })
    }
  }

  // ── 2. Agregar Base_2 por chave ───────────────────────────────────────
  const base2: Map<string, Aggregate> = new Map()
  let emptyBase2 = 0

  for (const row of base2Rows) {
    const keyNorm = normalizeKey(row[config.base2.keyField])
    if (!keyNorm) { emptyBase2++; continue }

    const v = normalizeValue(row[config.base2.valueColumn]) ?? 0
    const existing = base2.get(keyNorm)
    if (existing) {
      existing.total += v
    } else {
      base2.set(keyNorm, { total: v, firstRow: row })
    }
  }

  // Avisos de chaves vazias
  if (emptyBase1 > 0) {
    warnings.push(`${emptyBase1} linha(s) da Base_1 com campo-chave vazio foram ignoradas.`)
  }
  if (emptyBase2 > 0) {
    warnings.push(`${emptyBase2} linha(s) da Base_2 com campo-chave vazio foram ignoradas.`)
  }

  // ── 3. Colunas visíveis ───────────────────────────────────────────────
  const visibleColumns: string[] = [
    config.base2.keyField,
    'Valor da Nota (Base_2)',
    'Valor da Nota (Base_1)',
    'Status',
    ...config.base2.selectedDisplayFields.map((f) => `base2:${f}`),
    ...config.base1.selectedDisplayFields.map((f) => `base1:${f}`),
  ]

  // ── 4. Comparar totais ────────────────────────────────────────────────
  const records: ReconciliationRecord[] = []
  let deAcordo = 0, divergente = 0, naoEncontrada = 0

  for (const [keyNorm, agg2] of base2.entries()) {
    // Arredondar total acumulado para evitar erros de ponto flutuante
    const total2 = parseFloat(agg2.total.toFixed(2))

    // Campos de exibição da Base_2 (primeira linha do grupo)
    const displayFields: Record<string, string | number | null> = {}
    for (const field of config.base2.selectedDisplayFields) {
      displayFields[`base2:${field}`] = agg2.firstRow[field] ?? null
    }

    const agg1 = base1.get(keyNorm)

    if (!agg1) {
      // Chave não existe na Base_1
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }
      records.push({
        keyValue: keyNorm,
        valueBase2: total2,
        valueBase1: null,
        status: 'Nota não encontrada',
        displayFields,
      })
      naoEncontrada++
      continue
    }

    const total1 = parseFloat(agg1.total.toFixed(2))

    // Campos de exibição da Base_1 (primeira linha do grupo)
    for (const field of config.base1.selectedDisplayFields) {
      displayFields[`base1:${field}`] = agg1.firstRow[field] ?? null
    }

    if (Math.abs(total1 - total2) <= tolerance) {
      records.push({
        keyValue: keyNorm,
        valueBase2: total2,
        valueBase1: total1,
        status: 'De Acordo',
        displayFields,
      })
      deAcordo++
    } else {
      records.push({
        keyValue: keyNorm,
        valueBase2: total2,
        valueBase1: total1,
        status: 'Valor Divergente',
        displayFields,
      })
      divergente++
    }
  }

  return {
    report: {
      records,
      visibleColumns,
      summary: { total: records.length, deAcordo, divergente, naoEncontrada },
      generatedAt: new Date(),
    },
    warnings,
  }
}
