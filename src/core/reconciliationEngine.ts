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
 * Algoritmo:
 * 1. Indexar Base_1 pela chave normalizada
 * 2. Para cada registro da Base_2:
 *    a. Se chave vazia → "Nota não encontrada" (aviso acumulado)
 *    b. Se chave não existe na Base_1 → "Nota não encontrada"
 *    c. Buscar ocorrência não-usada com |valor1 - valor2| <= valueTolerance
 *    d. Se encontrada → "De Acordo" + marcar como usada
 *    e. Se não encontrada → "Valor Divergente" (mostra valor da 1ª ocorrência disponível)
 * 3. Avisos: chaves duplicadas em ambas as bases, chaves vazias na Base_2
 */
export function reconcile(
  base1Rows: Row[],
  base2Rows: Row[],
  config: ReconciliationConfig
): ReconcileResult {
  const warnings: string[] = []
  const tolerance = config.valueTolerance ?? 0

  // ── 1. Construir índice da Base_1 ─────────────────────────────────────
  const base1Index = new Map<string, Row[]>()
  for (const row of base1Rows) {
    const keyRaw = row[config.base1.keyField]
    if (keyRaw === null || keyRaw === undefined || keyRaw === '') continue
    const keyNorm = normalizeKey(keyRaw)
    if (!keyNorm) continue
    if (!base1Index.has(keyNorm)) base1Index.set(keyNorm, [])
    base1Index.get(keyNorm)!.push(row)
  }

  // ── Detectar chaves duplicadas na Base_1 ──────────────────────────────
  const dupBase1: string[] = []
  for (const [key, rows] of base1Index.entries()) {
    if (rows.length > 1) dupBase1.push(key)
  }
  if (dupBase1.length > 0) {
    warnings.push(
      `Chaves duplicadas na Base_1 detectadas (${dupBase1.length} chave(s)). ` +
      `O sistema usará anti-double-matching para evitar correspondências duplicadas.`
    )
  }

  // ── Detectar chaves duplicadas na Base_2 ──────────────────────────────
  const base2KeyCount = new Map<string, number>()
  for (const row of base2Rows) {
    const kn = normalizeKey(row[config.base2.keyField])
    if (kn) base2KeyCount.set(kn, (base2KeyCount.get(kn) ?? 0) + 1)
  }
  const dupBase2: string[] = []
  for (const [key, count] of base2KeyCount.entries()) {
    if (count > 1) dupBase2.push(key)
  }
  if (dupBase2.length > 0) {
    warnings.push(
      `Chaves duplicadas na Base_2 detectadas (${dupBase2.length} chave(s)). ` +
      `Cada linha é processada de forma independente.`
    )
  }

  // ── 2. Anti-double-matching: rastrear índices usados por chave ────────
  const usedIndices = new Map<string, Set<number>>()

  // ── 3. Colunas visíveis (visibleColumns[0] = nome do campo-chave da Base_2) ──
  const visibleColumns: string[] = [
    config.base2.keyField,
    'Valor da Nota (Base_2)',
    'Valor da Nota (Base_1)',
    'Status',
    ...config.base2.selectedDisplayFields.map((f) => `base2:${f}`),
    ...config.base1.selectedDisplayFields.map((f) => `base1:${f}`),
  ]

  // ── 4. Processar cada registro da Base_2 ─────────────────────────────
  const records: ReconciliationRecord[] = []
  let deAcordo = 0
  let divergente = 0
  let naoEncontrada = 0
  let emptyKeyCount = 0

  for (const row2 of base2Rows) {
    const keyRaw2 = row2[config.base2.keyField]
    const keyNorm2 = normalizeKey(keyRaw2)
    const valueNorm2 = normalizeValue(row2[config.base2.valueColumn])

    const displayFields: Record<string, string | number | null> = {}
    for (const field of config.base2.selectedDisplayFields) {
      displayFields[`base2:${field}`] = row2[field] ?? null
    }

    // Caso: chave vazia na Base_2
    if (!keyNorm2) {
      emptyKeyCount++
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }
      records.push({ keyValue: String(keyRaw2 ?? ''), valueBase2: valueNorm2, valueBase1: null, status: 'Nota não encontrada', displayFields })
      naoEncontrada++
      continue
    }

    const base1Occurrences = base1Index.get(keyNorm2)

    // Caso: chave não existe na Base_1
    if (!base1Occurrences || base1Occurrences.length === 0) {
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }
      records.push({ keyValue: keyNorm2, valueBase2: valueNorm2, valueBase1: null, status: 'Nota não encontrada', displayFields })
      naoEncontrada++
      continue
    }

    if (!usedIndices.has(keyNorm2)) usedIndices.set(keyNorm2, new Set())
    const used = usedIndices.get(keyNorm2)!

    // Buscar ocorrência não usada cuja diferença de valor esteja dentro da tolerância
    let matchedRow: Row | null = null
    let matchedIdx = -1
    for (let i = 0; i < base1Occurrences.length; i++) {
      if (used.has(i)) continue
      const v1 = normalizeValue(base1Occurrences[i][config.base1.valueColumn])
      if (v1 !== null && valueNorm2 !== null && Math.abs(v1 - valueNorm2) <= tolerance) {
        matchedRow = base1Occurrences[i]
        matchedIdx = i
        break
      }
    }

    if (matchedRow !== null) {
      // De Acordo
      used.add(matchedIdx)
      const valueBase1 = normalizeValue(matchedRow[config.base1.valueColumn])
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = matchedRow[field] ?? null
      }
      records.push({ keyValue: keyNorm2, valueBase2: valueNorm2, valueBase1, status: 'De Acordo', displayFields })
      deAcordo++
    } else {
      // Valor Divergente — mostrar valor/campos da 1ª ocorrência disponível da Base_1
      let firstAvailable: Row | null = null
      for (let i = 0; i < base1Occurrences.length; i++) {
        if (!used.has(i)) { firstAvailable = base1Occurrences[i]; break }
      }
      const valueBase1 = firstAvailable
        ? normalizeValue(firstAvailable[config.base1.valueColumn])
        : null
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = firstAvailable ? (firstAvailable[field] ?? null) : null
      }
      records.push({ keyValue: keyNorm2, valueBase2: valueNorm2, valueBase1, status: 'Valor Divergente', displayFields })
      divergente++
    }
  }

  if (emptyKeyCount > 0) {
    warnings.push(
      `${emptyKeyCount} linha(s) da Base_2 com campo-chave vazio foram tratadas como "Nota não encontrada".`
    )
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
