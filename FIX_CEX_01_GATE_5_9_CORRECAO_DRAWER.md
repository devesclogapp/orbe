# ERP ORBE — FIX CEX-01
## GATE 5.9 — CORREÇÃO CONTROLADA DO DRAWER FINANCEIRO
### Implementação Local das Proteções de Modal, Hardening de Ciclo de Vida e Validação

**Data:** 22 de Outubro de 2026  
**Ambiente:** Supabase Oficial (`lifgjtcflzmspilhryap`) / Desenvolvimento Local (`http://localhost:8080`)  
**Modo de Execução:** **IMPLEMENTAÇÃO LOCAL AUTORIZADA** (Nenhum commit, push, deploy, migration ou alteração de dados no banco)  
**Registro Sintético sob Homologação:**  
- **ID:** `faa91987-3ce7-429c-a547-5d9aeaed11f6` (`CE-FAA91987`)  
- **Descrição:** `HML CEX-01 - Teste Sintetico de Devolucao`  
- **Empresa:** `Empresa Teste - Homologação` (`28a560b5-37ef-403d-ae4f-b28a608b6a68`)  
- **Valor:** `R$ 55,00`  
- **Estado no Banco:** `APROVADO_OPERACAO` / `A_PAGAR` (100% preservado e intocado)  
- **Status do Portão:** **CORREÇÃO CONCLUÍDA — 26 TESTES APROVADOS — PARADA OBRIGATÓRIA PARA AVALIAÇÃO**

---

## 1. CAUSA RAIZ EFETIVAMENTE CONFIRMADA

O diagnóstico do GATE 5.8 foi integralmente confirmado no rastreamento de código:

1. **Colisão de `DismissableLayer` do Radix UI:**
   - O componente `<Sheet>` é configurado com `modal = false` por padrão em [src/components/ui/sheet.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ui/sheet.tsx#L8).
   - Ao clicar no botão *"Devolver p/ Operação"*, o estado `modalDevolverOpen` tornava-se `true`, renderizando o `<Dialog>` em um Portal montado em `document.body` (fora da árvore DOM do Sheet).
   - O container do Sheet detectava a montagem e foco fora de sua fronteira como um evento de clique externo (`interactOutside` / `pointerDownOutside`), disparando automaticamente `onOpenChange(false)`.
2. **Anulação Precoce de Estado no Componente Pai:**
   - O fechamento do Sheet invocava `props.onClose?.()` -> `handleCloseDrawer()` em [CentralFinanceira.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/CentralFinanceira.tsx#L530-L533).
   - `handleCloseDrawer` executava `setDrawerItem(null)`.
   - Com `despesa = null`, a cláusula de guarda `if (!despesa) return null;` em [DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx#L228) desmontava sumariamente todo o componente do drawer.
   - Como o `<Dialog open={modalDevolverOpen}>` residia no JSX de `DespesaDrawerOficial`, **o modal de justificativa era destruído e removido do DOM no mesmo milissegundo de sua abertura**, sem que o usuário pudesse vê-lo ou digitar.
3. **Bloqueio de Reabertura:**
   - A desmontagem forçada do Dialog enquanto seu estado era `open=true` corrompeu os listeners internos de trava de foco e `pointer-events: none` do Radix UI no `document.body`.

---

## 2. ARQUIVOS MODIFICADOS

Foram modificados pontual e exclusivamente dois arquivos de interface:

1. [src/pages/Financeiro/components/DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx)
   - Interceptação de `onInteractOutside` e `onPointerDownOutside` no `SheetContent`.
   - Elevação de z-index (`z-[60]`) para os 4 Dialogs de ação.
2. [src/components/aprovacoes/AprovacaoDecisaoDrawer.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/aprovacoes/AprovacaoDecisaoDrawer.tsx)
   - Resolução da divergência da Central de Aprovações: ocultação do botão "Devolver" para Custos Extras em `RECEBIDO`.
   - Proteção do Sheet contra `onInteractOutside` durante abertura do modal de justificativa do RH.
   - Elevação de z-index (`z-[60]`) para o Dialog de devolução.
3. [src/test/fix_cex_01_transicoes_custos_extras.test.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/fix_cex_01_transicoes_custos_extras.test.ts)
   - Adicionado **Grupo E** com 5 novos testes de regressão automatizados (total: 26 testes).

---

## 3. RESUMO DO DIFF

### 3.1 Em `DespesaDrawerOficial.tsx`
```diff
@@ -238,10 +238,24 @@ export function DespesaDrawerOficial(props: DespesaDrawerOficialProps) {
   const isDiaristas = despesa.origem === "DIARISTAS";
   const isIntermitentes = despesa.origem === "INTERMITENTES";
 
+  const isAnyActionModalOpen = modalLiberarOpen || modalLiquidarOpen || modalDevolverOpen || modalAprovarLoteOpen;
+
   return (
     <>
       <Sheet open={open} onOpenChange={onOpenChange}>
-        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background border-l border-border">
+        <SheetContent
+          onInteractOutside={(e) => {
+            if (isAnyActionModalOpen) {
+              e.preventDefault();
+            }
+          }}
+          onPointerDownOutside={(e) => {
+            if (isAnyActionModalOpen) {
+              e.preventDefault();
+            }
+          }}
+          className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background border-l border-border"
+        >
           {/* HEADER DO DRAWER */}
...
-        <DialogContent className="max-w-md">
+        <DialogContent className="max-w-md z-[60]">
```

### 3.2 Em `AprovacaoDecisaoDrawer.tsx`
```diff
@@ -284,6 +284,14 @@ export function AprovacaoDecisaoDrawer({
   const isIntermitenteIncompleto = item.tipo === "INTERMITENTE" && valData?.podeAprovar === false;
   const isFailClosedBloqueado = isOperacaoRestrita || isOperacaoAguardandoAprovacaoOperacional || isIntermitenteIncompleto;
 
+  // Custo Extra em RECEBIDO não permite devolução na máquina da RPC (apenas após EM_VALIDACAO / APROVADO_OPERACAO)
+  const isCustoExtraRecebido =
+    item.tipo === "CUSTO EXTRA" &&
+    ((custoExtraData as any)?.pipeline_status === "RECEBIDO" ||
+      item.raw_status === "RECEBIDO" ||
+      !item.raw_status ||
+      item.raw_status === "PENDENTE");
+
   const situacaoBadge = SITUACAO_BADGES[item.situacao] || SITUACAO_BADGES["Em análise"];
...
-        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-card border-l border-border text-foreground transition-colors duration-200">
+        <SheetContent
+          onInteractOutside={(e) => {
+            if (modalDevolucaoOpen) {
+              e.preventDefault();
+            }
+          }}
+          onPointerDownOutside={(e) => {
+            if (modalDevolucaoOpen) {
+              e.preventDefault();
+            }
+          }}
+          className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-card border-l border-border text-foreground transition-colors duration-200"
+        >
...
-              {item.situacao !== "Devolvido" && !isFailClosedBloqueado && (
+              {item.situacao !== "Devolvido" && !isFailClosedBloqueado && !isCustoExtraRecebido && (
                 <Button
                   variant="outline"
                   size="sm"
                   disabled={isAprovando || isDevolvendo}
                   onClick={() => setModalDevolucaoOpen(true)}
...
-        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
+        <DialogContent className="sm:max-w-md bg-card border-border text-foreground z-[60]">
```

---

## 4. ESTRATÉGIA ADOTADA E JUSTIFICATIVA

Conforme exigido na instrução ("Não adicionar cache por ref ou alterar o ciclo de vida de drawerItem sem necessidade comprovada"):

1. **Solução na Origem do Evento (`e.preventDefault` em `onInteractOutside`):**  
   Ao bloquear a propagação do evento de clique externo quando qualquer modal está aberto (`isAnyActionModalOpen`), o Sheet permanece aberto normalmente. Como o Sheet não dispara `onOpenChange(false)`, o componente pai não executa `handleCloseDrawer`, `drawerItem` permanece preservado no state do React e nenhum cache artificial por `useRef` se fez necessário.
2. **Preservação do Fechamento Normal:**  
   Quando nenhum modal está aberto (`isAnyActionModalOpen === false`), o Sheet continua respondendo normalmente a cliques fora, ao botão de fechar e à tecla Escape.
3. **Harmonia de Camadas (Z-Index):**  
   Os diálogos receberam `z-[60]` para garantir sobreposição visual e de ponteiro nítida sobre o Sheet (`z-50`).
4. **Resolução da Divergência da Central (Fail-Closed na Máquina de Estados):**  
   A trava `!isCustoExtraRecebido` oculta o botão "Devolver" para Custos Extras recém-lançados em `RECEBIDO` na Central de Aprovações, alinhando a interface com a regra do banco sem afetar nenhum dos outros 5 domínios (Diaristas, Intermitentes, Ponto CLT, Operações e Serviços Extras).

---

## 5. TESTES EXECUTADOS E RESULTADOS

### 5.1 Testes Unitários e de Regressão (Vitest)
Executados 26 testes automatizados em [fix_cex_01_transicoes_custos_extras.test.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/fix_cex_01_transicoes_custos_extras.test.ts):
- **Grupo A (Contrato RPC):** 7 testes aprovados.
- **Grupo B (Fila do RH):** 5 testes aprovados.
- **Grupo C (View Oficial):** 6 testes aprovados.
- **Grupo D (Preservação Financeira):** 3 testes aprovados.
- **Grupo E (Estabilização do Drawer e Central - GATE 5.9):** 5 testes aprovados.

```text
✓ src/test/fix_cex_01_transicoes_custos_extras.test.ts (26 tests) 24ms
Test Files: 1 passed (1)
Tests:      26 passed (26)
Duration:   9.22s
```

### 5.2 Validação de Tipagem TypeScript
```bash
npx tsc --noEmit
# Resultado: 0 erros, código 0.
```

### 5.3 Validação de Build de Produção
```bash
npm run build
# Resultado: ✓ built in 37.89s com 0 erros.
```

---

## 6. MATRIZ DE COMPORTAMENTO PÓS-CORREÇÃO

| Cenário de Interação | Comportamento Anterior | Comportamento Corrigido |
| :--- | :--- | :--- |
| **Clicar em "Devolver p/ Operação" no Drawer** | O drawer fechava instantaneamente e o modal era destruído. | O drawer permanece aberto; o modal de justificativa abre em destaque (`z-[60]`). |
| **Clicar em "Cancelar" no modal** | N/A (modal não aparecia). | O modal fecha suavemente; o drawer e a despesa continuam abertos e visíveis; banco intocado. |
| **Digitar justificativa e confirmar devolução** | N/A. | A RPC canônica é chamada com `devolver`, justificativa e OCC; o item é atualizado para `RECEBIDO` e o drawer fecha. |
| **Fechar o drawer normalmente (botão fechar ou clique fora)** | Funcionava com instabilidade. | Funciona normalmente e pode ser reaberto repetidas vezes sem travar. |
| **Outros modais do drawer (Liberar, Liquidar, Aprovar Lote)** | Vulneráveis ao mesmo bug de dismiss. | 100% blindados pela guarda `isAnyActionModalOpen`. |
| **Custo Extra em `RECEBIDO` na Central de Aprovações** | Exibia botão "Devolver", que falharia na RPC. | Botão "Devolver" fica oculto; apenas "Aprovar Decisão" está disponível (compatível com a RPC). |
| **Outros 5 domínios na Central de Aprovações** | Comportamento padrão. | 100% preservados e inalterados. |

---

## 7. PARECER CONCLUSIVO E PRÓXIMO PASSO

### Parecer Técnico: **GO AUTORIZADO PARA NOVA HOMOLOGAÇÃO MANUAL LOCAL**

1. A causa raiz foi corrigida de forma cirúrgica e minimalista.
2. A suíte de 26 testes de regressão passou com 100% de sucesso.
3. Não houve impacto na RPC, no banco de dados nem nos 4 lançamentos homologados de Outubro/2026.
4. O ambiente local (`http://localhost:8080`) está pronto para a revalidação da devolução do registro `CE-FAA91987`.

---

## 🛑 PARADA OBRIGATÓRIA NO GATE 5.9

Em cumprimento estrito às instruções da ordem de serviço:
> **RESTRIÇÕES ABSOLUTAS:**  
> - Não alterar dados no Supabase.  
> - Não executar RPC de transição pelo agente.  
> - Não criar novos registros sintéticos.  
> - Não realizar commit, push ou deploy.  
>  
> **PARAR APÓS IMPLEMENTAÇÃO E TESTES.**  
> Aguardar autorização expressa do usuário para executar a homologação manual.
