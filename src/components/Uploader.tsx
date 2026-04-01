import { useRef, useState } from 'react'
import { parseFile } from '../core/parser'
import type { UploadedFile } from '../types'

const MAX_SIZE_MB = 20
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
const VALID_EXTENSIONS = ['.xls', '.xlsx']

interface UploaderProps {
  onFileParsed: (base: 'base1' | 'base2', file: UploadedFile) => void
  onError: (base: 'base1' | 'base2', message: string) => void
}

interface FileState {
  name: string | null
  error: string | null
  loading: boolean
}

const emptyFileState: FileState = { name: null, error: null, loading: false }

/**
 * Componente de upload dos dois arquivos Excel.
 * Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export default function Uploader({ onFileParsed, onError }: UploaderProps) {
  const [base1State, setBase1State] = useState<FileState>(emptyFileState)
  const [base2State, setBase2State] = useState<FileState>(emptyFileState)

  const input1Ref = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>
  const input2Ref = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>

  const bothOk = base1State.name !== null && base2State.name !== null &&
    !base1State.error && !base2State.error &&
    !base1State.loading && !base2State.loading

  async function handleFile(base: 'base1' | 'base2', file: File) {
    const setState = base === 'base1' ? setBase1State : setBase2State

    // Validação de extensão
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!VALID_EXTENSIONS.includes(ext)) {
      const msg = 'Formato inválido. Envie um arquivo .xls ou .xlsx.'
      setState({ name: null, error: msg, loading: false })
      onError(base, msg)
      return
    }

    // Validação de tamanho
    if (file.size > MAX_SIZE_BYTES) {
      const msg = 'Arquivo muito grande. O limite é 20MB.'
      setState({ name: null, error: msg, loading: false })
      onError(base, msg)
      return
    }

    setState({ name: null, error: null, loading: true })

    try {
      const parsed = await parseFile(file)
      setState({ name: file.name, error: null, loading: false })
      onFileParsed(base, parsed)
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : 'Não foi possível ler o arquivo. Verifique se ele está corrompido.'
      setState({ name: null, error: msg, loading: false })
      onError(base, msg)
    }
  }

  function handleChange(base: 'base1' | 'base2', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(base, file)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Upload das Bases Excel</h2>

      <div className="grid grid-cols-2 gap-6">
        <FileCard
          label="BASE 1 (Referência)"
          state={base1State}
          inputRef={input1Ref}
          onChange={(e) => handleChange('base1', e)}
        />
        <FileCard
          label="BASE 2 (A validar)"
          state={base2State}
          inputRef={input2Ref}
          onChange={(e) => handleChange('base2', e)}
        />
      </div>

      <div className="mt-8 flex justify-end">
        <button
          disabled={!bothOk}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:bg-blue-700 transition-colors"
          onClick={() => { /* handled by parent via onFileParsed */ }}
        >
          Próximo →
        </button>
      </div>
    </div>
  )
}

interface FileCardProps {
  label: string
  state: FileState
  inputRef: React.RefObject<HTMLInputElement>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function FileCard({ label, state, inputRef, onChange }: FileCardProps) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <p className="text-sm font-semibold text-gray-600 mb-3">{label}</p>

      {state.loading ? (
        <p className="text-sm text-blue-500">Lendo arquivo...</p>
      ) : state.name ? (
        <p className="text-sm text-green-600 font-medium">✓ {state.name}</p>
      ) : (
        <button
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm
            text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          Selecionar arquivo
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        className="hidden"
        onChange={onChange}
      />

      {state.error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}

      {state.name && !state.loading && (
        <button
          className="mt-2 text-xs text-gray-400 underline"
          onClick={() => inputRef.current?.click()}
        >
          Trocar arquivo
        </button>
      )}
    </div>
  )
}
