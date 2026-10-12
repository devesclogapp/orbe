# ERP ORBE — FIX-FINAL / ETAPA 04A
## Padronização Canônica dos Badges de Intermitentes

**Data:** 11 de Outubro de 2026  
**Status:** ✅ Concluído e Validado (31 testes automatizados aprovados, 0 erros de TypeScript)  
**Domínio:** RH / Operacional — Regime de Trabalho Intermitente  
**Referência Canônica:** [OrbeStatusBadge.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ux-lab/design-system/OrbeStatusBadge.tsx), [OrbeBadge.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ux-lab/design-system/OrbeBadge.tsx)  

---

### 1. OBJETIVO EXECUTIVO

Garantir que todos os badges de status do módulo de Intermitentes (lançamentos pontuais, lotes de fechamento, cabeçalhos de visualização e painéis de governança) tenham **exatamente a mesma aparência e comportamento visual dos badges utilizados nos demais módulos homologados do ERP ORBE**.

Foi eliminada qualquer identidade visual exclusiva ou ad-hoc de Intermitentes, garantindo alinhamento estrito ao Design System oficial do UX Lab.

---

### 2. REFERÊNCIA CANÔNICA DO DESIGN SYSTEM

A auditoria de referência inspecionou os componentes oficiais [OrbeStatusBadge.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ux-lab/design-system/OrbeStatusBadge.tsx) e telas homologadas ([CentralFinanceira.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/CentralFinanceira.tsx), [PontoJornadasClt.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Clt/PontoJornadasClt.tsx)):

| Propriedade Visual | Padrão Canônico Oficial (`OrbeStatusBadge`) |
| :--- | :--- |
| **Elemento Base** | `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5` |
| **Tipografia** | `text-[11px] font-semibold leading-none select-none tracking-tight shrink-0` |
| **Dot Indicador** | `h-1.5 w-1.5 rounded-full shrink-0` (circular, cor semântica do estado) |
| **Variante `success`** | Fundo: `bg-emerald-50 dark:bg-emerald-950/40`, Texto: `text-emerald-700 dark:text-emerald-400`, Borda: `border-emerald-200 dark:border-emerald-900/50`, Dot: `bg-emerald-600 dark:bg-emerald-400` |
| **Variante `warning`** | Fundo: `bg-amber-50 dark:bg-amber-950/40`, Texto: `text-amber-700 dark:text-amber-400`, Borda: `border-amber-200 dark:border-amber-900/50`, Dot: `bg-amber-500 dark:bg-amber-400` |
| **Variante `danger`** | Fundo: `bg-rose-50 dark:bg-rose-950/40`, Texto: `text-rose-700 dark:text-rose-400`, Borda: `border-rose-200 dark:border-rose-900/50`, Dot: `bg-rose-600 dark:bg-rose-400` |
| **Variante `info`** | Fundo: `bg-blue-50 dark:bg-blue-950/40`, Texto: `text-blue-700 dark:text-blue-400`, Borda: `border-blue-200 dark:border-blue-900/50`, Dot: `bg-blue-600 dark:bg-blue-400` |
| **Variante `neutral`** | Fundo: `bg-muted/60 dark:bg-white/[0.04]`, Texto: `text-muted-foreground dark:text-[#A0A7B2]`, Borda: `border-border/70 dark:border-white/[0.08]`, Dot: `bg-slate-400 dark:bg-slate-500` |
| **Animação Pulsante** | **NÃO utilizada** em Intermitentes para assegurar paridade estrita com o padrão de badges estáveis do ERP. |

---

### 3. SEMÂNTICA DOS STATUS E MAPEAMENTO DO DOMÍNIO

Os valores originais do banco de dados foram rigorosamente preservados. Cada status do ciclo de vida possui sua própria representação semântica e inequívoca, sem agrupamentos indevidos:

#### 3.1. Lançamentos / Jornadas Individuais ([IntermitentesTableBlock.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/IntermitentesTableBlock.tsx))

| Status no Banco | Variante Semântica | Rótulo Exibido | Dot Canônico | Significado Operacional |
| :--- | :--- | :--- | :--- | :--- |
| `RECEBIDO` | `info` | **RECEBIDO** | Azul | Importado pelo coletor / aguardando processamento |
| `FECHADO` | `warning` | **FECHADO** | Âmbar | Fechado localmente no ciclo operacional |
| `EM_LOTE` | `warning` | **EM LOTE** | Âmbar | Agrupado em lote aguardando envio ao RH |
| `AGUARDANDO_RH` / `AGUARDANDO_VALIDACAO_RH` | `warning` | **AGUARDANDO RH** | Âmbar | Na esteira de conferência e validação do RH |
| `EM_ANALISE_RH` | `warning` | **EM ANÁLISE RH** | Âmbar | Em revisão ativa pelo time de RH |
| `VALIDADO_RH` | `success` | **VALIDADO RH** | Esmeralda | Jornadas e horas conferidas pelo RH |
| `APROVADO_RH` / `APROVADO` | `success` | **APROVADO RH** | Esmeralda | Homologado formalmente pelo RH |
| `ENVIADO_FINANCEIRO` | `info` | **ENVIADO AO FINANCEIRO** | Azul | Transmitido à governança financeira |
| `FECHADO_FINANCEIRO` | `info` | **FECHADO FINANCEIRO** | Azul | Aprovado financeiramente para remessa |
| `PAGO` | `success` | **PAGO** | Esmeralda | Conciliado e liquidado via retorno bancário |
| `DEVOLVIDO` | `danger` | **DEVOLVIDO** | Vermelho/Rose | Devolvido pelo RH para correção do encarregado |
| `REJEITADO` / `REJEITADO_RH` | `danger` | **REJEITADO RH** | Vermelho/Rose | Rejeitado em definitivo pelo RH |
| `CANCELADO` | `neutral` | **CANCELADO** | Slate | Operação anulada administrativamente |
| `""` (Vazio/Nulo) | `neutral` | **SEM STATUS** | Oculto (`showDot={false}`) | Registro sem status informado |
| Status Desconhecido | `neutral` | *[Valor Literal]* | Oculto (`showDot={false}`) | Preserva valor original sem forçar cores arbitrárias |

#### 3.2. Lotes e Consolidações ([IntermitentesLotes.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesLotes.tsx))

| Função Helper | Status Entrada | Variante Semântica | Rótulo Exibido |
| :--- | :--- | :--- | :--- |
| `getRhStatusBadge` | `VALIDADO_RH`, `APROVADO_RH`, `FECHADO_FINANCEIRO`, `CNAB_GERADO`, `PAGO` | `success` | **Aprovado RH** |
| `getRhStatusBadge` | `AGUARDANDO_VALIDACAO_RH`, `EM_ANALISE_RH` | `warning` | **Em análise RH** |
| `getRhStatusBadge` | `DEVOLVIDO` | `danger` | **Devolvido RH** |
| `getRhStatusBadge` | `CANCELADO` | `neutral` | **Cancelado** |
| `getFinanceiroStatusBadge` | `AGUARDANDO_FINANCEIRO`, `VALIDADO_RH` | `info` | **Aguardando Financeiro** |
| `getFinanceiroStatusBadge` | `AGUARDANDO_PAGAMENTO`, `FECHADO_FINANCEIRO` | `info` | **Aprovado Financeiro** |
| `getFinanceiroStatusBadge` | `CNAB_GERADO` | `info` | **Remessa Gerada** |
| `getFinanceiroStatusBadge` | `PAGO`, `FINALIZADO` | `success` | **Pago / Conciliado** |
| `getFinanceiroStatusBadge` | `PENDENTE_RH`, `AGUARDANDO_VALIDACAO_RH` | `neutral` | **Pendente RH** |
| `getFinanceiroStatusBadge` | `DEVOLVIDO_RH` | `danger` | **Devolvido** |
| `getSituacaoBadge` | `PAGO` | `success` | **Pago** |
| `getSituacaoBadge` | `VALIDADO_RH`, `FECHADO_FINANCEIRO`, `CNAB_GERADO` | `success` | **Aprovado** |
| `getSituacaoBadge` | `AGUARDANDO_VALIDACAO_RH`, `EM_ANALISE_RH` | `warning` | **Em análise** |
| `getSituacaoBadge` | `DEVOLVIDO`, `DEVOLVIDO_RH` | `danger` | **Devolvido** |
| `getLoteDrawerBadge` | `PAGO` | `success` | **Pago** |
| `getLoteDrawerBadge` | `CNAB_GERADO` | `info` | **Remessa Gerada** |
| `getLoteDrawerBadge` | `FECHADO_FINANCEIRO`, `AGUARDANDO_PAGAMENTO` | `info` | **Aprovado Financeiro** |
| `getLoteDrawerBadge` | `VALIDADO_RH`, `APROVADO_RH` | `success` | **Aprovado RH** |
| `getLoteDrawerBadge` | `AGUARDANDO_VALIDACAO_RH`, `EM_ANALISE_RH` | `warning` | **Em análise RH** |
| `getLoteDrawerBadge` | `DEVOLVIDO`, `DEVOLVIDO_RH` | `danger` | **Devolvido RH** |

---

### 4. EVIDÊNCIAS COMPARATIVAS (ANTES vs. DEPOIS)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ANTES (Ad-hoc com classes customizadas e ícones arbitrários)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ • <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs font-semibold gap-1"> │
│   <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aprovado RH        │
│ • <Badge className="bg-emerald-600 text-white font-bold text-[11px]">Pago  │
│ • Animação pulse exclusiva presente em AGUARDANDO_RH                        │
│ • Ícones variados misturados sem padronização nos demais módulos            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DEPOIS (Canônico 100% alinhado com o Design System Oficial OrbeStatusBadge) │
├─────────────────────────────────────────────────────────────────────────────┤
│ • <OrbeStatusBadge status="success" label="Aprovado RH" />                  │
│   ➔ inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5        │
│     text-[11px] font-semibold leading-none                                  │
│     bg-emerald-50 text-emerald-700 border-emerald-200                       │
│     Dot indicador: h-1.5 w-1.5 rounded-full bg-emerald-600                  │
│ • Sem animações pulsantes exclusivas                                        │
│ • Formato pílula idêntico ao de Financeiro, CLT, Diaristas e Auditoria      │
│ • Cores dos tokens semânticos padrão do UX Lab                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. ARQUIVOS MODIFICADOS E PRESERVADOS

#### Arquivos Modificados (Apenas apresentação no módulo de Intermitentes)
- [src/components/operacoes/IntermitentesTableBlock.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/IntermitentesTableBlock.tsx): Mapeamento canônico unívoco dos status de lançamento com `OrbeStatusBadge` sem animação pulsante.
- [src/pages/Operacional/IntermitentesLotes.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Operacional/IntermitentesLotes.tsx): Substituição dos 4 helpers de badges (`getRhStatusBadge`, `getFinanceiroStatusBadge`, `getSituacaoBadge`, `getLoteDrawerBadge`) para renderizarem `OrbeStatusBadge` canônico.
- [src/test/fix_int_etapa04_ux_status.test.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/fix_int_etapa04_ux_status.test.tsx): Atualização das asserções da suíte de UX para validar labels canônicos e ausência de pulse.
- [src/test/intermitentes_promocao_final_e2e.test.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/intermitentes_promocao_final_e2e.test.ts): Adequação das inspeções de props dos helpers de lotes para o contrato `{ status, label }` de `OrbeStatusBadge`.

#### Arquivos Preservados (Intactos)
- [src/components/ux-lab/design-system/OrbeStatusBadge.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ux-lab/design-system/OrbeStatusBadge.tsx): Nenhuma alteração global no Design System.
- [src/components/ux-lab/design-system/OrbeBadge.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/ux-lab/design-system/OrbeBadge.tsx): Nenhuma alteração global no Design System.
- Regras de negócio, cálculos, migrations, RLS e integrações financeiras preservados integralmente.

---

### 6. VALIDAÇÃO E SUÍTE DE TESTES

#### 6.1. Validação TypeScript
```bash
npx tsc --noEmit
# Exit code: 0 (Zero erros em todo o repositório)
```

#### 6.2. Execução da Suíte Completa de Testes
```bash
npx vitest run \
  src/test/fix_int_etapa04_ux_status.test.tsx \
  src/test/conv17_etapa04_lotes_intermitentes.test.tsx \
  src/test/conv17_etapa03_intermitentes_recebidos.test.tsx \
  src/test/intermitentes_promocao_final_e2e.test.ts
```

**Resultado dos Testes:**
```
 Test Files  4 passed (4)
      Tests  31 passed (31)
   Duration  9.94s
```
- ✅ `fix_int_etapa04_ux_status.test.tsx`: 5 testes aprovados.
- ✅ `conv17_etapa04_lotes_intermitentes.test.tsx`: 6 testes aprovados.
- ✅ `conv17_etapa03_intermitentes_recebidos.test.tsx`: 5 testes aprovados.
- ✅ `intermitentes_promocao_final_e2e.test.ts`: 15 testes aprovados.

---

### 7. GOVERNANÇA E DIRETRIZES FINAIS

- Nenhum comando Git de escrita (`commit`, `push`, `add`) foi executado.
- Nenhum deploy ou migration foi acionado.
- O código está pronto e aguardando a homologação final do proprietário.
