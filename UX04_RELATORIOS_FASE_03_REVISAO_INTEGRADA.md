# UX04 — RELATÓRIOS V2
# FASE 03 — REVISÃO INTEGRADA E HARDENING UX DA CENTRAL

**Status:** CONGELADA / PRONTA PARA HOMOLOGAÇÃO  
**Data:** 03 de Outubro de 2026  
**Ambiente:** UX Lab (`/ux-lab/relatorios`, `/ux-lab/relatorios/:reportId`)  
**Diretriz Aplicada:** *"REVISAR → CORRIGIR → HARDENING → CONGELAR"* — Sem expansão de escopo, sem integração precoce de backend, sem alteração de módulos de produção.

---

## 1. Estado Inicial

A frente UX04 — Relatórios V2 alcançou a prontidão do seu núcleo na Fase 02.2, disponibilizando 6 relatórios funcionais no UX Lab com catálogo canônico e segregação estrita por empresa:

- **Operacional:**
  - `R01` — Analítico de Operações por Volume
  - `R04` — Custos Extras Operacionais (Despesas)
  - `R07` — Analítico de Serviços Extras
- **Pessoas & RH:**
  - `R02` — Fechamento de Diaristas
  - `R05` — Consolidado de Banco de Horas (estritamente em Horas/Minutos)
- **Financeiro & Faturamento:**
  - `R03` — Faturamento e Receitas (sem inclusão de Custos Extras)
- **Candidato Bloqueado:**
  - `R06` — Produtividade da Equipe Operacional (ausente e permanentemente bloqueado por ausência de granularidade individual auditada).

Apesar da completude dos seis relatórios, a experiência integrada carecia de:
1. Padrão canônico de Estado Sem Dados (Empty State) unificado com ação de reset;
2. Indicador discreto de filtros ativos e ação de limpeza imediata;
3. Padrão canônico de paginação compacta para suportar o crescimento volumétrico;
4. Padronização de skeletons e error boundaries para futura integração;
5. Refinamento de acessibilidade de teclado e tags ARIA no Hub e nas telas.

---

## 2. Achados da Revisão Integrada

Durante a auditoria minuciosa da Central e dos seis relatórios operando em conjunto, foram catalogados os seguintes pontos:

1. **Ausência de Reset Centralizado de Filtros:** Quando o usuário aplicava múltiplos recortes (período, serviço, categoria, status), não havia um botão discreto para restaurar os parâmetros padrão sem precisar recarregar a tela ou desselecionar manualmente cada Select.
2. **Inconsistência nos Estados Sem Dados:** Cada tabela exibia uma linha simples de texto (`Nenhuma operação encontrada...`, `Nenhum apontamento...`), sem botão de ação para limpar filtros e sem o formato canônico requerido pelo ORBE.
3. **Ausência de Paginação Compacta na Tabela:** Os relatórios renderizavam todos os registros em tabela contínua, sem estabelecer o contrato visual para navegação por páginas em volumes elevados.
4. **Falta de Associação Semântica em Inputs de Data:** Os inputs `<input type="date">` não possuíam `id` / `htmlFor` explícitos nem `aria-label`, limitando a acessibilidade para leitores de tela.
5. **Acessibilidade nos Cards da Central:** Os cards da Central utilizavam `onKeyDown` restrito a `Enter`, sem suporte à barra de espaço (`Space`), e sem `aria-label` descritivo.
6. **Definição de Loading e Error States:** Faltava a especificação dos componentes canônicos visuais de skeleton e tratamento de erro que serão conectados na futura camada de serviços.

---

## 3. Severidade dos Achados

| ID | Achado | Severidade | Classificação | Tratamento na Fase 03 |
|---|---|:---:|:---:|:---:|
| **ACH-01** | Ausência de botão/ação para limpar filtros ativos e recorte não evidenciado | **P1** | Compromete usabilidade/decisão | **CORRIGIDO** |
| **ACH-02** | Estado sem dados não padronizado entre as 6 tabelas | **P1** | Consistência visual e funcional | **CORRIGIDO** |
| **ACH-03** | Falta de padrão de paginação compacta para grandes volumes | **P2** | Inconsistência de UX / Fundação futura | **CORRIGIDO** |
| **ACH-04** | Acessibilidade (labels, `aria-label`, foco por teclado) incompleta | **P2** | Inconsistência de UX e A11y | **CORRIGIDO** |
| **ACH-05** | Ausência de padrão canônico para Skeleton e Erro | **P2** | Preparação de arquitetura visual | **CORRIGIDO** |
| **ACH-06** | Scroll horizontal e alinhamento monetário em telas menores | **P3** | Polimento | **CORRIGIDO** |

*Nota:* Não foram identificados problemas **P0** (bloqueio crítico ou falha arquitetural grave).

---

## 4. Correções Realizadas

1. **Implementação do `EmptyReportState` Unificado:**
   - Mensagem padronizada:
     - Linha 1: `Nenhum registro encontrado` (em destaque, sem alarde).
     - Linha 2: `Não existem dados para os filtros selecionados.` (discreto).
     - Ação: Botão `[Limpar filtros]` com ícone `RotateCcw`, que restaura os parâmetros padrão.
   - Aplicado a todas as 6 tabelas (`R01`, `R02`, `R03`, `R04`, `R05`, `R07`).
2. **Detecção e Sinalização Discreta de Filtros Ativos:**
   - Hook `hasActiveFilters` avalia se qualquer parâmetro diverge dos valores padrão.
   - Quando ativo, exibe no topo dos parâmetros um badge discreto `Filtros Ativos` acompanhado do botão `Limpar filtros`.
   - Preservação da Empresa: A empresa ativa (`empresaId`) nunca é desfeita no reset, pois representa o contexto de governança e tenant.
3. **Paginação Compacta Canônica (`TablePaginationFooter`):**
   - Integrada ao rodapé de todas as seis tabelas.
   - Padrão compacto: `Mostrando X a Y de Z registros | Empresa: [Nome]` à esquerda; `Página N de M` com botões `[← Anterior]` e `[Próxima →]` à direita.
   - Fatiamento demonstrativo em tela (`PAGE_SIZE = 10`), com preservação integral de todas as linhas na impressão (`print:table-row`).
4. **Hardening de Acessibilidade (A11y):**
   - Adicionados `htmlFor`, `id` e `aria-label` aos inputs de data.
   - Adicionado `aria-label="Buscar relatórios por código, título ou palavra-chave"` ao input de busca da Central.
   - Implementado suporte completo a teclado (`Enter` e `Space`), `focus-visible:ring-2` e `aria-label` nos cards de relatórios da Central.
5. **Componentes Canônicos de Fundação para Futura Integração:**
   - `ReportTableSkeleton`: Skeleton discreto em linhas pulsantes (sem spinner central invasivo).
   - `ReportErrorState`: Tratamento sóbrio de erro de carregamento com ação `[Tentar novamente]`.

---

## 5. Auditoria da Central (`/ux-lab/relatorios`)

- **Hierarquia Visual:** Catálogo organizado categoricamente nos três domínios homologados (`OPERACIONAL`, `PESSOAS & RH`, `FINANCEIRO & FATURAMENTO`).
- **Busca Operacional:** Busca instantânea client-side por código (`R01`, `R02`, etc.), título ou descrição.
- **Densidade:** Apresentação em lista tabular compacta com metadados de saída (`CSV`, `PDF`), badges discretos e área clicável ampla.
- **Identidade ERP:** Ausência total de visual tipo "marketplace" ou "card wall"; estética sóbria e focada em consulta corporativa.
- **Acessibilidade:** Navegação completa por `Tab`, ativação por `Enter`/`Space` e anéis de foco de alto contraste (`focus-visible:ring-primary`).

---

## 6. Hierarquia e Semântica dos Filtros

A ordem visual e cognitiva dos filtros foi padronizada em todos os relatórios:
```
1. Empresa / Filial (Obrigatória em todos — Contexto de Governança)
   ↓
2. Parâmetro Temporal Semântico (Específico do domínio do relatório)
   ↓
3. Filtros Categóricos / Específicos (Serviço, Categoria, Função, Modalidade, Status)
```

### Semântica Temporal Preservada por Relatório:
- `R01`: `dataOperacao` (Período: Data Inicial `De` a Data Final `Até`).
- `R02`: `cicloId` (Ciclo / Período Semanal dos Diaristas).
- `R03`: `competencia` (Competência Mensal `Mês/Ano`).
- `R04`: `data` (Data do Custo Operacional: Data Inicial `De` a Data Final `Até`).
- `R05`: `competencia` (Competência de Referência do Banco de Horas `Mês/Ano`).
- `R07`: `data` (Data de Execução do Serviço Extra: Data Inicial `De` a Data Final `Até`).

---

## 7. Auditoria das Tabelas e Densidade

- **Alinhamento Numérico e Monetário:**
  - Valores monetários alinhados estritamente à direita (`text-right`), utilizando fonte monoespacada (`font-mono`) e formato canônico `R$ 1.234,56`.
  - `R05` opera **estritamente sem R$**, demonstrando saldos e créditos em Horas e Minutos (`+18h 30m`, `-08h 30m`).
  - Quantidades operacionais formatadas no padrão brasileiro (`1.450 unid.`, `6,0 diárias`).
- **Uso de Cores nos Badges:**
  - **Monocromático Institucional:** Categorias de custo (`MERENDA`, `OPERACIONAL`), modalidades (`FATURAMENTO_MENSAL`, `DUPLICATA`, `CAIXA_IMEDIATO`), funções de diaristas (`Diarista`, `Auxiliar de carga`), tipos de serviço e origens utilizam superfícies neutras (`bg-muted text-foreground border-border/60`).
  - **Semântico Específico:** Cores semânticas são restritas a status de ciclo de vida (`Verde`: Concluído/Pago/Conciliado/Regular; `Azul`: Recebido/Faturado/Saldo Positivo; `Âmbar`: Em Validação/Aguardando/A Vencer; `Vermelho`: Débito Crítico/Em Restrição/Atrasado/Cancelado).
- **Densidade:** Espaçamento vertical enxuto (`py-2 px-3`), fonte `12px` (`text-xs`), cabeçalhos em `11px` com tracking refinado, proporcionando máxima quantidade de dados visíveis sem perda de legibilidade.

---

## 8. Estados Sem Dados, Loading e Error

1. **Estado Sem Dados (Empty State):**
   - Implementado com o componente `EmptyReportState`.
   - Se o usuário filtra por uma data ou status que não contém registros, a tabela exibe:
     > **Nenhum registro encontrado**  
     > Não existem dados para os filtros selecionados.  
     > `[Limpar filtros]`
2. **Padrão de Loading (Skeleton):**
   - Especificado no componente `ReportTableSkeleton`.
   - Linhas pulsantes discretas que mimetizam a estrutura da tabela atual, evitando spinners gigantes que desestabilizam o layout.
3. **Padrão de Error State:**
   - Especificado no componente `ReportErrorState`.
   - Mensagem objetiva de erro técnico acompanhada de botão `[Tentar novamente]`.

---

## 9. Paginação Compacta Canônica

- **Estrutura:**
  - Rodapé tabular integrado (`TablePaginationFooter`).
  - Lado esquerdo: Totalizadores de registros (`Mostrando 1 a 10 de 14 registros | Empresa: ESC LOG — Matriz Castanhal`).
  - Lado direito: Indicador de página (`Página 1 de 2`) e botões compactos `Anterior` / `Próxima`.
- **Comportamento em Impressão:**
  - Em tela, a tabela fatia os dados pela página ativa (`pageSize = 10`).
  - Na impressão física ou exportação PDF, o CSS `@media print` ativa `print:table-row`, garantindo que **todos os registros do relatório** sejam impressos na íntegra.

---

## 10. Exportação CSV

- **Formato:** UTF-8 com BOM (`\uFEFF`), delimitador ponto e vírgula (`;`), compatível com Microsoft Excel e LibreOffice.
- **Rastreabilidade:** Nome do arquivo padronizado: `[CODIGO]_[EMPRESA]_[DATA].csv` (ex: `R01_ESC LOG — _2026-10-03.csv`).
- **Respeito ao Recorte:** Exporta estritamente as linhas correspondentes aos filtros ativos na tela.
- **Integridade de Campos:** Campos ausentes (como NF não emitida ou data de recebimento pendente) são exportados com travessão (`—`), prevenindo células nulas confusas.

---

## 11. Impressão e PDF (@media print)

- **Cabeçalho Gerencial:**
  - Emite automaticamente no topo: `ORBE ERP — ESC LOGÍSTICA`, código e nome do relatório, nome e CNPJ da empresa, data/hora de geração e parâmetros temporais aplicados.
- **Ocultação de Elementos Não-Imprimíveis:**
  - Sidebar, breadcrumbs, botões de exportação, barra de filtros e rodapé de paginação recebem `no-print` (`display: none !important`).
- **Layout de Impressão:**
  - Bordas finas (`#ddd`), fundo claro forçado, cabeçalho de tabela repetível e quebras de linha controladas.

---

## 12. Validação Light / Dark

- **Dark Mode:** Superfícies neutras profundas (`#0B0E14` / `#111622`), bordas sutis (`border-border/60`), ausência de brilhos excessivos, destaques em Royal Blue funcional.
- **Light Mode:** Fundo limpo, contraste tipográfico alto (`#0F172A`), separadores nítidos e badges com saturação contida.

---

## 13. Acessibilidade (A11y)

- Foco visível (`focus-visible:ring-2 focus-visible:ring-primary`) em todos os botões, links, selects e cards da Central.
- `aria-label` em botões de ícone e controles de paginação (`Página anterior`, `Próxima página`).
- `aria-hidden="true"` em ícones puramente decorativos.
- Relação estrita de `label` com inputs através de `htmlFor` e `id`.

---

## 14. Suíte de Testes Automatizados

A suíte `src/test/ux_relatorios_v2_proto1.test.tsx` foi expandida para **18 testes integrados**, cobrindo 100% da matriz de validação da Fase 03:

```bash
npx vitest run src/test/ux_relatorios_v2_proto1.test.tsx
```

### Resultados dos Testes:
1. `Central de Relatórios exibe os 3 domínios corretos e lista os 6 relatórios autorizados` — **PASS**
2. `Busca rápida filtra relatórios por código, título ou palavra-chave` — **PASS**
3. `R01 — Operações por Volume renderiza colunas homologadas e totalizadores` — **PASS**
4. `R05 — Banco de Horas opera ESTRITAMENTE em Horas/Minutos (sem R$, sem Passivo)` — **PASS**
5. `R03 — Faturamento e Receitas exibe faturamento correto e NÃO inclui Custos Extras` — **PASS**
6. `Nenhum dos 6 relatórios mostra 'Em Preparação' e todos estão funcionais` — **PASS**
7. `R02 — Fechamento de Diaristas abre, possui colunas homologadas, CPF minimizado e NÃO inventa vínculo com operação` — **PASS**
8. `R04 — Custos Extras Operacionais abre, segrega despesas, exibe Favorecido e NÃO aparece como receita` — **PASS**
9. `R07 — Analítico de Serviços Extras abre, domínio operacional e campos auditados` — **PASS**
10. `Filtro de Empresa é obrigatório e segrega dados entre filiais sem rateio em todos os relatórios` — **PASS**
11. `Hotfix 02.1: R03 não contém modalidades ou status inventados e diferencia estado derivado` — **PASS**
12. `Hotfix 02.1: R01 apresenta número de NF real ou travessão e status operacional real` — **PASS**
13. `Paginação canônica compacta exibe contador de registros, página atual e botões Anterior/Próxima` — **PASS**
14. `Estado canônico sem dados (Empty State) exibe mensagem padronizada e botão Limpar filtros` — **PASS**
15. `Botão Limpar filtros reseta parâmetros temporais e específicos preservando a empresa` — **PASS**
16. `Cabeçalho de impressão (@media print) contém identificação institucional, empresa e período` — **PASS**
17. `Todos os 6 relatórios abrem via URL sem erro e renderizam tabela canônica e exportação` — **PASS**
18. `Hub da Central suporta navegação por teclado e possui acessibilidade em cards e busca` — **PASS**

**Resultado Geral:** **18/18 testes aprovados (100% de sucesso).**

### Compilação e Build:
- `npx tsc --noEmit` → **Código 0 (Sem erros de tipagem).**
- `npm run build:dev` → **Código 0 (Build de desenvolvimento concluído com sucesso em 19.69s).**

---

## 15. Limitações e Observações Técnicas

1. **Subagente de Navegador Headless (Playwright):**
   - Conforme previsto na diretriz da fase, foi executada a tentativa de inicialização do navegador automatizado via subagente.
   - O ambiente Windows da máquina host apresentou erro de rede ao baixar o driver Playwright (`404 Not Found` em `https://playwright.azureedge.net/builds/driver/playwright-1.57.0-win32_x64.zip`).
   - Declaramos com transparência técnica que **não foram gerados screenshots automáticos** por indisponibilidade desta ferramenta externa, tendo a validação de DOM sido garantida integralmente pelos 18 testes automatizados do Vitest, renderização e build limpo.
2. **Minimização do CPF em R02:**
   - O CPF é exibido como `***.***.812-44` tanto na interface quanto no arquivo CSV gerado pelo UX Lab.
   - Esta é uma decisão explícita de prototipação alinhada à LGPD, que na futura integração poderá ser vinculada a permissões RBAC de visualização de dados sensíveis.

---

## 16. Backlog Técnico para Futura Integração (NÃO IMPLEMENTAR AGORA)

Quando o projeto avançar para a integração oficial dos relatórios com o backend, as seguintes tarefas deverão ser realizadas:

1. **Camada de Serviços Dedicada (`src/services/reports/`):**
   - Criar `reportQuery.service.ts` desacoplado, sem reutilizar regras de cálculo ou endpoints mutáveis do RH.
2. **Paginação e Filtros Server-Side:**
   - Adicionar parâmetros de paginação (`page`, `pageSize`) e ordenação (`sortBy`, `sortDirection`) nas queries Supabase/PostgreSQL.
3. **RPCs e Views Materializadas para Relatórios Analíticos:**
   - `R01`: RPC agregando operações por volume com join em transportadoras, unidades e clientes.
   - `R03`: View financeira consolidando receitas homologadas (operações por volume faturadas e serviços extras faturados).
   - `R05`: RPC consumindo `saldos_banco_horas` e batidas apuradas do Motor RH.
4. **Índices de Banco Recomendados:**
   - `idx_operacoes_volume_empresa_data` em `operacoes_volume(empresa_id, data_operacao)`.
   - `idx_custos_extras_empresa_data` em `custos_extras(empresa_id, data)`.
   - `idx_servicos_extras_empresa_data` em `servicos_extras(empresa_id, data)`.
   - `idx_diaristas_empresa_ciclo` em `diaristas_lancamentos(empresa_id, ciclo_id)`.
5. **Permissões Granulares (RBAC):**
   - Perfis de acesso para visualização de relatórios por domínio (Operacional, RH, Financeiro).

---

## 17. Declaração de Congelamento

Declaramos a **Fase 03 de UX04 — Relatórios V2 CONGELADA**:
- A Central encontra.
- O relatório contextualiza.
- O filtro recorta.
- A tabela explica.
- A exportação transporta.
- A impressão documenta.

Nenhum arquivo de produção, backend, Supabase ou Sidebar oficial foi modificado.  
Aguardando homologação do Product Owner para encerramento de UX04.
