# ERP ORBE — FIX-FINAL / ETAPA 04
## Intermitentes — Confirmação, Devolvidos e Status

**Documento:** `FIX-FINAL-ETAPA04-INTERMITENTES-UX-STATUS.md`  
**Data:** 11/10/2026  
**Status da Etapa:** Concluída com Sucesso (Pronta para Homologação)  
**Governança:** Git limpo (nenhum comando de escrita executado: sem add, commit, push, reset, rebase, merge). Sem alterações estruturais de banco de dados ou deploy.

---

## 1. RESUMO EXECUTIVO

A Etapa 04 do plano **FIX-FINAL** do ERP ORBE concluiu com precisão cirúrgica a estabilização de interface, interação e governança do módulo de **Intermitentes**:

1. **FIX-INT-03 — Confirmação e Prevenção de Ações Repetidas:**
   - Eliminação de todos os diálogos `window.confirm()` nativos da página [IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx).
   - Implementação do diálogo modal canônico do Design System oficial (`Dialog`, `DialogHeader`, `DialogFooter`, `AlertTriangle`).
   - Resumo claro no modal antes de consolidar: empresa selecionada, competência, quantidade de apontamentos e valor total apurado.
   - Aviso de impacto operacional explícito: alerta de que os registros serão agrupados em lote imutável e encaminhados para a Validação RH.
   - Trava anti-duplo clique (`isClosingLock`) e desabilitação imediata dos botões de ação com indicador de carregamento animado (`Loader2`), impedindo envio de requisições concorrentes da mesma interação.
   - Aplicação do mesmo padrão de diálogo oficial para a reabertura de lotes devolvidos.
   - Preservação integral do contrato e da idempotência transacional de `IntermitentesLoteService.fecharPeriodo`.

2. **FIX-INT-04 — Rastreabilidade dos Devolvidos:**
   - Implementação de aba dedicada **Devolvidos ({totalDevolvidosGeral})** em [IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx), separando os itens devolvidos dos pendentes e do histórico.
   - Rastreamento e exibição do motivo da devolução, cruzando tanto anotações no item quanto observações registradas no lote pelo RH (`lotesDevolvidosMap`).
   - Exibição de banner de contexto operacional na aba de devolvidos instruindo o encarregado sobre como retificar os apontamentos.
   - Habilitação da ação de edição direta na linha (`onEdit`) tanto na aba de pendentes quanto na aba de devolvidos, viabilizando a retificação de horas, valores e vínculos sem necessidade de intervenção direta no banco.
   - Preservação estrita dos filtros de empresa, período (mês/ano) e busca textual.
   - Nenhum novo status foi criado e o isolamento por tenant foi rigorosamente mantido.

3. **FIX-INT-05 — Padronização dos Badges:**
   - Revisão e modernização de [IntermitentesTableBlock.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/IntermitentesTableBlock.tsx).
   - Eliminação de fallbacks amarelados genéricos e de badges não padronizados.
   - Adoção canônica do componente oficial do Design System: `OrbeStatusBadge` via função de domínio `getIntermitenteStatusBadge(status)`.
   - Mapeamento explícito de todos os status do ciclo de vida:
     - `RECEBIDO` ➔ `variant="info"` ("RECEBIDO", Azul)
     - `AGUARDANDO_RH`, `AGUARDANDO_VALIDACAO_RH`, `EM_ANALISE_RH`, `EM_LOTE`, `FECHADO` ➔ `variant="warning"` com `pulse={true}` ("AGUARDANDO RH", Âmbar pulsante)
     - `APROVADO_RH`, `VALIDADO_RH` ➔ `variant="success"` ("APROVADO RH", Esmeralda)
     - `ENVIADO_FINANCEIRO`, `FECHADO_FINANCEIRO` ➔ `variant="info"` ("ENVIADO AO FINANCEIRO", Azul)
     - `PAGO` ➔ `variant="success"` ("PAGO", Esmeralda)
     - `DEVOLVIDO`, `REJEITADO_RH` ➔ `variant="danger"` ("DEVOLVIDO", Rose)
     - `CANCELADO` ➔ `variant="neutral"` ("CANCELADO", Cinza)
     - Status desconhecido ➔ `variant="neutral"` com exibição literal do valor cadastrado (sem inventar equivalências).
   - Associação de ícone e `Tooltip` com `AlertTriangle` para itens devolvidos ao lado do badge, permitindo leitura imediata da justificativa da devolução pelo usuário.

---

## 2. ARQUIVOS MODIFICADOS E CRIADOS

| Arquivo | Natureza | Descrição das Modificações |
|---|---|---|
| [src/components/operacoes/IntermitentesTableBlock.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/IntermitentesTableBlock.tsx) | Produção | Integrado `OrbeStatusBadge` oficial via `getIntermitenteStatusBadge`. Expandida a interface `IntermitenteItem` para suportar `motivo_devolucao` e `observacoes`. Adicionado Tooltip de motivo de devolução ao lado do badge. |
| [src/pages/Operacional/IntermitentesRecebidos.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesRecebidos.tsx) | Produção | Substituídos diálogos nativos `window.confirm()` por diálogos canônicos do Design System (`Dialog`). Criada trava de concorrência e anti-duplo clique (`isClosingLock`). Adicionada aba dedicada para Devolvidos com contagem isolada (`totalDevolvidosGeral`). Enriquecimento automático do motivo da devolução. Habilitada edição na linha para itens devolvidos. |
| [src/test/fix_int_etapa04_ux_status.test.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/fix_int_etapa04_ux_status.test.tsx) | Testes | Suíte de testes automatizados com 5 cenários cobrindo FIX-INT-03, FIX-INT-04 e FIX-INT-05. |
| `FIX-FINAL-ETAPA04-INTERMITENTES-UX-STATUS.md` | Documentação | Relatório executivo e técnico da Etapa 04. |

---

## 3. COMPARATIVO: COMPORTAMENTO ANTERIOR VS. POSTERIOR

### 3.1 FIX-INT-03 — Diálogos de Confirmação e Prevenção de Ações Repetidas

* **Antes:**
  - O fechamento de período utilizava `window.confirm(...)` síncrono do navegador, interrompendo a thread de renderização com visual arcaico descolado do ERP ORBE.
  - Não havia apresentação detalhada dos totais consolidados no momento da confirmação.
  - Múltiplos cliques rápidos podiam provocar chamadas redundantes em interfaces mais lentas.
* **Depois:**
  - Modal oficial com `Dialog`, `DialogTitle` e `DialogDescription`.
  - Apresenta resumo em cards claros: Empresa, Competência, Quantidade de Lançamentos em Aberto e Valor Total Apurado.
  - Exibe alerta estilizado de impacto operacional: *"Aviso de Impacto Operacional: Ao confirmar, todos os apontamentos em aberto da empresa nesta competência serão agrupados em um lote fechado e encaminhados para a Validação do RH."*
  - Trava anti-duplo clique síncrona (`isClosingLock`) e desativação com spinner (`Loader2`), protegendo tanto no cliente quanto preservando a idempotência transacional no banco.
  - Reabertura de lote também protegida por diálogo modal oficial com descrição do lote e aviso de reabertura.

### 3.2 FIX-INT-04 — Rastreabilidade dos Devolvidos

* **Antes:**
  - Registros com status `DEVOLVIDO` ficavam ocultos ou misturados quando filtrados na listagem operacional.
  - O encarregado não conseguia visualizar com clareza a justificativa de devolução enviada pelo RH.
  - O botão de edição ficava desabilitado para itens devolvidos, impedindo correções pontuais de valores e horas.
* **Depois:**
  - Aba própria **Devolvidos ({totalDevolvidosGeral})** posicionada no mesmo nível de **Pendentes** e **Histórico**.
  - O filtro isola com precisão estrita: itens devolvidos (`status_pipeline === 'DEVOLVIDO'` ou `'REJEITADO_RH'`) não poluem a lista de pendentes nem o histórico.
  - Motivo da devolução mapeado e exposto na linha da tabela via ícone de alerta com Tooltip e campo explícito.
  - Edição permitida na linha (`onEdit`) para apontamentos devolvidos, habilitando o encarregado a corrigir horas trabalhadas e valor antes do novo envio.

### 3.3 FIX-INT-05 — Padronização dos Badges com OrbeStatusBadge

* **Antes:**
  - Badges renderizados com `<Badge variant="outline">` e classes de cor manuais inconsistentes.
  - Existência de fallback genérico amarelo (`bg-amber-100`) para qualquer status não previsto, gerando confusão semântica de que o registro estava "em análise".
  - Status desconhecidos não tinham tratamento explícito.
* **Depois:**
  - Substituição completa por `OrbeStatusBadge` do Design System.
  - Mapeamento determinístico de todos os estados do domínio (Info, Warning com Pulse, Success, Danger, Neutral).
  - Status desconhecidos são exibidos de forma neutra com seu valor literal, sem mascaramento nem falso positivo.

---

## 4. EVIDÊNCIAS DE TESTES AUTOMATIZADOS

### 4.1 Testes Unitários e de Integração da Etapa 04 (`fix_int_etapa04_ux_status.test.tsx`)

Comando executado:
```bash
npx vitest run src/test/fix_int_etapa04_ux_status.test.tsx
```

Resultado obtido:
```text
 ✓ src/test/fix_int_etapa04_ux_status.test.tsx (5 tests) 1323ms
   ✓ ERP ORBE — FIX-FINAL / ETAPA 04 — INTERMITENTES UX & STATUS > 1. FIX-INT-03: Substitui confirm() nativo por Diálogo Oficial com resumo, impacto e botões  687ms
   ✓ ERP ORBE — FIX-FINAL / ETAPA 04 — INTERMITENTES UX & STATUS > 2. FIX-INT-03: Previne requisições concorrentes e desabilita botões durante fechamento  463ms
   ✓ ERP ORBE — FIX-FINAL / ETAPA 04 — INTERMITENTES UX & STATUS > 3. FIX-INT-04: Exibe aba dedicada 'Devolvidos' com contagem isolada e preservação de filtros  348ms
   ✓ ERP ORBE — FIX-FINAL / ETAPA 04 — INTERMITENTES UX & STATUS > 4. FIX-INT-05: Mapeia status do domínio com OrbeStatusBadge e sem fallback amarelo enganoso  12ms
   ✓ ERP ORBE — FIX-FINAL / ETAPA 04 — INTERMITENTES UX & STATUS > 5. FIX-INT-05: Tabela IntermitentesTableBlock renderiza badges oficiais e tooltip para motivo de devolução  18ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  4.30s
```

### 4.2 Verificação Estrita de Tipos TypeScript

Comando executado:
```bash
npx tsc --noEmit
```

Resultado obtido:
```text
Exit code: 0 (Zero erros em todo o projeto)
```

### 4.3 Análise de Regressão Completa dos Módulos Relacionados

Comando executado:
```bash
npx vitest run \
  src/test/fix_int_resumo_auditoria.test.ts \
  src/test/intermitentes_fechamento_periodo_e2e.test.ts \
  src/test/conv17_etapa03_intermitentes_recebidos.test.tsx \
  src/test/conv17_fix02_acabamento_recebidos.test.tsx \
  src/test/conv17_fix03_jornadas_devolvidas.test.tsx \
  src/test/conv17_etapa04_lotes_intermitentes.test.tsx
```

Resultado obtido:
```text
 Test Files  6 passed (6)
      Tests  28 passed (28)
   Duration  9.60s
```

Todos os fluxos existentes (KPIs semânticos, fechamento de lotes, detalhamento de jornada, resumo analítico persistido FIX-INT-01 e auditoria FIX-INT-02) permanecem **100% íntegros e compatíveis**.

---

## 5. PENDÊNCIAS REMANESCENTES DO MÓDULO

1. **Pendência Arquitetural FIX-INT-02A (Identificada na Etapa 03):**
   - Transação atômica única no banco para `fecharPeriodo` (a ser executada oportunamente via migration autorizada pelo proprietário).
   - Não impacta o funcionamento operacional homologado nem a interface de usuário.

---

## 6. CRITÉRIOS PARA HOMOLOGAÇÃO DO USUÁRIO

Para validar no ambiente visual (`npm run dev` já em execução na porta local):
1. Acessar `/operacional/intermitentes`.
2. Verificar que a barra de abas apresenta agora: **Pendentes**, **Devolvidos** e **Histórico** com contadores independentes.
3. Clicar em **Devolvidos**: conferir a exibição isolada dos apontamentos devolvidos pelo RH, o banner orientativo de retificação e o ícone de aviso com o motivo da devolução.
4. Clicar no botão de edição de uma linha devolvida: verificar que o modal de edição abre e permite alterar os valores.
5. Na aba **Pendentes**, com uma empresa selecionada no filtro, clicar em **Fechar Período Intermitente**: verificar que o diálogo modal canônico do Design System é aberto, exibindo o resumo analítico e o aviso de impacto operacional.
6. Clicar em Cancelar: verificar fechamento limpo sem disparo de requisições.
7. Verificar que os status exibidos na tabela utilizam os componentes oficiais `OrbeStatusBadge` com tipografia, cores e contrastes canônicos do ERP ORBE.

---

## 7. DECLARAÇÃO DE GOVERNANÇA

- Nenhum comando de escrita Git foi executado pelo assistente (`git add`, `git commit`, `git push`, etc.).
- Nenhum deploy foi realizado.
- Nenhuma alteração estrutural em tabelas ou RLS foi aplicada.
- A Etapa 04 está concluída e aguarda validação e autorização do proprietário do ERP ORBE antes de qualquer avanço.
