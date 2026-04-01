import * as XLSX from 'xlsx'
import type { UploadedFile, Row } from '../types'

/**
 * Lê um arquivo Excel e retorna suas abas e dados.
 * Lança erro com mensagem amigável para arquivos corrompidos ou ilegíveis.
 * Requisitos: 1.5, 2.1, 2.3, 2.4
 */
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo. Verifique se ele está corrompido.'))
    reader.readAsArrayBuffer(file)
  })
}

export async function parseFile(file: File): Promise<UploadedFile> {
  const buffer = await readAsArrayBuffer(file)

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    throw new Error('Não foi possível ler o arquivo. Verifique se ele está corrompido.')
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Não foi possível ler o arquivo. Verifique se ele está corrompido.')
  }

  const rawData: Record<string, Row[]> = {}

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    // defval: null → células vazias viram null
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null })
    rawData[sheetName] = rows
  }

  return {
    name: file.name,
    sheets: workbook.SheetNames,
    rawData,
  }
}

/**
 * Retorna os cabeçalhos (primeira linha) de uma aba do arquivo parseado.
 * Lança erro se a aba estiver vazia ou sem cabeçalhos.
 * Requisitos: 2.3, 2.4
 */
export function getSheetHeaders(uploadedFile: UploadedFile, sheet: string): string[] {
  const rows = uploadedFile.rawData[sheet]

  if (!rows || rows.length === 0) {
    throw new Error('A aba selecionada não contém dados ou cabeçalhos.')
  }

  const headers = Object.keys(rows[0])

  if (headers.length === 0) {
    throw new Error('A aba selecionada não contém dados ou cabeçalhos.')
  }

  return headers
}
