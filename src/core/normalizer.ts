/**
 * Normaliza uma chave de CNPJ: trim + lowercase.
 * Idempotente: normalizeKey(normalizeKey(v)) === normalizeKey(v)
 * Requisitos: 4.1, 4.2
 */
export function normalizeKey(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().toLowerCase()
}

/**
 * Normaliza um valor numérico com precisão de 2 casas decimais.
 * Retorna null para valores não conversíveis, NaN, Infinity ou undefined.
 * Nunca retorna NaN, Infinity, string ou undefined.
 * Requisitos: 4.3, 4.4
 */
export function normalizeValue(value: unknown): number | null {
  if (value === null || value === undefined) return null

  let num: number

  if (typeof value === 'number') {
    num = value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    let cleaned: string
    if (trimmed.includes(',')) {
      // Formato BR: "1.500,00" → remover pontos de milhar, trocar vírgula por ponto decimal
      cleaned = trimmed.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato padrão com ponto decimal: "1500.50"
      cleaned = trimmed
    }
    num = parseFloat(cleaned)
  } else {
    return null
  }

  if (!isFinite(num) || isNaN(num)) return null

  // Arredondar para 2 casas decimais
  return parseFloat(num.toFixed(2))
}
