# ERP ORBE — CONV-20 / ETAPA 02
# Relatório de Convergência Visual Controlada — Estrutura Principal & Aba Operacional

**Rota:** `/cadastros/regras-operacionais`  
**Componente Principal:** `src/pages/RegrasOperacionais.tsx`  
**Data:** 10 de Outubro de 2026  
**Status:** ✅ IMPLEMENTADO & VALIDADO (Pronto para Homologação Visual)

---

## 1. Resumo Executivo

A **Etapa 02 do CONV-20** executou a convergência visual controlada da página **Regras & Tabelas Operacionais** para o Design System canônico do ORBE (homologado na Central de Cadastros e no Dashboard Executivo).

Nesta etapa, o escopo foi estritamente delimitado à **estrutura principal da página** e à **aba Operacional**, mantendo as demais abas intactas e preservando integralmente todas as regras de precificação, cálculo, RPCs do banco e serviços de domínio.

---

## 2. Arquivos Alterados e Criados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/pages/RegrasOperacionais.tsx` | Modificado | Convergência visual da barra de abas, toolbar de filtros, tabela operacional, badges de status, tooltips acessíveis e barra de paginação canônica |
| `src/test/conv20_regras_operacionais_ui.test.tsx` | Novo | Suíte de testes automatizados unitários/integração cobrindo os 5 requisitos da Etapa 02 |
| `scratch/capture_conv20_etapa02.mjs` | Novo (Scratch) | Script Playwright para evidências pós-implementação em 1440×900 e 1366×768 |
| `CONV-20-ETAPA02-ESTRUTURA-OPERACIONAL.md` | Novo | Documento oficial de entrega da Etapa 02 |

---

## 3. Antes vs. Depois

| Aspecto | Antes (Etapa 01) | Depois (Etapa 02) |
|---|---|---|
| **Abas Fixas** | Continham menu de 3 pontos com mensagem desabilitada (*"Abas fixas não podem ser editadas"*) | Abas limpas, sem menus inúteis. Apenas abas dinâmicas mantêm menus contextuais (Editar, Duplicar, Excluir) |
| **Botão "+ Nova Aba"** | Localizado dentro do `TabsList`, misturado à navegação das abas | Reposicionado à direita da barra de navegação, com separação clara e preservação da função |
| **KPIs no Topo** | Ausentes (avaliado se deveriam ser adicionados) | **Não adicionados automaticamente**: mantida a estrutura compacta e focada para não consumir espaço vertical útil sem dados agregados confiáveis |
| **Truncamento Horizontal (1366×768)** | Coluna de Ações ficava parcialmente ou totalmente oculta; container interno com `overflow-hidden` prendia elementos | **100% corrigido**: tabela renderizada com elemento semântico (`<table min-w-[980px]>`), espaçamentos compactos (`px-2.5`) e container `overflow-x-auto scrollbar-thin`. Cabeçalho `AÇÕES` e os 4 botões ficam 100% visíveis em 1366×768 |
| **Filtros da Aba Operacional** | Apenas input de busca simples | Barra corporativa com **Busca textual**, **Select de Empresa** (Todas / Escopo Global / Empresas específicas), **Select de Status** (Todos / Ativo / Inativo), contador de regras e botão dinâmico **"Limpar filtros"** |
| **Paginação** | Ausente (tabela renderizava todas as linhas sem paginação) | **Barra oficial de paginação**: seletor nativo de linhas (15, 25, 50, 100), navegação anterior/próxima, indicador de páginas e totalizadores com anti-scroll-jump e reset de página em novos filtros |
| **Ações por Linha** | 4 botões com visual genérico e sem tooltips dedicados | Botões compactos (`h-7 w-7`) com `Tooltip` oficial, `aria-label` acessível, feedback sutil e estados hover semânticos |
| **Badges de Status** | Pílulas coloridas arredondadas clássicas | Badges discretos padrão ORBE com raio `6px`, micro-dot indicador (`h-1.5 w-1.5`) e cores semânticas controladas |

---

## 4. Decisões de Layout e Design System

1. **Ação Primária (#2563EB):**
   - O botão `+ Nova regra` utiliza o tom oficial `bg-blue-600 hover:bg-blue-700 text-white`.
   - O botão `Importar planilha` e os filtros utilizam variantes secundárias discretas (`outline` e `bg-background`).

2. **Hierarquia e Espaçamento:**
   - Tipografia alinhada ao Dashboard Executivo e CONV-19: títulos com `font-display font-bold text-base tracking-tight`, subtítulos em `text-xs text-muted-foreground`.
   - Cabeçalhos de tabela padronizados em `text-[11px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/40`.

3. **Resolução de Preço e Semântica de Filtros:**
   - O filtro de empresa distingue claramente:
     - `all`: Todas as regras
     - `global`: Regras onde `empresa_id` é nulo (escopo global do sistema)
     - `UUID`: Regras vinculadas a uma empresa específica
   - Os filtros atuam **exclusivamente na apresentação do grid**; não interferem no algoritmo de busca de preço da operação.

4. **Eliminação do Bloqueio de Overflow:**
   - Foi identificado que o componente `<Table>` de UI continha um encapsulador interno com `overflow-hidden`, que cortava a coluna de ações e impedia o scroll do wrapper externo.
   - A tabela da aba Operacional foi estruturada com elementos HTML semânticos nativos estilizados, permitindo que o container `overflow-x-auto scrollbar-thin` funcione de forma fluida.

---

## 5. Comportamentos Preservados (Garantia de Regressão Zero)

Nenhum elemento de regra de negócio, precificação ou integração foi alterado:
- ✅ `resolver_valor_operacao` mantido intacto.
- ✅ `resolver_iss_operacao` mantido intacto.
- ✅ Regras de vigência, prioridade de busca e fallbacks de produto/carga inalterados.
- ✅ RPCs e queries Supabase mantidas intactas.
- ✅ Wizard modal de cadastro/edição (`RegraOperacionalWizard`) e lógica de criação inalterados.
- ✅ Isolamento multitenant e controle de acesso (apenas Admin e Financeiro têm permissão de gravação).
- ✅ Abas dinâmicas mantidas operacionais com seus modais de criação/edição.

---

## 6. Resultados dos Testes de Homologação

### 6.1 Compilação Estática TypeScript
```bash
npx tsc --noEmit
# Resultado: 0 erros de compilação
```

### 6.2 Suíte Automatizada de Testes de Integração Visual
Arquivo: `src/test/conv20_regras_operacionais_ui.test.tsx`
Execução:
```bash
npx vitest run src/test/conv20_regras_operacionais_ui.test.tsx
```
**Resultado:**
- ✓ 1. Renderiza o cabeçalho institucional, abas limpas sem dropdowns inúteis e botão '+ Nova aba dinâmica' (506ms)
- ✓ 2. Renderiza a toolbar corporativa da aba Operacional com busca, select de Empresa e select de Status (307ms)
- ✓ 3. Paginação Canônica: Exibe 15 registros por padrão e permite navegar e alterar pageSize (527ms)
- ✓ 4. Filtro por Busca de Texto refina registros e reseta a paginação para a página 1 (414ms)
- ✓ 5. Ações na linha possuem acessibilidade com botões de ícone Tooltip e status badges padronizados (300ms)

**Total:** 5 testes passaram, 0 falhas.

---

## 7. Evidências Visuais Capturadas

As capturas de tela foram salvas no diretório `scratch/conv20_etapa02_captures/` e no diretório de artefatos:

1. **`01_etapa02_operacional_1440x900.png`**
   - Resolução 1440×900: Apresenta a estrutura limpa, toolbar corporativa, badges de status, coluna de Ações totalmente visível com os 4 botões e barra de paginação no rodapé do Card.
2. **`02_etapa02_filtro_busca_1440x900.png`**
   - Resolução 1440×900: Demonstra o comportamento de filtragem ativa por busca de texto com botão "Limpar filtros" e contador dinâmico de resultados.
3. **`03_etapa02_operacional_1366x768.png`**
   - Resolução 1366×768 (Notebook HD): Demonstra a tabela renderizada sem truncamento horizontal da coluna de ações, com todos os botões e dados perfeitamente legíveis.
4. **`04_etapa02_acoes_acessiveis_1366x768.png`**
   - Resolução 1366×768 (Notebook HD): Demonstra os botões de ação e paginação sob container com rolagem interna protegida.

---

## 8. Pendências para as Próximas Etapas

Conforme o planejamento aprovado, as demais abas permanecem intocadas e serão abordadas nas etapas subsequentes:

1. **Aba Diaristas (`tab=diaristas`):**
   - Convergência de toolbar, paginação e visual da tabela de regras diárias.
2. **Aba Meios de Pagamento (`tab=meios_pagamento`):**
   - Alinhamento de cartões/tabela de meios de pagamento e prazos.
3. **Aba Taxas e Impostos (`tab=taxas_impostos`):**
   - Alinhamento de alíquotas de ISS, taxas e vigências.
4. **Aba Períodos Operacionais (`tab=especificos`):**
   - Alinhamento de regras específicas de períodos e adicionais operacionais.

---

## 9. Próximo Passo

A Etapa 02 foi concluída com sucesso técnico e visual. Aguarda-se a **homologação visual pelo usuário** para autorizar o avanço para a Etapa 03.
