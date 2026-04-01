import * as XLSX from 'xlsx'
import type { ReconciliationReport, ReconciliationStatus } from '../types'

// Cores de fundo por status (Excel hex ARGB)
const STATUS_FILL: Record<ReconciliationStatus, string> = {
  'De Acordo': 'FFC6EFCE',        // verde
  'Valor Divergente': 'FFFFEB9C',  // amarelo
  'Nota não encontrada': 'FFFFC7CE', // vermelho
}

/**
 * Gera e baixa o arquivo .xlsx do relatório.
 * Nome: relatorio_conciliacao_{DDMMYYYY}.xlsx
 * Requisitos: 10.1–10.6
 */
export function exportReport(report: ReconciliationReport): void {
  const wb = XLSX.utils.book_new()
  const ws = buildWorksheet(report)
  XLSX.utils.book_append_sheet(wb, ws, 'Conciliação')

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const filename = `relatorio_conciliacao_${dd}${mm}${yyyy}.xlsx`

  XLSX.writeFile(wb, filename)
}

/**
 * Constrói o worksheet com dados e formatação.
 * Exportado separadamente para facilitar testes de round-trip.
 */
export function buildWorksheet(report: ReconciliationReport): XLSX.WorkSheet {
  // ── Cabeçalhos ──────────────────────────────────────────────────────────
  const headers = buildHeaders(report.visibleColumns)

  // ── Linhas de dados ─────────────────────────────────────────────────────
  const rows: (string | number | null)[][] = report.records.map((rec) => {
    const row: (string | number | null)[] = [
      rec.cnpj,
      rec.valueBase2,
      rec.valueBase1,   // null será exibido como vazio; UI mostra "—"
      rec.status,
    ]

    // Campos adicionais na ordem de visibleColumns (após os 4 padrão)
    for (const col of report.visibleColumns.slice(4)) {
      row.push(rec.displayFields[col] ?? null)
    }

    return row
  })

  const aoa = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // ── Aplicar cores na coluna Status (índice 3, coluna D) ──────────────────
  applyStatusColors(ws, report)

  return ws
}

function buildHeaders(visibleColumns: string[]): string[] {
  // As 4 primeiras colunas têm labels fixos; o resto vem de visibleColumns[4+]
  const fixed = ['CNPJ', 'Valor da Nota (Base_2)', 'Valor da Nota (Base_1)', 'Status']
  const extra = visibleColumns.slice(4).map((col) => {
    // "base1:NomeColuna" → "NomeColuna (Base_1)"
    if (col.startsWith('base1:')) return `${col.slice(6)} (Base_1)`
    if (col.startsWith('base2:')) return `${col.slice(6)} (Base_2)`
    return col
  })
  return [...fixed, ...extra]
}

function applyStatusColors(ws: XLSX.WorkSheet, report: ReconciliationReport): void {
  // Coluna Status = índice 3 (D)
  const statusColIndex = 3

  report.records.forEach((rec, rowIndex) => {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: statusColIndex })
    const cell = ws[cellAddress]
    if (!cell) return

    const fill = STATUS_FILL[rec.status]
    cell.s = {
      fill: {
        patternType: 'solid',
        fgColor: { argb: fill },
      },
    }
  })
}
