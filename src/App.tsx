import { useReducer } from 'react'
import Uploader from './components/Uploader'
import SheetConfig from './components/SheetConfig'
import ReportTable from './components/ReportTable'
import { reconcile } from './core/reconciliationEngine'
import type {
  AppState,
  UploadedFile,
  ReconciliationConfig,
  ReconciliationReport,
} from './types'

// ── Actions ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_BASE'; base: 'base1' | 'base2'; file: UploadedFile }
  | { type: 'SET_ERROR'; key: string; message: string }
  | { type: 'GO_CONFIG' }
  | { type: 'SET_REPORT'; report: ReconciliationReport; warnings: string[] }
  | { type: 'RESET' }

const initialState: AppState = {
  step: 'upload',
  base1: null,
  base2: null,
  config: null,
  report: null,
  errors: {},
  warnings: [],
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BASE':
      return { ...state, [action.base]: action.file }
    case 'SET_ERROR':
      return { ...state, errors: { ...state.errors, [action.key]: action.message } }
    case 'GO_CONFIG':
      return { ...state, step: 'config' }
    case 'SET_REPORT':
      return {
        ...state,
        step: 'report',
        report: action.report,
        warnings: action.warnings,
      }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const bothBasesParsed = state.base1 !== null && state.base2 !== null

  function handleFileParsed(base: 'base1' | 'base2', file: UploadedFile) {
    dispatch({ type: 'SET_BASE', base, file })
  }

  function handleFileError(base: 'base1' | 'base2', message: string) {
    dispatch({ type: 'SET_ERROR', key: base, message })
  }

  function handleConfigured(config: ReconciliationConfig) {
    const base1Rows = state.base1!.rawData[config.base1.sheet] ?? []
    const base2Rows = state.base2!.rawData[config.base2.sheet] ?? []

    const { report, warnings } = reconcile(base1Rows, base2Rows, config)
    dispatch({ type: 'SET_REPORT', report, warnings })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — iframe-friendly: sem links externos ou navegação */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-gray-800">Conciliação de Bases Excel</h1>
      </header>

      <main className="px-6 py-8">
        {/* Passo 1: Upload */}
        {state.step === 'upload' && (
          <div>
            <Uploader
              onFileParsed={handleFileParsed}
              onError={handleFileError}
            />
            {bothBasesParsed && (
              <div className="max-w-2xl mx-auto mt-6 flex justify-end">
                <button
                  onClick={() => dispatch({ type: 'GO_CONFIG' })}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium
                    hover:bg-blue-700 transition-colors"
                >
                  Próximo →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Passo 2: Configuração */}
        {state.step === 'config' && state.base1 && state.base2 && (
          <SheetConfig
            base1={state.base1}
            base2={state.base2}
            warnings={state.warnings}
            onConfigured={handleConfigured}
          />
        )}

        {/* Passo 3: Processando (spinner — reconcile é síncrono no MVP) */}
        {state.step === 'processing' && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto mb-3" />
              <p className="text-gray-600">Processando conciliação...</p>
            </div>
          </div>
        )}

        {/* Passo 4: Relatório */}
        {state.step === 'report' && state.report && (
          <ReportTable
            report={state.report}
            onReset={() => dispatch({ type: 'RESET' })}
          />
        )}
      </main>
    </div>
  )
}
