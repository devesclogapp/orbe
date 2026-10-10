# ERP ORBE — CONV-19 / FIX 05
# RELATÓRIO TÉCNICO DE CORREÇÃO: SELETOR DE LINHAS POR PÁGINA E PRESERVAÇÃO DE ROLAGEM

**Data:** 10 de Outubro de 2026  
**Módulos Afetados:** Central de Cadastros (`/cadastros?tab=colaboradores`) e Gestão Detalhada (`/colaboradores`)  
**Status:** ✅ **CORRIGIDO E HOMOLOGADO EM VITEST (27/27) E PLAYWRIGHT E2E**

---

## 1. INVESTIGAÇÃO E COMPROVAÇÃO DA CAUSA RAIZ

### 1.1 Sintoma Relatado
Ao tentar alterar a seleção no componente "Linhas por página" no rodapé de paginação da tabela, a quantidade de registros visíveis não era atualizada corretamente e a viewport da janela saltava bruscamente para o topo (`window.scrollY = 0`).

### 1.2 Diagnóstico Técnico em Tempo Real
A inspeção do ciclo de vida e dos eventos do navegador revelou os seguintes fatos comprovados:

1. **Gestão Agressiva de Foco do Radix UI Select com Portal:**
   O componente `<Select>` da biblioteca `@radix-ui/react-select` (encapsulado em `src/components/ui/select.tsx`) renderiza seu conteúdo (`SelectContent`) dentro de `<SelectPrimitive.Portal>`, que por padrão é montado diretamente na raiz do `document.body`.
2. **Disparo de Focus sem `preventScroll`:**
   Ao clicar no `<SelectTrigger>`, o Radix Select move o foco programaticamente para o `<SelectItem>` ativo chamando `HTMLElement.prototype.focus()`. Como o item montado no Portal ainda não possui posicionamento flutuante final consolidado na árvore DOM visível, os motores de renderização (Chromium, Gecko e WebKit) interpretam a chamada de foco como uma necessidade de trazer o elemento para a tela, disparando um `scrollIntoView` automático para `(0, 0)`.
3. **Trace do Salto de Rolagem Comprovado:**
   O monitoramento via trace de eventos registrou o salto exato:
   ```text
   ScrollY antes de abrir o select: 431px
   TRACE focus em: DIV [role="option"]
       at HTMLElement.focus
       at node_modules/@radix-ui/react-select/dist/index.js
   TRACE window scroll event, scrollY = 0 (saltou de 431px para 0px!)
   ```
4. **Fechamento e Deslocamento do Popover:**
   Ao deslocar a página 431px para cima em frações de milissegundo, a barra de paginação e o trigger saíram do campo de visão do usuário. Qualquer clique subsequente ou tentativa de interação atingia áreas fora do popover, fechando o menu antes que a seleção de `50` ou `100` pudesse ser registrada.
5. **Comportamento das Queries e Estado React:**
   Confirmou-se que não havia navegação indevida de rota, reload de página ou perda do estado global. O estado `colaboradoresPageSize` e `paginatedColaboradores` estavam computacionalmente corretos, mas a mecânica do portal impedia a conclusão estável da interação pelo usuário.

---

## 2. SOLUÇÃO ARQUITETURAL IMPLEMENTADA

Para eliminar definitivamente o salto de rolagem preservando 100% o Design System e a acessibilidade, substituiu-se o wrapper flutuante com portal no rodapé da paginação por um seletor nativo `<select>` HTML5 estilizado com as mesmas classes exatas do Design System:

1. **Eliminação de Portais Externos no Body:**
   O elemento `<select>` reside estritamente na árvore DOM da barra de paginação, sem portais e sem transferência de foco artificial que desloque o `window.scrollY`.
2. **Disparo Síncrono de Evento (`onChange`):**
   A seleção dispara imediatamente a atualização de estado:
   - Atualiza `colaboradoresPageSize` (ou `pageSize`).
   - Reseta `colaboradoresPage` (ou `currentPage`) para a Página 1.
   - Atualiza imediatamente as linhas da tabela e o texto de intervalo (`1–25 de 95`, `1–50 de 95`, `1–95 de 95`).
3. **Preservação Absoluta da Rolagem:**
   Comprovado em teste automatizado: delta de deslocamento de rolagem = **0px**. O usuário permanece na mesma altura da página.
4. **Proteção Anti-Form Submit:**
   Adicionou-se explicitamente `type="button"` nos botões de navegação anterior/próxima (`<Button type="button">`), prevenindo qualquer submissão indesejada de formulários envolventes.

---

## 3. ARQUIVOS ALTERADOS

### 3.1 [`src/pages/CentralCadastros.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/CentralCadastros.tsx)
- Adicionado `ChevronDown` nos imports de `lucide-react`.
- Substituído o seletor Radix por seletor nativo com styling oficial do Design System, `id="central-cadastros-page-size"` e `aria-label="Linhas por página"`.
- Adicionado `type="button"` nos botões de página anterior e próxima página.

### 3.2 [`src/pages/Colaboradores.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Colaboradores.tsx)
- Adicionado `ChevronDown` nos imports de `lucide-react`.
- Substituído o seletor Radix por seletor nativo com styling oficial do Design System, `id="colaboradores-detalhada-page-size"` e `aria-label="Linhas por página"`.
- Adicionado `type="button"` nos botões de página anterior e próxima página.

### 3.3 [`src/test/conv19_central_cadastros_ui.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv19_central_cadastros_ui.test.tsx)
- Adicionada suíte completa de testes comportamentais do FIX 05 com 95 colaboradores fictícios exercitando:
  - Mudança progressiva de 15 -> 25 -> 50 -> 100 e retorno para 15;
  - Reset imediato para Página 1 após alteração de `pageSize`;
  - Preservação dos filtros de busca ativos ao alterar `pageSize`;
  - Preservação do cálculo integral dos 4 KPIs executivos do topo;
  - Comportamento idêntico na Gestão Detalhada (`/colaboradores`).

---

## 4. EVIDÊNCIAS DOS TESTES

### 4.1 Validação TypeScript
```bash
npx tsc --noEmit
# Exit code 0 (Zero erros de tipagem)
```

### 4.2 Suíte Vitest (27/27 Testes Aprovados)
```text
 ✓ src/test/conv19_central_cadastros_ui.test.tsx (27 tests) 16211ms
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 1. Renderiza o cabeçalho executivo institucional e as ações globais sob o AppShell
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 2. Renderiza exatamente os 4 cards executivos oficiais do Design System
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 2.1 Coerência rigorosa de dados: Total, Prontos e Pendências calculam com precisão
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 2.2 Regra Fail-Closed: Colaborador com cadastro provisório NUNCA é classificado como Pronto
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 3. Clicar nos cards filtra a tabela de colaboradores por status
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 4. Preserva integralmente as 8 abas funcionais do sistema com contadores confiáveis
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 5. Distinção Semântica: Faixa Operacional compacta distingue Aptos p/ Campo de Prontidão Integral
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 6. Faixa Operacional compacta responde a cliques e filtra os colaboradores
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 7. Busca de colaboradores por texto (Nome, CPF ou Matrícula) com botão de limpeza rápida
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 8. Botão 'Limpar filtros' restaura o estado inicial quando há filtros ativos
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 9. CONV-19 / FIX 03: Renderiza cabeçalho oficial e navegação secundária na aba Parâmetros operacionais
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > 9.1 Ações contextuais de criação são atualizadas para 'Novo produto' e 'Novo tipo de dia' nas respectivas subabas
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 04: Paginação Oficial e Gestão Detalhada > 10.2 Central de Cadastros: Navega para a segunda página e exibe 'Exibindo 16–30 de 35'
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 04: Paginação Oficial e Gestão Detalhada > 10.4 Central de Cadastros: Reset de página ocorre ao mudar filtros de busca
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 04: Paginação Oficial e Gestão Detalhada > 10.5 Gestão Detalhada (/colaboradores): Renderiza cabeçalho oficial, tabela administrativa e paginação funcional
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 05: Seletor de Linhas por Página e Preservação de Rolagem > 11.1 Central de Cadastros: Mudança progressiva de 15 -> 25 -> 50 -> 100 e retorno para 15
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 05: Seletor de Linhas por Página e Preservação de Rolagem > 11.2 Central de Cadastros: Reseta para a Página 1 imediatamente após alteração de pageSize
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 05: Seletor de Linhas por Página e Preservação de Rolagem > 11.3 Central de Cadastros: Preserva filtros de busca ativos ao alterar pageSize
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 05: Seletor de Linhas por Página e Preservação de Rolagem > 11.4 Central de Cadastros: KPIs executivos preservam cálculo integral com qualquer pageSize
   ✓ CONV-19 — ETAPA 02: Convergência Visual da Central de Cadastros > CONV-19 / FIX 05: Seletor de Linhas por Página e Preservação de Rolagem > 11.5 Gestão Detalhada (/colaboradores): Seletor de linhas por página funciona identicamente

Test Files  1 passed (1)
     Tests  27 passed (27)
```

### 4.3 Validação E2E no Navegador com Playwright
Execução com dados reais em viewport 1440×900:
```text
--- TESTE E2E FIX 05: SELETOR DE LINHAS POR PÁGINA E PRESERVAÇÃO DE ROLAGEM ---

[1] Testando Central de Cadastros (/cadastros?tab=colaboradores)...
Posição de rolagem inicial (com paginação visível): 431px
Inicial (15): 15 linhas | Intervalo: "Exibindo 1–15 de 95" | Página 1 de 7

[1.3] Alterando para 25 linhas por página...
ScrollY após mudar para 25: 431px (delta: 0px)
Resultado (25): 25 linhas | Intervalo: "Exibindo 1–25 de 95" | Página 1 de 4

[1.4] Alterando para 50 linhas por página...
ScrollY após mudar para 50: 431px (delta: 0px)
Resultado (50): 50 linhas | Intervalo: "Exibindo 1–50 de 95" | Página 1 de 2

[1.5] Alterando para 100 linhas por página...
ScrollY após mudar para 100: 431px (delta: 0px)
Resultado (100): 95 linhas | Intervalo: "Exibindo 1–95 de 95" | Página 1 de 1

[1.6] Retornando para 15 linhas por página...
Retorno (15): 15 linhas | Intervalo: "Exibindo 1–15 de 95" | Página 1 de 7

[1.7] Testando Reset de Página...
Página avançada: Intervalo: "Exibindo 16–30 de 95" | Página 2 de 7
Após mudar tamanho da página: Intervalo: "Exibindo 1–25 de 95" | Página 1 de 4

[2] Testando Gestão Detalhada (/colaboradores)...
Posição de rolagem inicial na Gestão Detalhada: 27px
Linhas iniciais Gestão Detalhada: 15
Alterando para 50 linhas por página na Gestão Detalhada...
ScrollY após 50 na Gestão Detalhada: 27px (delta: 0px)
Resultado Gestão Detalhada (50): 50 linhas | Intervalo: "Exibindo 1–50 de 95"

[3] Gerando evidência de rolagem preservada (vista com barra de paginação e tabela visíveis)...

✅ TODOS OS TESTES E2E PASSARAM COM 100% DE SUCESSO!
```

---

## 5. EVIDÊNCIAS VISUAIS CAPTURADAS (VIEWPORT 1440×900)

| Evidência | Arquivo | Descrição |
|---|---|---|
| **01** | `01_cadastros_15porpag_1440.png` | Central de Cadastros com padrão inicial de 15 registros (`Exibindo 1–15 de 95`, Página 1 de 7). |
| **02** | `02_cadastros_50porpag_1440.png` | Central de Cadastros após selecionar 50 registros (`Exibindo 1–50 de 95`, Página 1 de 2). |
| **03** | `03_cadastros_100porpag_1440.png` | Central de Cadastros após selecionar 100 registros (`Exibindo 1–95 de 95`, Página 1 de 1). |
| **04** | `04_gestao_detalhada_50porpag_1440.png` | Gestão Detalhada (`/colaboradores`) com 50 registros por página (`Exibindo 1–50 de 95`, Página 1 de 2). |
| **05** | `05_evidencia_rolagem_preservada.png` | Evidência de rolagem preservada (delta 0px) com a barra de paginação no campo de visão após a alteração. |

---

## 6. PRESERVAÇÃO E RESTRIÇÕES CUMPRIDAS

- [x] Nenhuma alteração no banco de dados, RLS, RPCs ou migrations.
- [x] Nenhuma alteração em regras de negócio, contratos ou fórmulas financeiras.
- [x] KPIs executivos mantêm o cálculo sobre o universo integral de colaboradores (95).
- [x] Design System do Dashboard Executivo (`#2563EB`, neutral slate, tabelas administrativas compactas com rolagem interna) rigorosamente preservado.
- [x] Nenhum commit ou push realizado.
- [x] Sistema estável e pronto para validação visual do usuário.
