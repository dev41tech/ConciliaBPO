# Plano de Implementação: Excel Reconciliation

## Visão Geral

Implementação incremental de uma SPA React + TypeScript para conciliação de bases Excel, organizada em camadas: setup do projeto → módulos core (parser, normalizer, engine, exporter) → componentes de UI → integração e relatório final.

## Tarefas

- [ ] 1. Setup do projeto e estrutura base
  - Inicializar projeto com Vite + React + TypeScript
  - Configurar TailwindCSS e shadcn/ui
  - Instalar dependências: `xlsx` (SheetJS), `fast-check` (testes PBT), `vitest`, `@testing-library/react`
  - Criar estrutura de diretórios: `src/core/`, `src/components/`, `src/types/`
  - Definir todos os tipos e interfaces em `src/types/index.ts`: `UploadedFile`, `Row`, `ReconciliationConfig`, `BaseConfig`, `ReconciliationStatus`, `ReconciliationRecord`, `ReconciliationReport`, `AppState`, `AppStep`
  - Criar `src/App.tsx` com máquina de estados simples (`upload` → `config` → `processing` → `report`)
  - _Requisitos: 1.1, 2.1, 3.1, 8.1, 11.4_

- [ ] 2. Módulo Normalizer
  - [ ] 2.1 Implementar `src/core/normalizer.ts`
    - Implementar `normalizeKey(value: unknown): string` — trim + lowercase
    - Implementar `normalizeValue(value: unknown): number | null` — conversão numérica com 2 casas decimais, retorna `null` para valores não conversíveis
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.2 Escrever teste de propriedade para `normalizeKey` (Property 2)
    - **Property 2: Normalização de chave é idempotente**
    - **Validates: Requisitos 4.1, 4.2**
    - Usar `fc.string()` e `fc.unicodeString()` para gerar entradas arbitrárias
    - Verificar: `normalizeKey(normalizeKey(v)) === normalizeKey(v)` para qualquer `v`
    - Verificar: resultado não contém espaços nas bordas e está em minúsculas

  - [ ]* 2.3 Escrever teste de propriedade para `normalizeValue` (Property 3)
    - **Property 3: Normalização de valor produz número ou nulo**
    - **Validates: Requisitos 4.3, 4.4**
    - Usar `fc.anything()` para gerar entradas arbitrárias
    - Verificar: resultado é `null` ou número finito com no máximo 2 casas decimais
    - Verificar: nunca retorna `NaN`, `Infinity`, string ou `undefined`

- [ ] 3. Módulo Parser
  - [ ] 3.1 Implementar `src/core/parser.ts`
    - Implementar `parseFile(file: File): Promise<UploadedFile>` usando SheetJS
    - Implementar `getSheetHeaders(uploadedFile: UploadedFile, sheet: string): string[]`
    - Tratar arquivo corrompido/ilegível lançando erro com mensagem adequada
    - Tratar aba vazia ou sem cabeçalhos lançando erro com mensagem adequada
    - _Requisitos: 1.5, 2.1, 2.3, 2.4_

  - [ ]* 3.2 Escrever teste de propriedade para o parser (Property 4)
    - **Property 4: Parser extrai abas e cabeçalhos corretamente**
    - **Validates: Requisitos 2.1, 2.3**
    - Usar `fc.array(fc.string({ minLength: 1 }))` para gerar nomes de abas e colunas
    - Construir workbooks sintéticos com SheetJS e verificar que o parser retorna exatamente as abas e cabeçalhos esperados

- [ ] 4. Módulo ReconciliationEngine
  - [ ] 4.1 Implementar `src/core/reconciliationEngine.ts`
    - Implementar `reconcile(base1Rows: Row[], base2Rows: Row[], config: ReconciliationConfig): ReconciliationReport`
    - Indexar Base_1 por CNPJ normalizado em `Map<string, Row[]>`
    - Para cada registro da Base_2: normalizar CNPJ → buscar ocorrências não usadas na Base_1 → comparar valor normalizado → atribuir status e `valueBase1` conforme regras
    - Implementar anti-double-matching: marcar ocorrência da Base_1 como usada após match
    - Preencher `valueBase1`: valor da ocorrência conciliada se "De Acordo", `null` se "Valor Divergente" ou "Nota não encontrada"
    - Calcular `summary` (total, deAcordo, divergente, naoEncontrada)
    - Detectar CNPJs duplicados na Base_1 e retornar lista de avisos
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 4.2 Escrever teste de propriedade — todo registro da Base_2 aparece no relatório (Property 5)
    - **Property 5: Todo registro válido da Base_2 aparece no relatório**
    - **Validates: Requisitos 5.3, 7.3**
    - Usar `fc.array(rowArbitrary)` para gerar registros arbitrários da Base_2
    - Verificar: `report.records.length === base2Rows.length`

  - [ ]* 4.3 Escrever teste de propriedade — status exaustivo, semântico e anti-double-matching (Property 6)
    - **Property 6: Status exaustivo, mutuamente exclusivo e semanticamente correto com anti-double-matching**
    - **Validates: Requisitos 6.4, 6.5, 6.6, 7.1**
    - Usar `fc.array(rowArbitrary)` x2 com CNPJs repetidos
    - Verificar: cada registro tem exatamente um dos três status
    - Verificar: uma ocorrência da Base_1 não é usada em dois matches simultâneos

  - [ ]* 4.4 Escrever teste de propriedade — campos adicionais não afetam status (Property 7)
    - **Property 7: Campos adicionais não afetam o status**
    - **Validates: Requisitos 3.5, 7.2**
    - Usar `fc.array(fc.string())` para variar `selectedDisplayFields`
    - Verificar: o `status` de cada registro é idêntico independentemente dos campos adicionais selecionados

  - [ ]* 4.5 Escrever teste de propriedade — completude de matching com múltiplas ocorrências (Property 8)
    - **Property 8: Completude de matching com múltiplas ocorrências**
    - **Validates: Requisitos 5.2, 5.3, 6.2, 6.3**
    - Usar `fc.array(rowArbitrary)` com CNPJs repetidos em ambas as bases
    - Verificar: cada ocorrência da Base_2 gera linha independente; matching considera todas as ocorrências disponíveis

  - [ ]* 4.6 Escrever teste de propriedade — valueBase1 preenchido conforme status (Property 13)
    - **Property 13: valueBase1 é preenchido corretamente conforme o status**
    - **Validates: Requisitos 7.4, 8.5**
    - Verificar: `valueBase1 !== null` se e somente se `status === 'De Acordo'`
    - Verificar: `valueBase1 === null` para "Valor Divergente" e "Nota não encontrada"

    - [ ] 4.7 Implementar montagem dinâmica das colunas do relatório
  - Construir `visibleColumns` na ordem definida pelo requirements:
    CNPJ, Valor da Nota (Base_2), Valor da Nota (Base_1), Status + campos adicionais
  - Preservar a origem dos campos adicionais selecionados pelo usuário
  - Resolver nomes duplicados de colunas entre Base_1 e Base_2 com rótulos explícitos
  - Garantir consistência entre engine, tabela e exportação
  - _Requisitos: 3.4, 3.7, 7.5, 10.2, 10.3_

  - [ ] 4.8 Definir estratégia de warnings e metadados do processamento
  - Decidir se avisos como CNPJs duplicados ficarão em `AppState` ou em `ReconciliationReport`
  - Padronizar estrutura de warnings para consumo pela UI
  - Garantir que avisos não alterem o resultado da conciliação
  - _Requisitos: 5.1, 6.7_

- [ ] 5. Checkpoint — Verificar módulos core
  - Garantir que todos os testes dos módulos `normalizer`, `parser` e `reconciliationEngine` passam.
  - Verificar que os tipos TypeScript estão consistentes entre os módulos.
  - Perguntar ao usuário se há dúvidas antes de prosseguir para a UI.

- [ ] 6. Módulo Exporter
  - [ ] 6.1 Implementar `src/core/exporter.ts`
    - Implementar `exportReport(report: ReconciliationReport): void`
    - Gerar arquivo `.xlsx` com SheetJS contendo todos os registros (independente de filtro ativo)
    - Colunas na ordem: CNPJ, Valor da Nota (Base_2), Valor da Nota (Base_1), Status + campos adicionais
    - Aplicar cor de fundo na coluna Status: verde (#C6EFCE) para "De Acordo", amarelo (#FFEB9C) para "Valor Divergente", vermelho (#FFC7CE) para "Nota não encontrada"
    - Nome do arquivo: `relatorio_conciliacao_{DDMMYYYY}.xlsx`
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 6.2 Escrever teste de propriedade — round-trip de exportação (Property 9)
    - **Property 9: Round-trip de exportação preserva dados e formato de colunas**
    - **Validates: Requisitos 10.1, 10.2, 10.3**
    - Usar `reportArbitrary` para gerar relatórios arbitrários
    - Exportar para buffer em memória com SheetJS, re-importar e verificar: mesmo número de registros, mesma ordem de colunas, valores equivalentes

- [ ] 7. Componente Uploader
  - [ ] 7.1 Implementar `src/components/Uploader.tsx`
    - Renderizar dois inputs de arquivo (Base_1 e Base_2) com labels claros
    - Validar formato (`.xls`/`.xlsx`) antes de acionar o parser — exibir "Formato inválido. Envie um arquivo .xls ou .xlsx." se inválido
    - Validar tamanho (≤ 20MB) — exibir "Arquivo muito grande. O limite é 20MB." se excedido
    - Exibir erros inline abaixo de cada input
    - Habilitar botão "Próximo" apenas quando ambos os uploads forem bem-sucedidos
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 7.2 Escrever teste de propriedade — validação de formato e tamanho (Property 1)
    - **Property 1: Validação de formato e tamanho de arquivo**
    - **Validates: Requisitos 1.1, 1.2, 1.3**
    - Usar `fc.string()` para gerar extensões arbitrárias e `fc.integer()` para tamanhos
    - Verificar: arquivos com extensão diferente de `.xls`/`.xlsx` são sempre rejeitados
    - Verificar: arquivos com tamanho > 20MB são sempre rejeitados sem tentar parsear

- [ ] 8. Componente SheetConfig
  - [ ] 8.1 Implementar `src/components/SheetConfig.tsx`
    - Exibir selects de aba para Base_1 e Base_2
    - Ao selecionar aba, carregar cabeçalhos via `getSheetHeaders` e exibir selects de CNPJ e Valor da Nota
    - Exibir checkboxes para seleção de campos adicionais (Base_1 e Base_2 separados)
    - Validar: CNPJ e Valor da Nota não podem ser a mesma coluna — exibir "A coluna de CNPJ e a coluna de valor não podem ser iguais."
    - Habilitar botão "Conciliar" apenas quando todas as seleções obrigatórias estiverem preenchidas e sem erros de validação
    - Exibir banner de aviso (amarelo) quando CNPJs duplicados forem detectados na Base_1
    - _Requisitos: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.6, 5.1, 6.7_

- [ ] 9. Componente ReportTable e StatusBadge
  - [ ] 9.1 Implementar `src/components/StatusBadge.tsx`
    - Renderizar badge colorido: verde para "De Acordo", amarelo para "Valor Divergente", vermelho para "Nota não encontrada"
    - _Requisitos: 8.3_

  - [ ] 9.2 Implementar `src/components/ReportTable.tsx`
    - Exibir resumo de contagem por status no topo (total, deAcordo, divergente, naoEncontrada)
    - Exibir filtros de status: "Todos", "De Acordo", "Valor Divergente", "Nota não encontrada"
    - Renderizar tabela com colunas na ordem: CNPJ, Valor da Nota (Base_2), Valor da Nota (Base_1), Status + campos adicionais
    - Exibir `—` para `valueBase1 === null`
    - Aplicar cor de fundo por status nas linhas
    - Implementar paginação: 100 registros por página quando total > 500
    - Atualizar resumo de contagem ao filtrar
    - Botões "Exportar Excel" e "Nova Conciliação"
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 11.4_

  - [ ]* 9.3 Escrever teste de propriedade — resumo consistente com registros visíveis (Property 10)
    - **Property 10: Resumo é consistente com os registros visíveis**
    - **Validates: Requisitos 8.2, 9.4**
    - Usar `reportArbitrary` e `fc.constantFrom('De Acordo', 'Valor Divergente', 'Nota não encontrada', 'Todos')`
    - Verificar: soma dos contadores do resumo === número de registros visíveis com o filtro ativo

  - [ ]* 9.4 Escrever teste de propriedade — filtro retorna apenas registros corretos (Property 11)
    - **Property 11: Filtro por status retorna apenas registros corretos**
    - **Validates: Requisitos 9.2, 9.3**
    - Verificar: todos os registros visíveis têm exatamente o status filtrado
    - Verificar: filtro "Todos" exibe todos os registros sem exceção

  - [ ]* 9.5 Escrever teste de propriedade — paginação correta para relatórios grandes (Property 12)
    - **Property 12: Paginação é correta para relatórios grandes**
    - **Validates: Requisito 8.4**
    - Usar `fc.integer({ min: 501, max: 10000 })` para gerar N registros
    - Verificar: número de páginas === `Math.ceil(N / 100)`
    - Verificar: cada página tem no máximo 100 registros
    - Verificar: união de todas as páginas contém exatamente os N registros sem duplicatas

- [ ] 10. Indicador de progresso e integração final
  - [ ] 10.1 Implementar indicador de progresso durante processamento
    - Exibir spinner/loading visível ao usuário enquanto `reconcile` está em execução
    - Ocultar indicador ao concluir e exibir o relatório
    - _Requisitos: 11.1, 11.3_

  - [ ] 10.2 Integrar todos os componentes em `src/App.tsx`
    - Conectar fluxo completo: `upload` → `config` → `processing` → `report`
    - Passar callbacks e estado entre `Uploader`, `SheetConfig`, `ReportTable`
    - Implementar "Nova Conciliação": resetar estado para `upload` sem recarregar a página
    - Garantir compatibilidade com iframe (sem uso de `window.top`/`window.parent`)
    - _Requisitos: 1.4, 11.2, 11.4_

- [ ] 11. Checkpoint final — Garantir que todos os testes passam
  - Executar toda a suíte de testes (unitários + PBT) e garantir que nenhum falha.
  - Verificar que o build de produção (`vite build`) conclui sem erros de TypeScript.
  - Perguntar ao usuário se há ajustes antes de considerar a implementação concluída.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia os requisitos específicos para rastreabilidade
- Os testes PBT usam `fast-check` com mínimo de 100 iterações (`numRuns: 100`)
- Cada teste PBT deve incluir a tag: `// Feature: excel-reconciliation, Property N: <texto>`
- `valueBase1 === null` é renderizado como `—` na UI e na exportação
- O anti-double-matching é central para a corretude — coberto pelas Properties 6 e 8
