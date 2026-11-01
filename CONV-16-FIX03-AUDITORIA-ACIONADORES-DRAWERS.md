# ERP ORBE — CONV-16 / FIX 03
## AUDITORIA DE ACIONAMENTO E DESCOBERTA DOS DRAWERS CONTEXTUAIS

**Módulo:** Pessoas & RH → Diaristas  
**Rota Oficial:** `/operacional/diaristas`  
**Arquivo Auditado:** `src/pages/Rh/RhDiaristasPainel.tsx`  
**Data:** 08/10/2026  
**Natureza:** Auditoria Técnica Read-Only (Sem mutações, sem alteração de RPCs ou banco de dados)  
**Status da Auditoria:** Concluída com Diagnóstico Categórico

---

## 1. RESUMO EXECUTIVO

Durante a verificação manual da **ETAPA 02B**, o usuário relatou que os três novos Drawers laterais contextuais (`DrawerPrimarioShell`) não puderam ser acessados ou abertos na interface.

Esta auditoria técnica comprovou que:
1. **Os 3 Drawers existem e estão tecnicamente conectados:** O código JSX dos Drawers, os estados React (`openFechamento`, `openReabertura`, `openEdicao`) e as funções de disparo estão 100% íntegros. Não há falha sintática, import quebrado ou erro de runtime.
2. **Causa-Raiz Comprovada:** **Nenhum dos registros presentes na base de dados atendia aos critérios de elegibilidade de negócio** exigidos para disparar as ações.
3. **Cenário Real em Tela:** O usuário visualizava uma base com **1 diarista, 2 apontamentos (1,5 diária, R$ 210,00) agrupados em 1 lote com status `PAGO` (liquidado/conciliado)** e **0 apontamentos em aberto**.
4. **Deficiência Crítica de UX (Descoberta Silenciosa):** Em vez de exibir botões desabilitados com tooltips explicativos do bloqueio, o código adotou renderização condicional oculta (`return null` ou substituição por ícone estático de cadeado). Isso causou a sensação de que as funcionalidades haviam "sumido", quando na realidade estavam bloqueadas pelas travas de governança financeira.

---

## 2. ETAPA A — AUDITORIA READ-ONLY: MATRIZ DE ACIONADORES

Abaixo, a decomposição técnica completa de cada um dos 3 Drawers implementados na ETAPA 02B:

### 2.1 Matriz Geral de Acionadores e Condições

| Drawer | Acionador (Componente) | Localização na Interface | Condição de Renderização | Condição de Habilitação | Visível no Cenário Real? | Habilitado? | Motivo Técnico no Cenário Real |
|---|---|---|---|---|---|---|---|
| **1. Fechamento de Período** | Botão `"Fechar Período"` (`Button`) | Cabeçalho de Filtros (Linha 1189) | `!periodoBloqueado && !(loteEmCorrecaoAdmin && !isAdmin && !isRh)` | `rawEmAberto > 0` | ⚠️ **Condicional** (Oculto se empresa selecionada; visível se "Todas") | ❌ **Desabilitado** | Se empresa filtrada: `periodoBloqueado === true` (oculta o botão via `return null`). Se "Todas": `rawEmAberto === 0` (botão renderiza desabilitado em cinza). |
| **2. Reabertura de Período** | Botão `"Reabrir"` (`Button` com `RotateCcw`) | Aba *"Lotes & Ciclos"* → Tabela de Lotes → Coluna Ações (Linha 1952) | `(isAdmin \|\| isRh) && ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status)` | `podeReabrir` | ❌ **Invisível** (`return null`) | N/A | O lote em tela possui status `PAGO`. A regra de governança proíbe reabrir lotes liquidados; o componente retorna `null`, renderizando apenas o botão *"Conciliado"*. |
| **3. Edição Administrativa** | Botão de Engrenagem (`Button` com `Settings`) | Aba *"Por Diarista"* → Acordeão do Colaborador expandido → Tabela de Diárias (Linha 1654) | `podeEditarAdmin` onde `!isPago` e `(isAdmin \|\| isRh)` | Habilitado quando visível | ❌ **Invisível** (Substituído por `<Lock />`) | N/A | Como o lançamento pertence a lote `PAGO`, a linha renderiza `<Lock className="h-3.5 w-3.5" title="Registro liquidado — edição bloqueada" />` e cabeçalho avisa bloqueio financeiro. |

---

### 2.2 Detalhamento Técnico da Conexão dos Drawers

#### A. Drawer de Fechamento de Período
- **Estado React:** `openFechamento` (boolean, linha 304).
- **Handler de Abertura:** `onClick={() => setOpenFechamento(true)}` (linha 1205).
- **Componente Acionador:** Botão na barra de ferramentas superior (`RhDiaristasPainel.tsx`, linhas 1189–1207).
- **Componente Drawer:** `<DrawerPrimarioShell isOpen={openFechamento} onClose={() => setOpenFechamento(false)} title="Confirmar Fechamento de Período">` (linhas 2648–2786).
- **Ligação Estado ↔ Drawer:** **100% Íntegra.** O Drawer consome `periodoFechamentoInfo`, validações de elegibilidade e lista de apontamentos em aberto.

#### B. Drawer de Reabertura de Período
- **Estado React:** `openReabertura` (boolean, linha 308) e `loteParaReabrir` (objeto `LoteDiarista | null`, linha 309).
- **Handler de Abertura:** `onClick={() => { setLoteParaReabrir(lote); setOpenReabertura(true); }}` (linhas 1955–1958).
- **Componente Acionador:** Botão *"Reabrir"* na coluna de Ações da aba *"Lotes & Ciclos"* (`RhDiaristasPainel.tsx`, linhas 1952–1961).
- **Componente Drawer:** `<DrawerPrimarioShell isOpen={openReabertura && !!loteParaReabrir} onClose={() => { setOpenReabertura(false); setLoteParaReabrir(null); }} title="Reabrir Período Operacional">` (linhas 2282–2493).
- **Ligação Estado ↔ Drawer:** **100% Íntegra.** O Drawer consome o lote selecionado, valida motivos e tipo de reabertura (Operacional vs Administrativa).

#### C. Drawer de Edição Administrativa
- **Estado React:** `openEdicao` (boolean, linha 306) e `lancamentoEditando` (objeto `LancamentoDiarista | null`, linha 307).
- **Handler de Abertura:** `onClick={() => { setLancamentoEditando(l); setOpenEdicao(true); }}` (linhas 1654–1657).
- **Componente Acionador:** Botão `<Button size="sm" variant="ghost">` com ícone `<Settings />` na tabela de detalhe expandida da aba *"Por Diarista"* (`RhDiaristasPainel.tsx`, linhas 1653–1660).
- **Componente Drawer:** `<DrawerPrimarioShell isOpen={openEdicao && !!lancamentoEditando} onClose={() => { setOpenEdicao(false); setLancamentoEditando(null); }} title="Edição Administrativa de Lançamento">` (linhas 2495–2646).
- **Ligação Estado ↔ Drawer:** **100% Íntegra.** O Drawer consome o lançamento selecionado, recalcula valores, valida justificativa obrigatória e dispara `editarLancamentoAdmin`.

---

## 3. ETAPA B — DIAGNÓSTICO COM DADOS REAIS

A auditoria inspecionou diretamente as tabelas do banco de dados relativas à competência ativa na tela:
- Tabela `diaristas_lancamentos`: 0 registros com status `EM_ABERTO`.
- Tabela `diaristas_lotes`:
  - Lote `1bf3f73c-942e-4127-be32-bf27df39d1a5`: Período 21/09/2026 a 27/09/2026 | Status: **`PAGO`** | Valor: R$ 210,00 | Diárias: 1.5 | Qtd Apontamentos: 2.

### Diagnóstico por Drawer no Cenário Real:

1. **Por que o Drawer de Fechamento não abre?**
   - Para fechar um período, é matematicamente obrigatório haver registros pendentes (`rawEmAberto > 0`).
   - Como todos os apontamentos da semana já foram agrupados e pagos no lote anterior, `rawEmAberto = 0`.
   - Além disso, para a empresa do lote, a função `periodoBloqueado` retorna `true` (já existe lote fechado e homologado para essa semana).
   - **Resultado:** O botão fica desabilitado em cinza com a legenda `"(0)"` ou, se filtrada a empresa, é omitido da barra para evitar duplicidade de fechamento.

2. **Por que o Drawer de Reabertura não abre?**
   - A regra de negócio do ORBE define:
     ```ts
     const podeReabrir = (isAdmin || isRh) && ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status);
     ```
   - O lote em tela possui status **`PAGO`** (já passou por CNAB, remessa bancária e conciliação).
   - Reabrir um lote já liquidado no banco causaria inconsistência financeira irreversível.
   - O código executa:
     ```ts
     const exibirBotaoReabrir = podeReabrir;
     if (!exibirBotaoReabrir) return null; // Não renderiza nada!
     ```
   - **Resultado:** Na aba *"Lotes & Ciclos"*, a coluna de Ações exibe apenas a badge/botão verde *"Conciliado"*. O botão *"Reabrir"* sequer é desenhado no DOM.

3. **Por que o Drawer de Edição Administrativa não abre?**
   - Para acessar o botão de edição, o usuário precisa:
     1. Navegar até a aba *"Por Diarista"*;
     2. Clicar no chevron para expandir o colaborador;
     3. Localizar os apontamentos individuais.
   - No entanto, a regra de proteção financeira determina:
     ```ts
     const isPago = g.status === "PAGO" || (loteDoGrupo && loteDoGrupo.status === "PAGO");
     const podeEditarAdmin = (isAdmin || isRh) && !isPago;
     ```
   - Como `isPago === true`, a linha do lançamento renderiza:
     ```tsx
     {isPago ? (
       <span title="Registro liquidado — edição bloqueada pela política financeira">
         <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
       </span>
     ) : podeEditarAdmin ? (
       <Button onClick={() => { setLancamentoEditando(l); setOpenEdicao(true); }}>
         <Settings className="h-3.5 w-3.5" />
       </Button>
     ) : null}
     ```
   - **Resultado:** A interface exibe um cadeado cinza não interativo e uma tarja de advertência no topo: *"Registros liquidados — edição bloqueada pela política financeira"*.

---

## 4. ETAPA C — AUDITORIA DE EXPERIÊNCIA DO USUÁRIO (UX)

A análise ergonômica e de usabilidade revelou as seguintes fragilidades na comunicação visual:

1. **Ocultação Silenciosa de Ações (`return null` vs Botão Desabilitado):**
   - **Problema:** Quando um lote está `PAGO` ou `FECHADO_FINANCEIRO`, o botão *"Reabrir"* desaparece por completo da tabela de lotes em vez de figurar como um botão desabilitado acompanhado de tooltip explicativo (ex: *"Lote liquidado financeiramente. Reabertura bloqueada por governança"*).
   - **Consequência:** O usuário que busca testar a funcionalidade de reabertura não sabe se o botão não existe, se quebrou ou se está bloqueado.

2. **Dificuldade de Descoberta da Edição Administrativa:**
   - **Problema:** A edição administrativa está aninhada em três níveis de profundidade: Aba *"Por Diarista"* → Expansão do Card do Diarista → Ações da Tabela Interna de Apontamentos.
   - **Consequência:** Na tela principal (Grade Semanal), não há qualquer indicador de que edições pontuais com justificativa são realizadas na aba secundária.

3. **Comunicação do Fechamento Bloqueado:**
   - **Problema:** O botão *"Fechar Período"* na barra superior fica desabilitado em cinza com o texto `"Fechar Período (0)"`, mas não possui um tooltip claro informando *"Não há lançamentos em aberto para fechar nesta semana"* ou *"Este período já possui lote homologado"*.

---

## 5. ETAPA D — VERIFICAÇÃO FUNCIONAL E SEGURANÇA

Conforme as restrições estritas desta auditoria:
- **Nenhuma mutação foi executada** no banco de dados.
- **Nenhum registro foi alterado** para simular disponibilidade artificial.
- **Classificação da Abertura com Dados Reais:**
  - **Drawer de Fechamento:** Verificado como **BLOQUEADO POR ELEGIBILIDADE** (`rawEmAberto = 0`).
  - **Drawer de Reabertura:** Verificado como **BLOQUEADO POR POLÍTICA FINANCEIRA** (`status = PAGO`).
  - **Drawer de Edição:** Verificado como **BLOQUEADO POR POLÍTICA FINANCEIRA** (`status = PAGO`).
- **Comprovação de Integridade do Código dos Drawers:**
  - Sintaxe JSX de `<DrawerPrimarioShell>` testada e livre de erros.
  - O bundle do Vite compila perfeitamente sem warnings nos componentes dos Drawers.
  - A lógica de fechamento (`onClose`) reseta corretamente todos os estados associados.

---

## 6. RECOMENDAÇÕES PARA HOMOLOGAÇÃO E CORREÇÃO CONTROLADA

Para permitir que o usuário valide os 3 Drawers e desfrute de uma experiência intuitiva e transparente, recomendam-se as seguintes ações (a serem autorizadas):

### Recomendação 1 — Melhoria de Comunicação Visual (Sem quebra de governança)
1. **Botão Reabrir na Aba de Lotes:** Em vez de omitir com `return null` quando o lote for `PAGO`, renderizar o botão desabilitado com ícone de cadeado e tooltip explicativo:  
   *"Reabertura indisponível: este lote já foi liquidado pelo financeiro"*.
2. **Botão Fechar Período no Cabeçalho:** Adicionar tooltip no botão desabilitado:  
   *"Nenhum apontamento em aberto para fechamento na semana selecionada"*.
3. **Aba Por Diarista:** Manter o ícone de cadeado em registros `PAGO`, mas garantir tooltip visível e destaque visual de auditoria.

### Recomendação 2 — Procedimento para Validação Funcional E2E dos Drawers
Para testar os Drawers em homologação sem corromper o lote `PAGO` existente:
- **Para testar o Drawer de Fechamento:** Lançar 1 apontamento em aberto em uma semana futura ou aberta (ex: semana de 05/10/2026), verificando a ativação imediata do botão *"Fechar Período"*.
- **Para testar o Drawer de Reabertura e Edição:** Criar um lote de teste em ambiente de homologação com status `AGUARDANDO_VALIDACAO_RH` (período onde tanto a reabertura quanto a edição administrativa são ativas por direito de negócio).

---

## 7. CONCLUSÃO

A auditoria CONV-16 / FIX 03 atesta conclusivamente que **os três Drawers da ETAPA 02B foram implementados e conectados corretamente**. 

A impossibilidade de acionamento relatada decorreu exclusivamente do **estado dos dados em tela (lote 100% pago e ausência de novos lançamentos)**, associado à **ocultação silenciosa dos botões bloqueados** pela camada de apresentação.

Nenhum código foi alterado nesta etapa, em estrito cumprimento às instruções da tarefa.
