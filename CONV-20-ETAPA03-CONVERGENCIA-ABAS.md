# ERP ORBE — CONV-20 / ETAPA 03
## Convergência Visual das Abas Complementares — Regras & Tabelas Operacionais

**Data:** 10/10/2026  
**Rota:** `/cadastros/regras-operacionais`  
**Status da Execução:** ✅ CONCLUÍDO COM SUCESSO  
**Homologação:** Aguardando validação do usuário  

---

## 1. Sumário Executivo

A **Etapa 03 da CONV-20** concluiu a padronização visual completa das 4 abas complementares da tela de **Regras & Tabelas Operacionais**, consolidando a convergência ao Design System canônico do ORBE homologado nas etapas CONV-19 e CONV-20/Etapa 02.

Foram modernizadas:
1. **Diaristas** (`src/pages/Rh/TabRegrasDiaristas.tsx`)
2. **Meios de Pagamento** (`src/pages/Financeiro/TabMeiosPagamento.tsx`)
3. **Taxas e Impostos** (`src/components/regras/DynamicRuleTabContent.tsx` e `src/pages/Financeiro/TabTaxasImpostos.tsx`)
4. **Períodos Operacionais** (`src/components/regras/ServicosEspecificosRegrasTab.tsx`)
5. **Nomenclatura / Breadcrumb Institucional:** Uniformizado para **`Cadastros & Sistema / Regras & Tabelas Operacionais`** em todos os estados do `AppShell` em `src/pages/RegrasOperacionais.tsx`.

---

## 2. Padrões Canônicos Aplicados

### 2.1 Padronização Canônica de Status
- **Status Ativo:** Badge discreto em verde-claro com microindicador (dot de 6px), texto nítido em `emerald-700` (`dark:text-emerald-400`), borda sutil `border-emerald-200` (`dark:border-emerald-900/50`). **Eliminado qualquer verde sólido saturado e azul para ativo.**
- **Status Inativo:** Badge neutro `bg-slate-100 text-slate-600 border-slate-200` com microindicador `bg-slate-400` (`dark:bg-white/[0.04] dark:text-[#A0A7B2] dark:border-white/[0.08]`).
- **Valores e Semântica de Negócio:** Totalmente preservados; o clique de alternância de status continua disparando as mutations de domínio existentes sem alteração de contratos.

### 2.2 Padronização das Ações de Tabelas
- **Dimensões e Proporção:** Uniformizadas para botões de ícone compactos `h-7 w-7 rounded-md` com ícones de `14px` (`h-3.5 w-3.5`).
- **Acessibilidade & Tooltips:** Todas as ações (Editar, Duplicar, Excluir, Inativar) encapsuladas com `<TooltipProvider delayDuration={150}>`, `<Tooltip>`, `<TooltipTrigger>` e `<TooltipContent side="top">`.
- **Estados Visuais:** Hover neutro `hover:bg-muted/60` para ações normais; hover destrutivo com feedback de risco `hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30` mantendo os diálogos de confirmação existentes intactos.

---

## 3. Implementações Detalhadas por Aba

### 3.1 Aba Diaristas (`src/pages/Rh/TabRegrasDiaristas.tsx`)
- **Cabeçalho:** Botão `+ Nova Regra` unificado no padrão azul institucional `#2563EB` (`bg-blue-600 hover:bg-blue-700 text-white shadow-xs`).
- **Tabela:** Container `relative rounded-lg border border-border/80 overflow-x-auto scrollbar-thin bg-card` com cabeçalho em `bg-muted/30`.
- **Chips e Badges:** 
  - Códigos de marcação (`MP`, `P`) em chips mono estilizados.
  - Multiplicadores (`x 0.50`, `x 1.00`) com formatação monetária e tipografia tabular.
  - Escopo (`Global` ou Empresa) em badges mono neutros.
  - Status em badge canônico com microindicador.
- **Ações:** Botões `h-7 w-7` com tooltips para edição e inativação rápida.
- **Preservação:** Multiplicadores, códigos, escopos de empresa e regras de marcação permanecem intactos.

### 3.2 Aba Meios de Pagamento (`src/pages/Financeiro/TabMeiosPagamento.tsx`)
- **Seção 1 (Meios de Pagamento Operacionais):**
  - Substituídos os antigos badges verdes saturados `bg-emerald-500` pelo componente canônico `• Ativo` e `Inativo`.
  - Chips de Modalidade Atrelada (`À Vista (Caixa)`, `Prazo (Boleto/Fatura)`, `Ambos`) estilizados com fonte mono e bordas discretas.
  - Botão de cabeçalho `Novo Meio de Pagamento` em `#2563EB`.
  - Ações de editar e excluir padronizadas em `h-7 w-7` com tooltips descritivos.
- **Seção 2 (Prazos Comerciais de Duplicatas D+N):**
  - Banner da **Regra Padrão Global** harmonizado: removido o visual saturado anterior, adotado container sutil `bg-muted/40 border border-border/80`, ícone de globo em destaque azul corporativo e badge `D+7`.
  - Tabela de regras personalizadas por empresa alinhada com os tokens do DS (badge `DUPLICATA (Boleto)`, prazo `D+15` tabular e tag `Personalizada` em tom âmbar suave).
- **Preservação:** Regras globais D+N, exceções por empresa, modalidades financeiras e vencimentos operacionais rigorosamente mantidos.

### 3.3 Aba Taxas e Impostos (`src/components/regras/DynamicRuleTabContent.tsx` / `TabTaxasImpostos.tsx`)
- **Harmonização do Módulo:** Container principal atualizado para o card institucional `border border-border/80 bg-card rounded-xl p-4 md:p-5 shadow-xs`.
- **Cabeçalho:** Botão `+ Nova Regra` em `#2563EB` e botão secundário `Gerenciar Campos` em `variant="outline"`.
- **Tabela e Células:**
  - Header estilizado em `bg-muted/30` com alinhamento preciso por tipo de dado.
  - Coluna Percentual (`5%`) com tipografia mono tabular.
  - Colunas booleanas formatadas com badges sutis (`Sim` / `Não`).
  - Coluna Status com microdot canônico.
  - Ações na linha: `Editar`, `Duplicar` e `Excluir` em `h-7 w-7` com tooltips.
- **Preservação:** Todos os campos dinâmicos, tipos de incidência, bases de cálculo, municípios e vigências foram preservados sem nenhuma alteração funcional.

### 3.4 Aba Períodos Operacionais (`src/components/regras/ServicosEspecificosRegrasTab.tsx`)
- **Ajuda Contextual:** Box de orientação operacional harmonizado de azul sólido para container elegante `bg-muted/40 border border-border/80 text-foreground` com destaque mono em `D1C2` e `N1C5`.
- **Cabeçalho:** Botão `+ Adicionar Turno` padronizado em `#2563EB`.
- **Tabela:**
  - Período em destaque `font-mono font-bold text-foreground`.
  - Tipo de Período: chips técnicos sutis (`DIURNO` em tom âmbar e `NOTURNO` em tom púrpura).
  - Multiplicador de Turno: valor formatado `1.00x`, `1.50x`, `1.20x` em fonte mono com tooltip explicativo no cabeçalho.
  - Status em badge canônico com microindicador.
  - Linha de criação e edição inline harmonizada com controles compactos (`h-8 text-xs`).
  - Ações com tooltips: `Editar Turno`, `Duplicar Turno`, `Excluir Turno`.
- **Preservação:** Códigos D1, D2, N1, N2, multiplicadores, cálculos e fluxos de criação/edição inline 100% preservados.

---

## 4. Uniformização de Nomenclatura / Breadcrumb

Em `src/pages/RegrasOperacionais.tsx`, todos os pontos de montagem do `AppShell` foram ajustados para exibir:

```text
CADASTROS & SISTEMA / Regras & Tabelas Operacionais
```

A rota `/cadastros/regras-operacionais` foi integralmente mantida.

---

## 5. Matriz de Arquivos Modificados e Criados

| Arquivo | Tipo | Descrição da Alteração |
|---|---|---|
| `src/pages/RegrasOperacionais.tsx` | Modificado | Atualização do título institucional no AppShell e padronização dos cards das abas |
| `src/pages/Rh/TabRegrasDiaristas.tsx` | Modificado | Harmonização visual de cabeçalho, tabela, scope chip, status canônico e tooltips |
| `src/pages/Financeiro/TabMeiosPagamento.tsx` | Modificado | Remoção do verde saturado, status canônico, harmonização do banner D+N e ações |
| `src/components/regras/DynamicRuleTabContent.tsx` | Modificado | Atualização da tabela dinâmica, percentuais, status canônico e ações com tooltips |
| `src/pages/Financeiro/TabTaxasImpostos.tsx` | Modificado | Estilização do card de fallback/carregamento no padrão institucional |
| `src/components/regras/ServicosEspecificosRegrasTab.tsx` | Modificado | Harmonização do help contextual, chips de turnos, status canônico e tooltips |
| `src/test/conv20_etapa03_abas_complementares.test.tsx` | Criado | Bateria de 4 testes unitários automatizados validando a convergência das 4 abas |
| `src/test/conv20_regras_operacionais_ui.test.tsx` | Modificado | Atualização das asserções de título institucional (5 testes passando) |
| `scratch/capture_conv20_etapa03.mjs` | Criado | Script de captura automatizada Playwright em 1440×900 e 1366×768 |

---

## 6. Validação e Qualidade Técnica

### 6.1 Compilação TypeScript
Executado comando oficial:
```bash
npx tsc --noEmit
```
**Resultado:** `0` erros encontrados.

### 6.2 Testes Unitários Automatizados (Vitest)
Executado comando com ambas as suites da CONV-20:
```bash
npx vitest run src/test/conv20_regras_operacionais_ui.test.tsx src/test/conv20_etapa03_abas_complementares.test.tsx
```
**Resultado:** `2/2` test files passaram, `9/9` testes aprovados com sucesso:
- `✓ Tab Diaristas: Exibe cabeçalho harmonizado, badges de escopo/status canônicos e ações`
- `✓ Tab Meios de Pagamento: Exibe status canônico, banner global D+N harmonizado e ações com tooltips`
- `✓ Tab Taxas e Impostos: Renderiza tabela com status canônico, percentual e ações padronizadas`
- `✓ Tab Períodos Operacionais: Exibe help contextual harmonizado, turnos com chips técnicos e status canônico`
- `✓ Cabeçalho institucional e abas limpas`
- `✓ Toolbar corporativa da aba Operacional`
- `✓ Paginação Canônica (15 itens/página)`
- `✓ Filtro por Busca de Texto com reset de página`
- `✓ Ações na linha com acessibilidade e tooltips`

---

## 7. Evidências Visuais Capturadas

Todas as capturas foram obtidas com a aplicação rodando em ambiente local real autenticado e salvas no diretório de artefatos:

### Viewport 1440×900 (Desktop Padrão)
1. **Diaristas:** `01_etapa03_diaristas_1440x900.png`
2. **Meios de Pagamento:** `02_etapa03_meios_pagamento_1440x900.png`
3. **Taxas e Impostos:** `03_etapa03_taxas_impostos_1440x900.png`
4. **Períodos Operacionais:** `04_etapa03_periodos_especificos_1440x900.png`

### Viewport 1366×768 (Notebook HD)
5. **Diaristas (HD):** `05_etapa03_diaristas_1366x768.png`
6. **Meios de Pagamento (HD):** `06_etapa03_meios_pagamento_1366x768.png`
7. **Taxas e Impostos (HD):** `07_etapa03_taxas_impostos_1366x768.png`
8. **Períodos Operacionais (HD):** `08_etapa03_periodos_especificos_1366x768.png`

---

## 8. Cumprimento das Restrições e Governança

- ❌ Nenhuma regra de negócio, serviço de domínio ou RPC foi alterada.
- ❌ Nenhum schema, migration ou política RLS foi modificado.
- ❌ Nenhuma paginação ou KPI desnecessário foi introduzido nas abas complementares.
- ❌ Nenhum commit, push ou deploy foi realizado.
- ❌ Nenhuma modificação fora do escopo da CONV-20 foi realizada.

A **Etapa 03 da CONV-20** encontra-se finalizada com rigor técnico e pronta para a homologação final do usuário.
