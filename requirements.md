# Requirements Document

## Introdução

Plataforma web MVP para conciliação de duas bases de notas em formato Excel. O usuário faz upload de dois arquivos, seleciona as abas e colunas de interesse, e o sistema gera um relatório de conciliação comparando registros entre as bases.

Neste contexto, a coluna **CNPJ** é a chave principal de conciliação, e o **Valor da Nota** é o campo principal de comparação. Como um mesmo CNPJ pode possuir múltiplas notas em ambas as bases, o sistema não assume unicidade da chave e considera todas as ocorrências relevantes no processo de conciliação.

Além dos campos de CNPJ e Valor da Nota, o sistema permite que o usuário escolha quais colunas adicionais deseja incluir no relatório final, como número do documento, data de pagamento, nome do cliente/fornecedor e outros campos disponíveis nas bases.

O foco é simplicidade operacional e rapidez de entrega no MVP, com arquitetura preparada para publicação em VPS com Docker e incorporação em portal corporativo via iframe.

---

## Glossário

- **Base_1**: Arquivo Excel de referência (fonte confiável). Serve como base de comparação.
- **Base_2**: Arquivo Excel a ser validado. Seus registros são comparados contra a Base_1.
- **CNPJ**: Coluna identificadora principal usada para cruzar registros entre as duas bases. É a chave de conciliação do sistema.
- **Valor da Nota**: Coluna numérica principal usada para comparação entre os registros conciliados após o cruzamento pelo CNPJ.
- **Registro**: Uma linha de dados em uma aba de um arquivo Excel.
- **Conciliação**: Processo de comparar registros da Base_2 contra a Base_1 usando CNPJ e Valor da Nota.
- **Relatório**: Resultado da Conciliação, contendo todos os registros da Base_2 com seus respectivos status e valores de ambas as bases.
- **Status**: Resultado da comparação de um Registro. Pode ser "De Acordo", "Valor Divergente" ou "Nota não encontrada".
- **Normalizador**: Componente responsável por padronizar dados antes da comparação (trim, case, tipo numérico).
- **Uploader**: Componente de interface responsável pelo upload dos arquivos Excel.
- **Parser**: Componente responsável por ler e interpretar arquivos .xls e .xlsx.
- **Exportador**: Componente responsável por gerar o arquivo Excel do Relatório final.
- **Campos Adicionais do Relatório**: Colunas selecionadas pelo usuário para compor o relatório final, como número do documento, data de pagamento, nome do cliente/fornecedor e outros metadados relevantes. Não participam da lógica de conciliação.
- **Portal Corporativo**: Ambiente onde a aplicação será incorporada futuramente via iframe.
- **RPA Assistida**: Automação futura responsável por disponibilizar a Base_2 para conciliação sem substituir o fluxo manual do MVP.

---

## Requisitos

### Requisito 1: Upload de Arquivos Excel

**User Story:** Como usuário operacional, quero fazer upload de dois arquivos Excel, para que o sistema possa processar os dados de conciliação.

#### Critérios de Aceite

1. THE Uploader SHALL aceitar arquivos nos formatos `.xls` e `.xlsx`.
2. WHEN o usuário selecionar um arquivo com formato inválido (não `.xls` ou `.xlsx`), THE Uploader SHALL exibir a mensagem "Formato inválido. Envie um arquivo .xls ou .xlsx." e bloquear o processamento.
3. WHEN o usuário selecionar um arquivo com tamanho superior a 20MB, THE Uploader SHALL exibir a mensagem "Arquivo muito grande. O limite é 20MB." e bloquear o processamento.
4. WHEN o upload de ambos os arquivos for concluído com sucesso, THE Uploader SHALL habilitar a etapa de seleção de abas.
5. IF o arquivo enviado estiver corrompido ou ilegível, THEN THE Parser SHALL exibir a mensagem "Não foi possível ler o arquivo. Verifique se ele está corrompido." e bloquear o processamento.

> **Decisão MVP**: Limite de 20MB por arquivo. Arquivos maiores são casos raros no contexto operacional descrito.

---

### Requisito 2: Leitura e Seleção de Abas

**User Story:** Como usuário operacional, quero selecionar qual aba de cada arquivo será usada, para que o sistema leia os dados corretos.

#### Critérios de Aceite

1. WHEN o upload de um arquivo for concluído com sucesso, THE Parser SHALL extrair e listar todas as abas disponíveis nesse arquivo.
2. THE Sistema SHALL exibir as abas da Base_1 e da Base_2 em listas de seleção separadas.
3. WHEN o usuário selecionar uma aba, THE Parser SHALL carregar os cabeçalhos (primeira linha) dessa aba para uso na seleção de colunas.
4. IF uma aba selecionada estiver vazia ou não contiver cabeçalhos na primeira linha, THEN THE Parser SHALL exibir a mensagem "A aba selecionada não contém dados ou cabeçalhos." e solicitar nova seleção.

---

### Requisito 3: Seleção de Colunas de Conciliação e Campos de Exibição do Relatório

**User Story:** Como usuário operacional, quero selecionar as colunas de CNPJ e Valor da Nota para a conciliação, e também escolher campos adicionais para exibição no relatório final, para que eu tenha um resultado útil para análise sem alterar a lógica principal de comparação.

#### Critérios de Aceite

1. WHEN o usuário selecionar uma aba, THE Sistema SHALL exibir os cabeçalhos disponíveis dessa aba.
2. THE Sistema SHALL exigir a seleção da coluna correspondente ao CNPJ na Base_1 e na Base_2 antes de habilitar o processamento.
3. THE Sistema SHALL exigir a seleção da coluna correspondente ao Valor da Nota na Base_1 e na Base_2 antes de habilitar o processamento.
4. THE Sistema SHALL permitir que o usuário selecione uma ou mais colunas adicionais da Base_1 e/ou da Base_2 para exibição no relatório final.
5. THE Campos Adicionais do Relatório selecionados SHALL ser usados apenas para composição do relatório final e não devem participar da lógica de conciliação.
6. IF o usuário selecionar a mesma coluna para CNPJ e Valor da Nota na mesma base, THEN THE Sistema SHALL exibir a mensagem "A coluna de CNPJ e a coluna de valor não podem ser iguais." e bloquear o processamento.
7. THE Sistema SHALL preservar no relatório final os Campos Adicionais do Relatório escolhidos pelo usuário, identificando corretamente a origem de cada campo (Base_1 ou Base_2).

---

### Requisito 4: Normalização de Dados

**User Story:** Como usuário operacional, quero que o sistema normalize os dados antes de comparar, para que diferenças de formatação não causem divergências falsas.

#### Critérios de Aceite

1. WHEN o Normalizador processar valores da coluna CNPJ, THE Normalizador SHALL remover espaços em branco no início e no fim de cada valor (trim).
2. WHEN o Normalizador processar valores da coluna CNPJ do tipo texto, THE Normalizador SHALL converter todos os caracteres para letras minúsculas antes da comparação.
3. WHEN o Normalizador processar valores da coluna Valor da Nota, THE Normalizador SHALL converter os valores para tipo numérico com precisão de 2 casas decimais antes da comparação.
4. IF um valor da coluna Valor da Nota não puder ser convertido para número, THEN THE Normalizador SHALL tratar esse registro como tendo valor nulo e registrar o status "Valor Divergente" no Relatório.

---

### Requisito 5: Tratamento de Múltiplas Ocorrências do CNPJ

**User Story:** Como usuário operacional, quero que o sistema trate corretamente múltiplas ocorrências do mesmo CNPJ nas duas bases, para que todas as notas sejam consideradas na conciliação.

#### Critérios de Aceite

1. THE Sistema SHALL tratar a repetição de CNPJ nas bases como comportamento esperado do negócio e não como erro de processamento.
2. WHEN o Sistema detectar múltiplas ocorrências do mesmo CNPJ na Base_1, THE Sistema SHALL considerar todas as ocorrências relevantes na conciliação, sem limitar o matching à primeira ocorrência encontrada.
3. WHEN o Sistema detectar múltiplas ocorrências do mesmo CNPJ na Base_2, THE Sistema SHALL gerar uma linha independente no relatório para cada ocorrência.
4. WHEN o Sistema detectar células vazias na coluna CNPJ da Base_2, THE Sistema SHALL atribuir o status "Nota não encontrada" a esses registros e incluí-los no relatório.
5. WHEN o Sistema detectar células vazias na coluna CNPJ da Base_1, THE Sistema SHALL ignorar esses registros da Base_1 sem interromper o processamento.

---

### Requisito 6: Estratégia de Matching com Múltiplas Ocorrências

**User Story:** Como usuário operacional, quero que o sistema aplique uma estratégia clara de matching quando houver múltiplas ocorrências do mesmo CNPJ, para que cada nota da Base_2 seja conciliada de forma precisa e sem duplicação de correspondências.

#### Critérios de Aceite

1. THE Sistema SHALL indexar todos os registros da Base_1 agrupados por CNPJ normalizado antes de iniciar a conciliação.
2. WHEN o Sistema processar um registro da Base_2, THE Sistema SHALL buscar todas as ocorrências do mesmo CNPJ normalizado na Base_1.
3. WHEN o Sistema encontrar ocorrências do CNPJ na Base_1, THE Sistema SHALL tentar localizar uma ocorrência cujo Valor da Nota normalizado seja igual ao Valor da Nota normalizado do registro da Base_2.
4. WHEN o Sistema encontrar uma ocorrência da Base_1 com mesmo CNPJ e mesmo Valor da Nota normalizado, THE Sistema SHALL atribuir o status "De Acordo" ao registro da Base_2 e marcar essa ocorrência da Base_1 como utilizada para evitar double-matching.
5. WHEN o Sistema não encontrar nenhuma ocorrência da Base_1 com valor igual, mas o CNPJ existir na Base_1, THE Sistema SHALL atribuir o status "Valor Divergente" ao registro da Base_2.
6. WHEN o CNPJ do registro da Base_2 não existir na Base_1, THE Sistema SHALL atribuir o status "Nota não encontrada" ao registro da Base_2.
7. THE Sistema SHALL exibir um aviso ao usuário quando detectar CNPJs duplicados na Base_1, sem bloquear o processamento.

---

### Requisito 7: Lógica de Conciliação

**User Story:** Como usuário operacional, quero que o sistema compare corretamente os registros das duas bases usando apenas os campos de conciliação definidos, para que o status final reflita a validação entre as bases.

#### Critérios de Aceite

1. THE Sistema SHALL utilizar apenas o CNPJ e o Valor da Nota como base da lógica de conciliação do MVP.
2. THE Sistema SHALL não utilizar os Campos Adicionais do Relatório como critério de comparação.
3. THE Sistema SHALL processar todos os registros da Base_2 e tentar conciliá-los com os registros correspondentes da Base_1.
4. THE Sistema SHALL incluir no relatório final o Valor da Nota da Base_2 e o Valor da Nota da Base_1 para cada registro conciliado.
5. THE Sistema SHALL incluir no relatório final os Campos Adicionais do Relatório selecionados pelo usuário apenas como colunas informativas.

---

### Requisito 8: Visualização do Relatório

**User Story:** Como usuário operacional, quero visualizar o relatório de conciliação na tela, para que eu possa analisar os resultados sem precisar baixar um arquivo.

#### Critérios de Aceite

1. WHEN o processamento da Conciliação for concluído, THE Sistema SHALL exibir o Relatório em formato de tabela na tela.
2. THE Sistema SHALL exibir um resumo com a contagem de registros por Status ("De Acordo", "Valor Divergente", "Nota não encontrada") no topo do Relatório.
3. THE Sistema SHALL aplicar cores distintas por Status nas linhas da tabela: verde para "De Acordo", amarelo para "Valor Divergente" e vermelho para "Nota não encontrada".
4. WHEN o Relatório contiver mais de 500 registros, THE Sistema SHALL paginar a tabela em páginas de 100 registros.
5. THE Sistema SHALL exibir as colunas padrão do relatório na seguinte ordem: CNPJ, Valor da Nota (Base_2), Valor da Nota (Base_1), Status, seguidas dos Campos Adicionais do Relatório selecionados pelo usuário.

---

### Requisito 9: Filtros por Status

**User Story:** Como usuário operacional, quero filtrar o relatório por status, para que eu possa focar nos registros que precisam de atenção.

#### Critérios de Aceite

1. THE Sistema SHALL exibir filtros de Status acima da tabela do Relatório, com opções: "Todos", "De Acordo", "Valor Divergente", "Nota não encontrada".
2. WHEN o usuário selecionar um filtro de Status, THE Sistema SHALL exibir apenas os registros com o Status correspondente na tabela.
3. WHEN o usuário selecionar o filtro "Todos", THE Sistema SHALL exibir todos os registros do Relatório.
4. WHEN um filtro de Status estiver ativo, THE Sistema SHALL atualizar o resumo de contagem para refletir apenas os registros visíveis.

---

### Requisito 10: Exportação do Relatório

**User Story:** Como usuário operacional, quero exportar o relatório em Excel com os campos que escolhi exibir, para que eu possa compartilhar ou arquivar o resultado da conciliação.

#### Critérios de Aceite

1. THE Exportador SHALL gerar um arquivo `.xlsx` contendo todos os registros do relatório, independentemente do filtro ativo na tela.
2. THE Exportador SHALL incluir as colunas padrão do relatório na seguinte ordem: CNPJ, Valor da Nota (Base_2), Valor da Nota (Base_1), Status.
3. THE Exportador SHALL incluir também todos os Campos Adicionais do Relatório selecionados pelo usuário na configuração.
4. THE Campos Adicionais do Relatório exportados SHALL ser apresentados apenas como informação complementar e não como campos de comparação.
5. THE Exportador SHALL aplicar formatação de cor de fundo nas células da coluna Status: verde para "De Acordo", amarelo para "Valor Divergente" e vermelho para "Nota não encontrada".
6. WHEN o usuário clicar em "Exportar Excel", THE Exportador SHALL iniciar o download do arquivo com o nome `relatorio_conciliacao_{data}.xlsx`, onde `{data}` é a data atual no formato `DDMMYYYY`.

---

### Requisito 11: Desempenho e Usabilidade

**User Story:** Como usuário operacional, quero que o sistema processe os arquivos de forma ágil e me informe o progresso, para que eu não fique sem feedback durante operações longas.

#### Critérios de Aceite

1. WHEN o processamento da Conciliação for iniciado, THE Sistema SHALL exibir um indicador de progresso visível ao usuário.
2. WHEN o arquivo contiver até 10.000 registros, THE Sistema SHALL concluir o processamento em até 10 segundos.
3. WHEN o processamento for concluído, THE Sistema SHALL ocultar o indicador de progresso e exibir o Relatório.
4. THE Sistema SHALL permitir que o usuário inicie uma nova conciliação sem precisar recarregar a página.

---

## Regras de Negócio

- **RN-01**: A Base_1 é sempre a referência para validação.
- **RN-02**: O Relatório é gerado com base nos registros da Base_2 e seus respectivos resultados de conciliação contra a Base_1.
- **RN-03**: O CNPJ é a chave principal de agrupamento da conciliação.
- **RN-04**: A repetição de CNPJ em qualquer uma das bases é considerada comportamento normal do negócio.
- **RN-05**: Todas as ocorrências de um mesmo CNPJ nas duas bases devem ser consideradas no processo de conciliação. Nenhuma ocorrência é descartada por ser duplicata.
- **RN-06**: A comparação principal é feita com base no Valor da Nota após normalização.
- **RN-07**: Uma ocorrência da Base_1 marcada como "usada" em um matching não pode ser reutilizada para conciliar outro registro da Base_2, evitando double-matching.
- **RN-08**: Os Campos Adicionais do Relatório selecionados pelo usuário servem apenas para exibição no relatório final e não participam da lógica de conciliação.
- **RN-09**: O relatório final pode conter colunas oriundas da Base_1 e da Base_2, conforme seleção do usuário.
- **RN-10**: O sistema deve preservar a origem dos campos exibidos no relatório quando houver colunas vindas da Base_1 e da Base_2.

---

## Decisão de Formato do Relatório

> **Decisão MVP**: O relatório adota o formato **Opção B — CNPJ + Valor da Nota (Base_2) + Valor da Nota (Base_1) + Status**.

**Justificativa**: A Opção B é superior para o contexto operacional porque:
- Permite ao usuário ver lado a lado os valores das duas bases, facilitando a identificação visual de divergências sem precisar consultar os arquivos originais.
- O campo "Valor da Nota (Base_1)" é especialmente útil nos registros com status "Valor Divergente", onde o usuário precisa saber qual era o valor esperado.
- O custo de implementação é idêntico ao da Opção A, pois o `ReconciliationRecord` já armazena `valueBase1` e `valueBase2` separadamente.
- Registros com status "Nota não encontrada" exibirão `—` na coluna Valor da Nota (Base_1), o que é semanticamente correto e informativo.

---

## Fluxo do Usuário

```
[1. Upload]
  Usuário faz upload da Base_1 e Base_2
        ↓
[2. Seleção de Abas]
  Usuário seleciona a aba de cada arquivo
        ↓
[3. Seleção de Colunas]
  Usuário seleciona CNPJ e Valor da Nota para cada base
  Usuário seleciona Campos Adicionais do Relatório (opcional)
        ↓
[4. Validação + Aviso]
  Sistema valida CNPJs duplicados/vazios → exibe avisos
        ↓
[5. Processamento]
  Usuário clica "Conciliar" → sistema processa
        ↓
[6. Relatório]
  Sistema exibe tabela com resumo e filtros
        ↓
[7. Exportação]
  Usuário exporta .xlsx se necessário
        ↓
[8. Nova Conciliação]
  Usuário pode reiniciar sem recarregar a página
```

---

## Wireframe Textual das Telas

### Tela 1 — Upload

```
┌─────────────────────────────────────────────────────────┐
│  Conciliação de Bases Excel                             │
├──────────────────────────┬──────────────────────────────┤
│  BASE 1 (Referência)     │  BASE 2 (A validar)          │
│  [ Selecionar arquivo ]  │  [ Selecionar arquivo ]      │
│  ✓ base_ref.xlsx         │  ✓ base_val.xlsx             │
└──────────────────────────┴──────────────────────────────┘
                    [ Próximo → ]
```

### Tela 2 — Configuração

```
┌────────────────────────────────────────────────────────────────────┐
│  Configurar Conciliação                                            │
├──────────────────────────────┬─────────────────────────────────────┤
│  BASE 1                      │  BASE 2                             │
│  Aba: [ Plan1          ▼ ]   │  Aba: [ Sheet1              ▼ ]     │
│  CNPJ: [ CNPJ          ▼ ]   │  CNPJ: [ nr_cnpj            ▼ ]     │
│  Valor: [ VALOR_NOTA   ▼ ]   │  Valor: [ valor_nota        ▼ ]     │
├──────────────────────────────┴─────────────────────────────────────┤
│  Campos adicionais para exibição no relatório final                │
│  Base 1:                                                           │
│  [x] Observação                                                    │
│  [ ] Número do documento                                           │
│  [ ] Data de pagamento                                             │
│                                                                    │
│  Base 2:                                                           │
│  [x] Centro de custo                                               │
│  [ ] Nome do fornecedor                                            │
│  [ ] Filial                                                        │
├────────────────────────────────────────────────────────────────────┤
│  Regra de conciliação do MVP: CNPJ + Valor da Nota                 │
│  Campos adicionais não participam da comparação                    │
│                                              [ Conciliar → ]       │
└────────────────────────────────────────────────────────────────────┘
```

### Tela 3 — Relatório

```
┌──────────────────────────────────────────────────────────────────────┐
│  Relatório de Conciliação                                            │
│  ✅ De Acordo: 842   ⚠ Divergente: 31   ❌ Não encontrada: 12        │
├──────────────────────────────────────────────────────────────────────┤
│  Filtrar: [ Todos ] [ De Acordo ] [ Divergente ] [ Não encontrada ]  │
├──────────────┬──────────────┬──────────────┬────────────────────┬────┤
│  CNPJ        │ Valor (B2)   │ Valor (B1)   │ Status             │ …  │
├──────────────┼──────────────┼──────────────┼────────────────────┼────┤
│ 12.345.678/… │ 1.500,00     │ 1.500,00     │ 🟢 De Acordo       │ …  │
│ 12.345.678/… │ 2.300,00     │ 2.100,00     │ 🟡 Valor Divergente│ …  │
│ 98.765.432/… │ 800,00       │ —            │ 🔴 Nota não enc.   │ …  │
├──────────────────────────────────────────────────────────────────────┤
│  [ ← Anterior ]  Página 1 de 9  [ Próximo → ]                       │
│                    [ 📥 Exportar Excel ]                             │
│                    [ + Nova Conciliação ]                            │
└──────────────────────────────────────────────────────────────────────┘

Nota: A coluna "…" representa os Campos Adicionais do Relatório
selecionados pelo usuário (ex: Observação, Centro de custo).
```

---

## Arquitetura Sugerida para MVP

> **Decisão MVP**: Aplicação web simples, com frontend em React + TypeScript, preparada para empacotamento via Docker e publicação em VPS corporativa.

### Estrutura sugerida
- Frontend: React + TypeScript + Vite
- UI: TailwindCSS + shadcn/ui
- Leitura e exportação de Excel: SheetJS
- Empacotamento e deploy: Dockerfile + servidor web leve
- Hospedagem: VPS corporativa
- Embedding: aplicação compatível com exibição em iframe no portal corporativo

### Considerações técnicas obrigatórias
- O app deve funcionar corretamente quando carregado dentro de iframe.
- A configuração de deploy deve considerar headers compatíveis com incorporação controlada no portal corporativo.
- O layout deve se adaptar ao espaço disponível dentro do iframe.
- A aplicação deve evitar dependências desnecessárias de navegação fora do contexto embutido.
- O build final deve ser simples de publicar em ambiente containerizado.

**Por que client-side?**
- Sem custo de infraestrutura
- Dados sensíveis não saem do navegador do usuário
- Suficiente para arquivos de até 20MB / 10k registros
- Deploy simples em ambiente containerizado

---

## Principais Entidades e Estrutura de Dados

```typescript
// Arquivo carregado
interface UploadedFile {
  name: string;
  sheets: string[];
  rawData: Record<string, Row[]>; // aba → linhas
}

// Linha de dados
type Row = Record<string, string | number | null>;

interface ReconciliationConfig {
  base1: {
    sheet: string;
    cnpjColumn: string;
    valueColumn: string;
    selectedDisplayFields: string[];
  };
  base2: {
    sheet: string;
    cnpjColumn: string;
    valueColumn: string;
    selectedDisplayFields: string[];
  };
}

type ReconciliationStatus = "De Acordo" | "Valor Divergente" | "Nota não encontrada";

interface ReconciliationRecord {
  cnpj: string;
  valueBase2: number | null;  // Valor da Nota da Base_2
  valueBase1: number | null;  // Valor da Nota da Base_1 (null se CNPJ não encontrado)
  status: ReconciliationStatus;
  // campos adicionais: chave = "base1:NomeColuna" ou "base2:NomeColuna"
  displayFields: Record<string, string | number | null>;
}

interface ReconciliationReport {
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
```

---

## Casos de Erro e Edge Cases

| Caso | Comportamento esperado |
|------|----------------------|
| Arquivo corrompido | Mensagem de erro, bloqueio do processamento |
| Arquivo > 20MB | Mensagem de erro, bloqueio do processamento |
| Formato inválido (ex: .csv) | Mensagem de erro, bloqueio do processamento |
| Aba vazia | Mensagem de erro, solicitar nova seleção |
| CNPJ duplicado na Base_1 | Aviso exibido; todas as ocorrências participam do matching por valor |
| CNPJ duplicado na Base_2 | Cada ocorrência gera linha independente no relatório |
| CNPJ vazio na Base_2 | Status "Nota não encontrada" |
| Valor não numérico | Status "Valor Divergente" |
| Base_2 com 0 registros válidos | Relatório vazio com mensagem informativa |
| Mesma coluna para CNPJ e Valor | Erro de validação, bloqueio |
| Arquivo com apenas cabeçalho | Relatório vazio com mensagem informativa |

---

## Plano de Implementação por Fases

### Fase 1 — Core (MVP funcional)
- Setup do projeto (React + TypeScript + Vite + TailwindCSS)
- Componente de upload com validação de formato e tamanho
- Parser de Excel com SheetJS (leitura de abas e colunas)
- Tela de configuração (seleção de aba, CNPJ, Valor da Nota e Campos Adicionais)
- Lógica de normalização e conciliação com estratégia de múltiplas ocorrências
- Exibição do relatório em tabela com colunas CNPJ, Valor (B2), Valor (B1), Status e campos adicionais
- Exportação do relatório em .xlsx

### Fase 2 — Qualidade e UX
- Filtros por status no relatório
- Paginação da tabela
- Resumo de contagem por status
- Avisos de CNPJs duplicados
- Indicador de progresso durante processamento
- Botão "Nova Conciliação" sem reload

### Fase 3 — Polimento (pós-MVP)
- Suporte a arquivos grandes com Web Workers
- Histórico de conciliações (localStorage)
- Drag & drop para upload
- Responsividade mobile

---

## Backlog Priorizado

| Prioridade | Item | Fase |
|-----------|------|------|
| P0 | Upload e validação de arquivos | 1 |
| P0 | Parser de abas e colunas | 1 |
| P0 | Tela de configuração | 1 |
| P0 | Lógica de conciliação com múltiplas ocorrências | 1 |
| P0 | Exibição do relatório (CNPJ + Valor B2 + Valor B1 + Status) | 1 |
| P0 | Exportação Excel | 1 |
| P1 | Filtros por status | 2 |
| P1 | Paginação | 2 |
| P1 | Resumo de contagem | 2 |
| P1 | Avisos de CNPJs duplicados | 2 |
| P1 | Indicador de progresso | 2 |
| P1 | Nova Conciliação sem reload | 2 |
| P2 | Web Workers para arquivos grandes | 3 |
| P2 | Histórico em localStorage | 3 |
| P2 | Drag & drop | 3 |
| P2 | Responsividade mobile | 3 |

---

## Evoluções Futuras / Direcionadores de Arquitetura

Embora fora do escopo do MVP, a arquitetura deve considerar futura integração com uma RPA Assistida responsável por disponibilizar automaticamente a Base_2 para os usuários.

Direcionadores para o futuro:
- separar a lógica de conciliação da interface de upload manual;
- permitir que a origem da Base_2 seja futuramente substituída ou complementada por fluxo automatizado;
- manter a configuração de conciliação desacoplada da captura dos arquivos;
- preparar o sistema para evolução posterior com backend, fila, armazenamento temporário ou integrações corporativas, sem exigir reescrita completa do core de conciliação.

Essa integração não faz parte da entrega atual do MVP e não deve aumentar desnecessariamente a complexidade da primeira versão.
