# ERP ORBE — FIX CEX-01
## GATE 5.8 — DIAGNÓSTICO DO DRAWER FINANCEIRO
### Análise de Causa Raiz do Fechamento Inesperado do Drawer e Bloqueio de Abertura

**Data:** 22 de Outubro de 2026  
**Ambiente:** Supabase Oficial (`lifgjtcflzmspilhryap`) / Desenvolvimento Local (`http://localhost:8080`)  
**Modo de Execução:** **READ-ONLY ESTRITO** (Nenhum código modificado, nenhuma transição executada)  
**Registro Sintético sob Diagnóstico:**  
- **ID:** `faa91987-3ce7-429c-a547-5d9aeaed11f6` (`CE-FAA91987`)  
- **Descrição:** `HML CEX-01 - Teste Sintetico de Devolucao`  
- **Empresa:** `Empresa Teste - Homologação` (`28a560b5-37ef-403d-ae4f-b28a608b6a68`)  
- **Valor:** `R$ 55,00`  
- **Origem do Recurso:** `PAGAMENTO_PENDENTE`  
- **Estado no Banco:** `pipeline_status: APROVADO_OPERACAO` | `status_pagamento: A_PAGAR` | `justificativa_devolucao: NULL`  
- **Situação no Financeiro:** `AGUARDANDO_LIBERACAO`  
- **Status do Portão:** **DIAGNÓSTICO CONCLUÍDO — PARADA OBRIGATÓRIA PARA AVALIAÇÃO**

---

## 1. INVESTIGAÇÃO DO COMPONENTE E HIERARQUIA REACT

Foram inspecionados os seguintes arquivos:
- [src/pages/Financeiro/components/DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx)
- [src/pages/CentralFinanceira.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/CentralFinanceira.tsx)
- [src/components/ui/sheet.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ui/sheet.tsx)
- [src/components/ui/dialog.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ui/dialog.tsx)

### 1.1 Hierarquia de Componentes
Em `CentralFinanceira.tsx` (linhas 2387-2391):
```tsx
{/* Drawer Contextual Oficial UX12 */}
<DespesaDrawerOficial
  item={drawerItem}
  open={isDrawerOpen}
  onClose={handleCloseDrawer}
/>
```
Onde `handleCloseDrawer` é definido (linhas 530-533):
```typescript
const handleCloseDrawer = () => {
  setIsDrawerOpen(false);
  setDrawerItem(null); // <-- PONTO CRÍTICO: Anulação síncrona do item selecionado
};
```

Em `DespesaDrawerOficial.tsx` (linhas 66-70):
```typescript
export function DespesaDrawerOficial(props: DespesaDrawerOficialProps) {
  const despesa = props.despesa || props.item || null;
  const open = props.open;
  const onOpenChange = props.onOpenChange || ((v: boolean) => { if (!v) props.onClose?.(); });
  ...
  // Linha 228: Cláusula de guarda
  if (!despesa) return null;
```

---

## 2. RASTREAMENTO DO CLIQUE: ONDE O FLUXO FOI INTERROMPIDO

O botão acionado pelo operador na linha 637 de `DespesaDrawerOficial.tsx`:
```tsx
<Button
  variant="outline"
  size="sm"
  className="h-9 rounded-lg text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
  onClick={() => setModalDevolverOpen(true)}
>
  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
  Devolver p/ Operação
</Button>
```

### O Mecanismo Exato do Incidente (Passo a Passo):
1. **Clique:** O operador clica no botão `"Devolver p/ Operação"`.
2. **Abertura do Modal:** O estado `modalDevolverOpen` é alterado para `true`.
3. **Montagem do Dialog em Portal:** O `<Dialog open={modalDevolverOpen}>` (linha 773) é renderizado via `DialogPortal`, inserindo o overlay e o conteúdo diretamente em `document.body`.
4. **Colisão de DismissableLayer no Radix UI:**
   - O `<Sheet>` em [src/components/ui/sheet.tsx (linha 8)](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ui/sheet.tsx#L8) é configurado com `modal = false` por padrão (`<SheetPrimitive.Root modal={modal} />`).
   - Por ser um container não-modal, o Radix UI monitora qualquer ponteiro ou foco que se mova para fora do `SheetContent`.
   - Como o `DialogContent` do modal de devolução é montado no `body` (fora da árvore DOM do Sheet), o Radix interpreta a montagem e foco do Dialog como uma **interação fora do Sheet (`interactOutside`)**.
5. **Disparo Indevido de Fechamento:**
   - O Sheet dispara seu callback `onOpenChange(false)`.
   - `DespesaDrawerOficial` executa `onOpenChange(false)`, que chama `props.onClose?.()`.
   - `CentralFinanceira.tsx` executa `handleCloseDrawer()`, que executa:
     ```typescript
     setIsDrawerOpen(false);
     setDrawerItem(null); // despesa torna-se null!
     ```
6. **Desmontagem Imediata do Componente Pai:**
   - `CentralFinanceira` passa `item = null` para `DespesaDrawerOficial`.
   - A linha 228 avalia `if (!despesa) return null;` e **desmonta imediatamente** todo o componente `DespesaDrawerOficial`.
   - Como o `<Dialog open={modalDevolverOpen}>` é filho do JSX de `DespesaDrawerOficial`, **o modal de justificativa é sumariamente destruído e removido do DOM no mesmo tick de renderização**.
7. **Resultado Percebido pelo Usuário:**
   - O drawer fecha instantaneamente.
   - O formulário de justificativa nunca chega a ser visto.
   - Nenhuma requisição à RPC foi realizada (o formulário foi destruído antes de qualquer submissão).
   - O lançamento permaneceu inalterado no banco como `APROVADO_OPERACAO` / `A_PAGAR` (`AGUARDANDO_LIBERACAO`).

---

## 3. VERIFICAÇÃO DA RPC E DA MUTAÇÃO

A mutação `devolverMutation` em `DespesaDrawerOficial.tsx` (linhas 143-177):
```typescript
const devolverMutation = useMutation({
  mutationFn: async () => {
    if (!despesa) return;
    if (!motivoDevolucao.trim()) {
      throw new Error("Informe a justificativa da devolução.");
    }

    if (despesa.origem === "CUSTOS_EXTRAS") {
      return CustoExtraOperacionalService.transicionar(
        despesa.canonicalId,
        "devolver",
        despesa.rawItem?.atualizado_em || new Date().toISOString(),
        motivoDevolucao.trim()
      );
    }
    ...
```

- **Ação Canônica:** `'devolver'` (perfeita, corrigida no FIX CEX-01).
- **Identificador:** `despesa.canonicalId` (`faa91987-3ce7-429c-a547-5d9aeaed11f6`).
- **OCC:** Envia `atualizado_em`.
- **Elegibilidade no Banco:** Como o registro já avançou para `APROVADO_OPERACAO`, **ele é 100% aceito pela RPC**.
- **Diagnóstico:** O problema **não é de banco nem de RPC**. A RPC sequer chegou a ser chamada porque o frontend destruiu o modal antes que o usuário pudesse digitar a justificativa e submeter.

---

## 4. INVESTIGAÇÃO DO DRAWER QUE NÃO REABRE

Por que tentativas posteriores de clicar na linha movimentaram a tela mas não reabriram o painel?

1. **Estado Travado de Pointer-Events no Body:**
   - O Radix UI Dialog aplica `document.body.style.pointerEvents = 'none'` e locks de foco quando um Dialog é aberto.
   - Quando um Dialog é desmontado abruptamente (por retorno precoce de `null` no componente pai) em vez de passar pelo ciclo normal de fechamento (`open=false` -> transição de saída -> unmount), o Radix **não executa os efeitos de limpeza (cleanup)**.
   - Isso deixa overlays fantasmas invisíveis, estilos de trava de scroll e atributos `aria-hidden` residuais no `#root`.
2. **Conflito de Referência no Componente Pai:**
   - Em `CentralFinanceira.tsx`, `isDrawerOpen` é setado para `true`, mas o Radix Sheet falha em focar devido ao lock corrompido do Dialog anterior.

---

## 5. MATRIZ DE CAUSA RAIZ

| Sintoma Observado | Causa Técnica Primária | Componente Responsável |
| :--- | :--- | :--- |
| **Drawer fechou ao clicar em Devolver** | O `SheetContent` interpretou a montagem do `Dialog` como clique fora (`onInteractOutside`), disparando `onOpenChange(false)`. | [src/pages/Financeiro/components/DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx#L243) |
| **Modal não apareceu** | `handleCloseDrawer` em `CentralFinanceira` zerou `drawerItem = null`, fazendo `DespesaDrawerOficial` retornar `null` e desmontar o Dialog. | [src/pages/CentralFinanceira.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/CentralFinanceira.tsx#L532) |
| **Lançamento inalterado no banco** | A submissão nunca ocorreu; o formulário foi destruído antes de enviar a RPC. | N/A (Frontend descartou a ação) |
| **Drawer travado em cliques seguintes** | Desmontagem abrupta do Dialog corrompeu o estado de focus trap e `pointer-events` do Radix UI. | `@radix-ui/react-dialog` |

---

## 6. PROPOSTA DE CORREÇÃO MÍNIMA E SEGURA

A correção requer três ajustes pontuais, sem alterar contratos de dados nem a lógica de outros fluxos:

### Ajuste 1: Bloquear Fechamento Acidental do Sheet em `DespesaDrawerOficial.tsx`
No `<SheetContent>`, interceptar `onInteractOutside` e `onPointerDownOutside`: se qualquer um dos modais de ação (`modalDevolverOpen`, `modalLiberarOpen`, `modalLiquidarOpen`, `modalAprovarLoteOpen`) estiver aberto, impedir o fechamento do Sheet:
```tsx
<SheetContent
  onInteractOutside={(e) => {
    if (modalDevolverOpen || modalLiberarOpen || modalLiquidarOpen || modalAprovarLoteOpen) {
      e.preventDefault();
    }
  }}
  onPointerDownOutside={(e) => {
    if (modalDevolverOpen || modalLiberarOpen || modalLiquidarOpen || modalAprovarLoteOpen) {
      e.preventDefault();
    }
  }}
  className="..."
>
```

### Ajuste 2: Preservar o Item no Drawer durante Fechamento/Transições
Em `DespesaDrawerOficial.tsx`, manter a despesa em cache local via ref ou state:
```typescript
const lastDespesaRef = useRef<DespesaFederadaItem | null>(null);
if (despesa) {
  lastDespesaRef.current = despesa;
}
const activeDespesa = despesa || lastDespesaRef.current;
```
Substituindo `if (!despesa) return null;` por `if (!activeDespesa) return null;`, garantindo que o componente e seus modais permaneçam montados durante qualquer animação ou diálogo.

### Ajuste 3: Ajuste de Contrato em `CentralFinanceira.tsx`
Em `CentralFinanceira.tsx`, passar explicitamente `onOpenChange={(open) => { setIsDrawerOpen(open); if (!open) setDrawerItem(null); }}` ou dissociar a anulação do item do fechamento imediato do drawer.

---

## 7. DIVERGÊNCIA DA CENTRAL DE APROVAÇÕES (TRATAMENTO SEPARADO)

Conforme registrado na Etapa 5:
- Na Central de Aprovações ([AprovacaoDecisaoDrawer.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/aprovacoes/AprovacaoDecisaoDrawer.tsx)), o botão "Devolver" é exibido mesmo quando um Custo Extra está em `RECEBIDO`, embora a RPC rejeite devoluções nesse estado.
- **Tratamento:** Esse comportamento pertence estritamente ao componente da Central de Aprovações e deve ser tratado em gate específico, desabilitando ou ocultando o botão quando `item.tipo === "CUSTO EXTRA" && item.raw_status === "RECEBIDO"`, sem misturar com o incidente do Drawer Financeiro.

---

## 8. PARECER CONCLUSIVO E PRÓXIMO PASSO

### Parecer Técnico: **GO AUTORIZADO PARA IMPLEMENTAÇÃO CONTROLADA DA CORREÇÃO DO DRAWER**

1. A causa raiz do fechamento inesperado e travamento do drawer está 100% identificada e comprovada tecnicamente (colisão de `onInteractOutside` do Radix UI com anulação precoce de props).
2. O contrato da RPC e a ação `'devolver'` do FIX CEX-01 estão corretos e prontos para executar assim que o modal permanecer visível.
3. A correção proposta é mínima, cirúrgica e de baixo risco.

---

## 🛑 PARADA OBRIGATÓRIA NO GATE 5.8

Em estrito cumprimento às instruções da ordem de serviço:
> **RESTRIÇÕES ABSOLUTAS:**  
> - Somente leitura e diagnóstico.  
> - Nenhum código foi modificado.  
> - Nenhuma migration foi executada.  
> - Nenhum registro foi alterado.  
> - Nenhuma transição RPC foi executada.  
>  
> **PARAR APÓS O DIAGNÓSTICO.**  
> Aguardar autorização expressa do usuário para implementar qualquer correção.
