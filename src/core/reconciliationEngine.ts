import type {
  Row,
  ReconciliationConfig,
  ReconciliationRecord,
  ReconciliationReport,
} from '../types'
import { normalizeKey, normalizeValue } from './normalizer'

/**
 * Resultado intermediário do processo de reconciliação,
 * incluindo avisos gerados durante o processamento.
 */
export interface ReconcileResult {
  report: ReconciliationReport
  warnings: string[]
}

/**
 * Executa a conciliação entre Base_1 e Base_2.
 *
 * Algoritmo:
 * 1. Indexar Base_1 pela chave normalizada (Map<chave, Row[]>)
 * 2. Para cada registro da Base_2:
 *    a. Normalizar chave
 *    b. Se chave vazia → "Nota não encontrada" (aviso acumulado)
 *    c. Se chave não existe na Base_1 → "Nota não encontrada"
 *    d. Buscar ocorrência não-usada na Base_1 com mesmo valor normalizado
 *    e. Se encontrada → "De Acordo" + marcar como usada
 *    f. Se não encontrada → "Valor Divergente"
 * 3. Detectar chaves duplicadas na Base_1 e na Base_2 e emitir avisos
 */
export function reconcile(
  base1Rows: Row[],
  base2Rows: Row[],
  config: ReconciliationConfig
): ReconcileResult {
  const warnings: string[] = []

  // ── 1. Construir índice da Base_1 ──────────────────────────────────────
  // Map<keyNorm, Row[]> — múltiplas ocorrências por chave são permitidas
  const base1Index = new Map<string, Row[]>()

  for (const row of base1Rows) {
    const keyRaw = row[config.base1.keyField]
    if (keyRaw === null || keyRaw === undefined || keyRaw === '') continue

    const keyNorm = normalizeKey(keyRaw)
    if (!keyNorm) continue

    if (!base1Index.has(keyNorm)) {
      base1Index.set(keyNorm, [])
    }
    base1Index.get(keyNorm)!.push(row)
  }

  // ── Detectar chaves duplicadas na Base_1 (aviso, sem bloqueio) ──────────
  const duplicatedBase1Keys: string[] = []
  for (const [key, rows] of base1Index.entries()) {
    if (rows.length > 1) {
      duplicatedBase1Keys.push(key)
    }
  }
  if (duplicatedBase1Keys.length > 0) {
    warnings.push(
      `Chaves duplicadas na Base_1 detectadas (${duplicatedBase1Keys.length} chave(s)). ` +
      `O sistema usará anti-double-matching para evitar correspondências duplicadas.`
    )
  }

  // ── Detectar chaves duplicadas na Base_2 (aviso, sem bloqueio) ──────────
  const base2KeyCount = new Map<string, number>()
  for (const row of base2Rows) {
    const keyNorm = normalizeKey(row[config.base2.keyField])
    if (keyNorm) {
      base2KeyCount.set(keyNorm, (base2KeyCount.get(keyNorm) ?? 0) + 1)
    }
  }
  const duplicatedBase2Keys: string[] = []
  for (const [key, count] of base2KeyCount.entries()) {
    if (count > 1) duplicatedBase2Keys.push(key)
  }
  if (duplicatedBase2Keys.length > 0) {
    warnings.push(
      `Chaves duplicadas na Base_2 detectadas (${duplicatedBase2Keys.length} chave(s)). ` +
      `Cada linha é processada de forma independente.`
    )
  }

  // ── 2. Controle de anti-double-matching ────────────────────────────────
  // Para cada chave, rastreamos quais índices de Row já foram usados
  const usedIndices = new Map<string, Set<number>>()

  // ── 3. Construir visibleColumns ────────────────────────────────────────
  // A primeira coluna usa o nome do campo-chave da Base_2 como cabeçalho
  const visibleColumns: string[] = [
    config.base2.keyField,
    'Valor da Nota (Base_2)',
    'Valor da Nota (Base_1)',
    'Status',
    ...config.base2.selectedDisplayFields.map((f) => `base2:${f}`),
    ...config.base1.selectedDisplayFields.map((f) => `base1:${f}`),
  ]

  // ── 4. Processar cada registro da Base_2 ───────────────────────────────
  const records: ReconciliationRecord[] = []

  let deAcordo = 0
  let divergente = 0
  let naoEncontrada = 0
  let emptyKeyCount = 0

  for (const row2 of base2Rows) {
    const keyRaw2 = row2[config.base2.keyField]
    const keyNorm2 = normalizeKey(keyRaw2)
    const valueNorm2 = normalizeValue(row2[config.base2.valueColumn])

    // Coletar campos adicionais da Base_2
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
      records.push({
        keyValue: String(keyRaw2 ?? ''),
        valueBase2: valueNorm2,
        valueBase1: null,
        status: 'Nota não encontrada',
        displayFields,
      })
      naoEncontrada++
      continue
    }

    // Buscar ocorrências da Base_1 para essa chave
    const base1Occurrences = base1Index.get(keyNorm2)

    // Caso: chave não existe na Base_1
    if (!base1Occurrences || base1Occurrences.length === 0) {
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }
      records.push({
        keyValue: keyNorm2,
        valueBase2: valueNorm2,
        valueBase1: null,
        status: 'Nota não encontrada',
        displayFields,
      })
      naoEncontrada++
      continue
    }

    // Garantir rastreador de índices usados para esta chave
    if (!usedIndices.has(keyNorm2)) {
      usedIndices.set(keyNorm2, new Set())
    }
    const used = usedIndices.get(keyNorm2)!

    // Buscar ocorrência não usada com mesmo valor normalizado
    let matchedRow: Row | null = null
    let matchedIdx = -1

    for (let i = 0; i < base1Occurrences.length; i++) {
      if (used.has(i)) continue

      const valueNorm1 = normalizeValue(base1Occurrences[i][config.base1.valueColumn])
      if (valueNorm1 !== null && valueNorm2 !== null && valueNorm1 === valueNorm2) {
        matchedRow = base1Occurrences[i]
        matchedIdx = i
        break
      }
    }

    if (matchedRow !== null) {
      // De Acordo — marcar ocorrência como usada
      used.add(matchedIdx)

      const valueBase1 = normalizeValue(matchedRow[config.base1.valueColumn])

      // Campos adicionais da Base_1 — da ocorrência conciliada
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = matchedRow[field] ?? null
      }

      records.push({
        keyValue: keyNorm2,
        valueBase2: valueNorm2,
        valueBase1,
        status: 'De Acordo',
        displayFields,
      })
      deAcordo++
    } else {
      // Valor Divergente — chave existe mas nenhuma ocorrência disponível tem o mesmo valor
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }

      records.push({
        keyValue: keyNorm2,
        valueBase2: valueNorm2,
        valueBase1: null,
        status: 'Valor Divergente',
        displayFields,
      })
      divergente++
    }
  }

  // Emitir aviso de chaves vazias na Base_2
  if (emptyKeyCount > 0) {
    warnings.push(
      `${emptyKeyCount} linha(s) da Base_2 com campo-chave vazio foram tratadas como "Nota não encontrada".`
    )
  }

  const report: ReconciliationReport = {
    records,
    visibleColumns,
    summary: {
      total: records.length,
      deAcordo,
      divergente,
      naoEncontrada,
    },
    generatedAt: new Date(),
  }

  return { report, warnings }
}
