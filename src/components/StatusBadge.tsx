import type { ReconciliationStatus } from '../types'

interface StatusBadgeProps {
  status: ReconciliationStatus
}

const CONFIG: Record<ReconciliationStatus, { label: string; className: string }> = {
  'De Acordo': {
    label: '✓ De Acordo',
    className: 'bg-green-100 text-green-800 border border-green-300',
  },
  'Valor Divergente': {
    label: '⚠ Valor Divergente',
    className: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  },
  'Nota não encontrada': {
    label: '✗ Nota não encontrada',
    className: 'bg-red-100 text-red-800 border border-red-300',
  },
}

/**
 * Badge colorido por status de conciliação.
 * Requisito 8.3
 */
export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = CONFIG[status]
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
