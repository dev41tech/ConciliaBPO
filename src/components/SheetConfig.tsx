import { useState } from 'react'
import { getSheetHeaders } from '../core/parser'
import type { UploadedFile, ReconciliationConfig, BaseConfig } from '../types'

interface SheetConfigProps {
  base1: UploadedFile
  base2: UploadedFile
  warnings: string[]
  onConfigured: (config: ReconciliationConfig) => void
}

interface BaseFormState {
  sheet: string
  keyField: string
  valueColumn: string
  selectedDisplayFields: string[]
  headers: string[]
  error: string | null
}

function emptyBase(file: UploadedFile): BaseFormState {
  const sheet = file.sheets[0] ?? ''
  const headers = sheet ? getSheetHeadersSafe(file, sheet) : []
  return {
    sheet,
    keyField: '',
    valueColumn: '',
    selectedDisplayFields: [],
    headers,
    error: null,
  }
}

function getSheetHeadersSafe(file: UploadedFile, sheet: string): string[] {
  try {
    return getSheetHeaders(file, sheet)
  } catch {
    return []
  }
}

/**
 * Tela de configuração: seleção de aba, colunas e campos adicionais.
 * Requisitos: 2.2, 2.3, 2.4, 3.1–3.7, 6.7
 */
export default function SheetConfig({ base1, base2, warnings, onConfigured }: SheetConfigProps) {
  const [b1, setB1] = useState<BaseFormState>(() => emptyBase(base1))
  const [b2, setB2] = useState<BaseFormState>(() => emptyBase(base2))

  // Validação de "mesma coluna para chave e valor"
  const b1ColError = b1.keyField && b1.valueColumn && b1.keyField === b1.valueColumn
    ? 'O campo-chave e a coluna de valor não podem ser iguais.'
    : null
  const b2ColError = b2.keyField && b2.valueColumn && b2.keyField === b2.valueColumn
    ? 'O campo-chave e a coluna de valor não podem ser iguais.'
    : null

  const canProceed =
    b1.sheet && b1.keyField && b1.valueColumn &&
    b2.sheet && b2.keyField && b2.valueColumn &&
    !b1ColError && !b2ColError

  function handleSheetChange(base: 'b1' | 'b2', sheet: string) {
    const file = base === 'b1' ? base1 : base2
    const headers = getSheetHeadersSafe(file, sheet)
    const setState = base === 'b1' ? setB1 : setB2
    setState((prev) => ({
      ...prev,
      sheet,
      headers,
      keyField: '',
      valueColumn: '',
      selectedDisplayFields: [],
      error: headers.length === 0 ? 'A aba selecionada não contém dados ou cabeçalhos.' : null,
    }))
  }

  function handleDisplayFieldToggle(base: 'b1' | 'b2', field: string) {
    const setState = base === 'b1' ? setB1 : setB2
    setState((prev) => {
      const already = prev.selectedDisplayFields.includes(field)
      return {
        ...prev,
        selectedDisplayFields: already
          ? prev.selectedDisplayFields.filter((f) => f !== field)
          : [...prev.selectedDisplayFields, field],
      }
    })
  }

  function handleSubmit() {
    if (!canProceed) return

    const config: ReconciliationConfig = {
      base1: toBaseConfig(b1),
      base2: toBaseConfig(b2),
    }
    onConfigured(config)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Configurar Conciliação</h2>

      {/* Avisos de CNPJs duplicados */}
      {warnings.map((w, i) => (
        <div key={i} className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-sm text-yellow-800">
          ⚠ {w}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-8 mb-8">
        <BaseConfigPanel
          label="BASE 1 (Referência)"
          file={base1}
          state={b1}
          colError={b1ColError}
          onSheetChange={(s) => handleSheetChange('b1', s)}
          onKeyFieldChange={(v) => setB1((p) => ({ ...p, keyField: v }))}
          onValueChange={(v) => setB1((p) => ({ ...p, valueColumn: v }))}
          onDisplayFieldToggle={(f) => handleDisplayFieldToggle('b1', f)}
        />
        <BaseConfigPanel
          label="BASE 2 (A validar)"
          file={base2}
          state={b2}
          colError={b2ColError}
          onSheetChange={(s) => handleSheetChange('b2', s)}
          onKeyFieldChange={(v) => setB2((p) => ({ ...p, keyField: v }))}
          onValueChange={(v) => setB2((p) => ({ ...p, valueColumn: v }))}
          onDisplayFieldToggle={(f) => handleDisplayFieldToggle('b2', f)}
        />
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Regra de conciliação: Chave de comparação + Valor da Nota. Campos adicionais não participam da comparação.
      </p>

      <div className="flex justify-end">
        <button
          disabled={!canProceed}
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:bg-blue-700 transition-colors"
        >
          Conciliar →
        </button>
      </div>
    </div>
  )
}

// ── Painel de configuração de uma base ────────────────────────────────────────

interface BaseConfigPanelProps {
  label: string
  file: UploadedFile
  state: BaseFormState
  colError: string | null
  onSheetChange: (sheet: string) => void
  onKeyFieldChange: (col: string) => void
  onValueChange: (col: string) => void
  onDisplayFieldToggle: (field: string) => void
}

function BaseConfigPanel({
  label, file, state, colError,
  onSheetChange, onKeyFieldChange, onValueChange, onDisplayFieldToggle,
}: BaseConfigPanelProps) {
  // Colunas disponíveis para campos adicionais (excluindo chave e valor já selecionados)
  const displayHeaders = state.headers.filter(
    (h) => h !== state.keyField && h !== state.valueColumn
  )

  return (
    <div>
      <h3 className="font-semibold text-gray-600 mb-3">{label}</h3>
      <p className="text-xs text-gray-400 mb-3">{file.name}</p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Aba</label>
          <select
            value={state.sheet}
            onChange={(e) => onSheetChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md text-sm px-2 py-1.5"
          >
            {file.sheets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {state.error && (
            <p className="text-xs text-red-600 mt-1">{state.error}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Campo-chave de comparação</label>
          <select
            value={state.keyField}
            onChange={(e) => onKeyFieldChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md text-sm px-2 py-1.5"
          >
            <option value="">— Selecione —</option>
            {state.headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Coluna de Valor da Nota</label>
          <select
            value={state.valueColumn}
            onChange={(e) => onValueChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md text-sm px-2 py-1.5"
          >
            <option value="">— Selecione —</option>
            {state.headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        {colError && (
          <p className="text-xs text-red-600">{colError}</p>
        )}

        {displayHeaders.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Campos adicionais para o relatório
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
              {displayHeaders.map((h) => (
                <label key={h} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.selectedDisplayFields.includes(h)}
                    onChange={() => onDisplayFieldToggle(h)}
                    className="accent-blue-600"
                  />
                  {h}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function toBaseConfig(state: BaseFormState): BaseConfig {
  return {
    sheet: state.sheet,
    keyField: state.keyField,
    valueColumn: state.valueColumn,
    selectedDisplayFields: state.selectedDisplayFields,
  }
}
