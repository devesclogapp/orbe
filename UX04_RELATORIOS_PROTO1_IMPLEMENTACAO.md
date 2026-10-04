# UX04 — RELATÓRIOS V2: PROTÓTIPO 1 (UX LAB)
## Documentação Técnica de Implementação e Validação

---

## 1. RESUMO EXECUTIVO

Em conformidade estrita com o prompt de homologação da **FASE 02 — PROTÓTIPO 1 | CENTRAL DE RELATÓRIOS (UX04)**, foi construído no ambiente isolado do **UX Lab** o primeiro protótipo funcional da **Central de Relatórios V2**.

### Diretrizes Centrais Atendidas:
1. **Preservação Absoluta de Produção**:
   - Zero alterações em `/relatorios` de produção;
   - Zero alterações em backend, Supabase, migrations, RPCs, RLS, services existentes e Sidebar de produção.
2. **Exclusão Categórica de R06**:
   - O candidato *R06 — Produtividade da Equipe Operacional* permanece expressamente bloqueado e inexistente na plataforma.
3. **Catálogo dos 6 Relatórios Homologados**:
   - **OPERACIONAL**: `R01 — Analítico de Operações por Volume`, `R04 — Custos Extras Operacionais`, `R07 — Analítico de Serviços Extras`.
   - **PESSOAS & RH**: `R02 — Fechamento de Diaristas`, `R05 — Consolidado de Banco de Horas`.
   - **FINANCEIRO & FATURAMENTO**: `R03 — Faturamento e Receitas`.
4. **Três Relatórios com Implementação Completa no Protótipo**:
   - **R01**: Colunas homologadas de operações por volume, com filtros por Empresa, Período, Transportadora, Serviço e Status.
   - **R05**: Estritamente em Horas/Minutos (sem R$, sem Passivo Trabalhista, sem Provisão).
   - **R03**: Faturamento operacional com segregação de origens legítimas (sem Custos Extras computados como receita).
5. **Três Relatórios em Estado Canônico de Preparação**:
   - **R02**, **R04**, **R07**: Exibem tela canônica com banner explicativo *"Protótipo em Preparação no UX Lab"*, indicando que o relatório está auditado e estruturalmente homologado para a próxima etapa.

---

## 2. ARQUITETURA E ROTAS DO UX LAB

### 2.1 Rotas Registradas em `src/App.tsx`
- `/ux-lab/relatorios`: Central de Relatórios V2 (Hub unificado com busca, seções por domínio e metadados).
- `/ux-lab/relatorios/:reportId`: Página de Consulta e Extração de Relatório Específico (template canônico).

### 2.2 Componentes e Arquivos Criados
1. [`src/pages/UxLab/relatoriosMockData.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/relatoriosMockData.ts):
   - Catálogo formal `RELATORIOS_CATALOGO` com os 6 relatórios autorizados;
   - Datasets segregados por empresa (`emp-01`: ESC LOG Matriz Castanhal, `emp-02`: ESC LOG Filial Belém, `emp-03`: ESC LOG Filial Marabá) sem rateio;
   - Tipos e interfaces estritas para R01, R05 e R03.
2. [`src/pages/UxLab/UxLabRelatoriosHub.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/UxLabRelatoriosHub.tsx):
   - Central de Relatórios profissional (sem card wall, sem gráficos de dashboard, formato editorial ERP de alta densidade);
   - Busca instantânea por código, nome ou descrição;
   - Agrupamento visual por Domínios (Operacional, Pessoas & RH, Financeiro & Faturamento);
   - Suporte completo a Dark V4 e Light mode.
3. [`src/pages/UxLab/UxLabRelatorioView.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/UxLabRelatorioView.tsx):
   - Template canônico com Breadcrumb (`Relatórios / [Domínio]`), título e metadados;
   - Barra de filtros estruturais: Empresa obrigatória + Período semântico + Filtros específicos;
   - Síntese contextual enxuta (2–4 KPIs reais derivados do dataset filtrado);
   - Tabela analítica com alinhamento profissional (textos à esquerda, números/datas centralizados ou à direita, moedas à direita);
   - Menu de Exportação integrado:
     - **CSV**: Geração client-side com UTF-8 BOM (`\uFEFF`) e delimitador `;`, respeitando filtros ativos;
     - **Imprimir / PDF**: `@media print` gerencial que oculta sidebar, topbar e filtros interativos, renderizando um cabeçalho institucional limpo para papel/PDF;
   - Rastreabilidade via affordance discreta (*"Origem"* / chevron) documentando o vínculo futuro com os módulos transacionais;
   - Tratamento elegante para relatórios em preparação (`R02`, `R04`, `R07`).

---

## 3. ESPECIFICAÇÃO DOS RELATÓRIOS PROTOTIPADOS

### 3.1 R01 — Analítico de Operações por Volume
- **Domínio**: Operacional
- **Colunas Homologadas**:
  - `Data` (DD/MM/AAAA)
  - `Código` (OP-XXXX)
  - `Unidade`
  - `Transportadora`
  - `Serviço` (Descarga, Carregamento, Transbordo, Paletização)
  - `Carga` (Seca, Fracionada, Paletizada, Refrigerada)
  - `Quantidade` (alinhado à direita)
  - `Valor Unitário` (R$)
  - `Total Bruto` (R$)
  - `Materiais` (R$)
  - `ISS` (R$)
  - `Placa`
  - `NF` (Sim / Não com badge semântico)
  - `Status` (Concluído, Validado RH, Faturado, Pendente)
- **Filtros**: Empresa (obrigatório), De/Até (data_operacao), Transportadora, Serviço, Status.
- **Rastreabilidade**: Nenhuma cota ou métrica de produtividade individual (confirmando a exclusão de R06).

### 3.2 R05 — Consolidado de Banco de Horas
- **Domínio**: Pessoas & RH
- **Métrica Exclusiva**: Horas e Minutos formatados (`+HH:MM` ou `-HH:MM`).
- **Colunas**:
  - `Matrícula`
  - `Colaborador`
  - `Função`
  - `Saldo Atual` (verde para positivo, vermelho para negativo)
  - `Créditos`
  - `Débitos`
  - `A Vencer (30d)`
  - `Vencidas`
  - `Situação de Risco` (Normal, A Vencer, Vencido)
- **Filtros**: Empresa (obrigatório), Competência de Referência (mês/ano), Situação de Risco.
- **Regra de Blindagem**: Proibido estritamente qualquer menção a valores monetários (R$), passivo trabalhista, provisão ou encargos.

### 3.3 R03 — Faturamento e Receitas
- **Domínio**: Financeiro & Faturamento
- **Colunas**:
  - `Competência`
  - `Cliente Tomador`
  - `Modalidade` (Faturamento Mensal, À Vista, Boleto 15d, Boleto 30d)
  - `Origem do Faturamento` (Operação por Volume, Serviço Extra)
  - `Valor Faturado` (R$)
  - `Vencimento` (DD/MM/AAAA)
  - `Recebimento` (Data ou "—")
  - `Status Financeiro` (A Faturar, Faturado, Liquidado, Em Atraso)
- **Filtros**: Empresa (obrigatório), Competência, Modalidade, Status Financeiro.
- **Regra de Blindagem**: Custos Extras operacionais NÃO compõem receita (permanecem exclusivamente despesas).

---

## 4. DESIGN SYSTEM E EXPERIÊNCIA VISUAL

- **Neutralidade por Padrão**: Base `#0A0D14` / `#111622` no Dark V4 e `#F8FAFC` no Light Mode.
- **Cor por Significado**:
  - Azul Royal (`#2563EB`) para foco funcional, seleção ativa e chamadas à ação;
  - Verde (`emerald`) exclusivamente para saldos positivos, liquidações e status concluídos;
  - Âmbar (`amber`) para prazos a vencer, pendências e aguardo;
  - Vermelho (`rose`) para débitos, atrasos e vencimentos ultrapassados.
- **Sem Card Wall**: Lista editorial em linhas compactas com superfícies discretas, badges institucionais monocromáticos e chevrons de navegação.
- **Impressão Limpa**:
  - Estilos `@media print` formatam folha A4 com fonte legível, margens adequadas, cabeçalho de controle e rodapé com data de emissão;
  - Ocultação de menus, sidebars, botões e controles interativos.

---

## 5. BATERIA DE TESTES E QUALIDADE

### 5.1 Testes Automatizados Vitest
Arquivo: [`src/test/ux_relatorios_v2_proto1.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/ux_relatorios_v2_proto1.test.tsx)
- Teste 1: Central de Relatórios exibe os 3 domínios corretos e lista os 6 relatórios autorizados (e valida ausência de R06) — **PASSED**
- Teste 2: Busca rápida filtra relatórios por código, título ou descrição — **PASSED**
- Teste 3: R01 renderiza colunas homologadas e totalizadores contextuais — **PASSED**
- Teste 4: R05 opera estritamente em Horas/Minutos (sem R$, sem Passivo, sem Provisão) — **PASSED**
- Teste 5: R03 exibe faturamento correto e NÃO inclui Custos Extras — **PASSED**
- Teste 6: Relatórios em preparação (R02, R04, R07) exibem estado canônico explicativo — **PASSED**
- Teste 7: Filtro de Empresa é obrigatório e segrega dados entre filiais sem rateio — **PASSED**

Resultado: **7 de 7 testes passaram (100% de aprovação)**.

### 5.2 Validações de Compilação
- `npx tsc --noEmit`: Executado com código de saída 0 (zero erros de tipo TypeScript).
- `npm run build:dev`: Build Vite concluído com sucesso em 32.50s sem qualquer quebra.

---

## 6. LIMITAÇÕES RECONHECIDAS E PRÓXIMOS PASSOS

1. **Dados em Mock**: Todos os registros são mocks do UX Lab segregados por empresa (`emp-01`, `emp-02`, `emp-03`), sem conexão com Supabase ou tabelas de produção.
2. **Relatórios R02, R04 e R07**: Não possuem tabela mock profunda neste protótipo, apresentando o estado formal de preparação para a Fase 03.
3. **Rastreabilidade**: Links para "Origem" exibem feedback visual no console indicando a rota transacional de destino quando a integração estiver madura.

---

## 7. CHECKPOINT DE HOMOLOGAÇÃO

O Protótipo 1 cumpre rigorosamente todos os critérios de aceitação:
- Navegação fluida e descoberta rápida de relatórios;
- Consulta parametrizada com Empresa obrigatória e Períodos semanticamente distintos;
- Densidade profissional para tabelas com exportação CSV e Impressão/PDF limpa;
- Isolamento total de produção e do backend.

**Status**: Pronto para validação e homologação do Product Owner.
