// Linha de dados genérica
export type Row = Record<string, string | number | null>;

// Arquivo carregado e parseado
export interface UploadedFile {
  name: string;
  sheets: string[];
  rawData: Record<string, Row[]>; // sheet name → rows
}

// Configuração por base
export interface BaseConfig {
  sheet: string;
  keyField: string;
  valueColumn: string;
  selectedDisplayFields: string[];
}

// Configuração da conciliação
export interface ReconciliationConfig {
  base1: BaseConfig;
  base2: BaseConfig;
}

// Status possíveis de um registro
export type ReconciliationStatus =
  | 'De Acordo'
  | 'Valor Divergente'
  | 'Nota não encontrada';

// Registro individual no relatório
export interface ReconciliationRecord {
  keyValue: string;
  valueBase2: number | null;
  /**
   * Valor da Nota da Base_1 para este registro.
   * - "De Acordo": preenchido com o valor da ocorrência conciliada.
   * - "Valor Divergente": null
   * - "Nota não encontrada": null
   * null é renderizado como "—" na UI e exportação.
   */
  valueBase1: number | null;
  status: ReconciliationStatus;
  // campos adicionais: chave = "base1:NomeColuna" ou "base2:NomeColuna"
  displayFields: Record<string, string | number | null>;
}

// Relatório completo
export interface ReconciliationReport {
  records: ReconciliationRecord[];
  visibleColumns: string[];
  summary: {
    total: number;
    deAcordo: number;
    divergente: number;
    naoEncontrada: number;
  };
  generatedAt: Date;
}

// Etapas do fluxo
export type AppStep = 'upload' | 'config' | 'processing' | 'report';

// Estado global da aplicação
export interface AppState {
  step: AppStep;
  base1: UploadedFile | null;
  base2: UploadedFile | null;
  config: ReconciliationConfig | null;
  report: ReconciliationReport | null;
  errors: Record<string, string>;
  warnings: string[];
}
