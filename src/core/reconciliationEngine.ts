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
 * 1. Indexar Base_1 por CNPJ normalizado (Map<cnpj, Row[]>)
 * 2. Para cada registro da Base_2:
 *    a. Normalizar CNPJ
 *    b. Se CNPJ vazio → "Nota não encontrada"
 *    c. Se CNPJ não existe na Base_1 → "Nota não encontrada"
 *    d. Buscar ocorrência não-usada na Base_1 com mesmo valor normalizado
 *    e. Se encontrada → "De Acordo" + marcar como usada
 *    f. Se não encontrada → "Valor Divergente"
 * 3. Detectar CNPJs duplicados na Base_1 e emitir aviso
 *
 * Requisitos: 5.1–5.5, 6.1–6.7, 7.1–7.5
 */
export function reconcile(
  base1Rows: Row[],
  base2Rows: Row[],
  config: ReconciliationConfig
): ReconcileResult {
  const warnings: string[] = []

  // ── 1. Construir índice da Base_1 ──────────────────────────────────────
  // Map<cnpjNorm, Row[]> — múltiplas ocorrências por CNPJ são permitidas
  const base1Index = new Map<string, Row[]>()

  for (const row of base1Rows) {
    const cnpjRaw = row[config.base1.cnpjColumn]
    if (cnpjRaw === null || cnpjRaw === undefined || cnpjRaw === '') continue

    const cnpjNorm = normalizeKey(cnpjRaw)
    if (!cnpjNorm) continue

    if (!base1Index.has(cnpjNorm)) {
      base1Index.set(cnpjNorm, [])
    }
    base1Index.get(cnpjNorm)!.push(row)
  }

  // ── Detectar CNPJs duplicados na Base_1 (aviso, sem bloqueio) ──────────
  const duplicatedCnpjs: string[] = []
  for (const [cnpj, rows] of base1Index.entries()) {
    if (rows.length > 1) {
      duplicatedCnpjs.push(cnpj)
    }
  }
  if (duplicatedCnpjs.length > 0) {
    warnings.push(
      `CNPJs duplicados na Base_1 detectados (${duplicatedCnpjs.length} CNPJ(s)). ` +
      `O sistema usará anti-double-matching para evitar correspondências duplicadas.`
    )
  }

  // ── 2. Controle de anti-double-matching ────────────────────────────────
  // Para cada CNPJ, rastreamos quais índices de Row já foram usados
  const usedIndices = new Map<string, Set<number>>()

  // ── 3. Construir visibleColumns ────────────────────────────────────────
  const visibleColumns: string[] = [
    'CNPJ',
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

  for (const row2 of base2Rows) {
    const cnpjRaw2 = row2[config.base2.cnpjColumn]
    const cnpjNorm2 = normalizeKey(cnpjRaw2)
    const valueNorm2 = normalizeValue(row2[config.base2.valueColumn])

    // Coletar campos adicionais da Base_2
    const displayFields: Record<string, string | number | null> = {}
    for (const field of config.base2.selectedDisplayFields) {
      displayFields[`base2:${field}`] = row2[field] ?? null
    }

    // Caso: CNPJ vazio na Base_2
    if (!cnpjNorm2) {
      // Campos adicionais da Base_1: não há match, preencher null
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }
      records.push({
        cnpj: String(cnpjRaw2 ?? ''),
        valueBase2: valueNorm2,
        valueBase1: null,
        status: 'Nota não encontrada',
        displayFields,
      })
      naoEncontrada++
      continue
    }

    // Buscar ocorrências da Base_1 para esse CNPJ
    const base1Occurrences = base1Index.get(cnpjNorm2)

    // Caso: CNPJ não existe na Base_1
    if (!base1Occurrences || base1Occurrences.length === 0) {
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }
      records.push({
        cnpj: cnpjNorm2,
        valueBase2: valueNorm2,
        valueBase1: null,
        status: 'Nota não encontrada',
        displayFields,
      })
      naoEncontrada++
      continue
    }

    // Garantir rastreador de índices usados para este CNPJ
    if (!usedIndices.has(cnpjNorm2)) {
      usedIndices.set(cnpjNorm2, new Set())
    }
    const used = usedIndices.get(cnpjNorm2)!

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
        cnpj: cnpjNorm2,
        valueBase2: valueNorm2,
        valueBase1,
        status: 'De Acordo',
        displayFields,
      })
      deAcordo++
    } else {
      // Valor Divergente — CNPJ existe mas nenhuma ocorrência disponível tem o mesmo valor
      for (const field of config.base1.selectedDisplayFields) {
        displayFields[`base1:${field}`] = null
      }

      records.push({
        cnpj: cnpjNorm2,
        valueBase2: valueNorm2,
        valueBase1: null,
        status: 'Valor Divergente',
        displayFields,
      })
      divergente++
    }
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
