import { useState } from 'react'
import StatusBadge from './StatusBadge'
import { exportReport } from '../core/exporter'
import type { ReconciliationReport, ReconciliationStatus } from '../types'

type Filter = 'Todos' | ReconciliationStatus

const PAGE_SIZE = 100
const PAGINATION_THRESHOLD = 500

interface ReportTableProps {
  report: ReconciliationReport
  onReset: () => void
}

const ROW_BG: Record<ReconciliationStatus, string> = {
  'De Acordo': 'bg-green-50',
  'Valor Divergente': 'bg-yellow-50',
  'Nota não encontrada': 'bg-red-50',
}

/**
 * Exibe o relatório em tabela paginada com filtros por status.
 * Requisitos: 8.1–8.5, 9.1–9.4, 10.1–10.6, 11.4
 */
export default function ReportTable({ report, onReset }: ReportTableProps) {
  const [filter, setFilter] = useState<Filter>('Todos')
  const [page, setPage] = useState(1)

  // Filtrar registros
  const filtered = filter === 'Todos'
    ? report.records
    : report.records.filter((r) => r.status === filter)

  // Resumo dos registros visíveis (requisito 9.4)
  const visibleSummary = {
    deAcordo: filtered.filter((r) => r.status === 'De Acordo').length,
    divergente: filtered.filter((r) => r.status === 'Valor Divergente').length,
    naoEncontrada: filtered.filter((r) => r.status === 'Nota não encontrada').length,
  }

  // Paginação: apenas quando > 500 registros (requisito 8.4)
  const usePagination = filtered.length > PAGINATION_THRESHOLD
  const totalPages = usePagination ? Math.ceil(filtered.length / PAGE_SIZE) : 1
  const paginated = usePagination
    ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filtered

  function handleFilterChange(f: Filter) {
    setFilter(f)
    setPage(1)
  }

  // Colunas adicionais (após as 4 padrão)
  const extraColumns = report.visibleColumns.slice(4)

  return (
    <div className="max-w-full">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Relatório de Conciliação</h2>

      {/* Resumo */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-green-700 font-medium">✅ De Acordo: {visibleSummary.deAcordo}</span>
        <span className="text-yellow-700 font-medium">⚠ Divergente: {visibleSummary.divergente}</span>
        <span className="text-red-700 font-medium">❌ Não encontrada: {visibleSummary.naoEncontrada}</span>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['Todos', 'De Acordo', 'Valor Divergente', 'Nota não encontrada'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
              ${filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          Nenhum registro encontrado para o filtro selecionado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">CNPJ</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Valor (Base_2)</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Valor (Base_1)</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                {extraColumns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                    {formatColHeader(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((rec, i) => (
                <tr key={i} className={ROW_BG[rec.status]}>
                  <td className="px-3 py-2 font-mono text-xs">{rec.cnpj || '—'}</td>
                  <td className="px-3 py-2 text-right">{formatValue(rec.valueBase2)}</td>
                  <td className="px-3 py-2 text-right">{formatValue(rec.valueBase1)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={rec.status} />
                  </td>
                  {extraColumns.map((col) => (
                    <td key={col} className="px-3 py-2 text-xs text-gray-600">
                      {formatCell(rec.displayFields[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {usePagination && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100"
          >
            ← Anterior
          </button>
          <span className="text-gray-600">Página {page} de {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100"
          >
            Próximo →
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="mt-6 flex gap-3 justify-center">
        <button
          onClick={() => exportReport(report)}
          className="px-5 py-2 bg-green-600 text-white rounded-md font-medium
            hover:bg-green-700 transition-colors text-sm"
        >
          📥 Exportar Excel
        </button>
        <button
          onClick={onReset}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-md font-medium
            hover:bg-gray-200 transition-colors text-sm"
        >
          + Nova Conciliação
        </button>
      </div>
    </div>
  )
}

function formatValue(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return String(v)
}

function formatColHeader(col: string): string {
  if (col.startsWith('base1:')) return `${col.slice(6)} (Base_1)`
  if (col.startsWith('base2:')) return `${col.slice(6)} (Base_2)`
  return col
}
