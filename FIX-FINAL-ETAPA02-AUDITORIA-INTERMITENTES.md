# FIX-FINAL / ETAPA 02 — RELATÓRIO DE AUDITORIA FUNCIONAL DAS PENDÊNCIAS HISTÓRICAS
## Domínio: Regime Intermitente (Tio Digital → Lançamentos → Lotes → RH → Financeiro → CNAB/Conciliação)

---

## 1. INTRODUÇÃO E ESCOPO

O ERP ORBE concluiu com sucesso as convergências visuais **CONV-01 a CONV-23** e a padronização geométrica da **FIX-LAYOUT-01 / Etapa 02**. O presente documento executa a **Etapa 02 do FIX-FINAL**, realizando a reconciliação e auditoria funcional completa das pendências históricas do módulo de **Intermitentes**.

A automação n8n responsável pelo envio periódico de dados pode estar pausada; portanto, esta auditoria avalia a estabilidade, a integridade estrutural, a conformidade das regras de negócio, a segurança e a rastreabilidade do pipeline com os dados existentes e sob simulação determinística isolada.

> **Diretiva de Execução Estrita:** Esta auditoria é 100% de leitura e análise técnica (READ-ONLY). Nenhuma mutação foi disparada contra bancos de dados reais e nenhuma alteração em código foi persistida. A governança GIT é rigorosamente respeitada.

---

## 2. MAPA FUNCIONAL DO PIPELINE E ARQUITETURA TÉCNICA

O pipeline de Intermitentes foi concebido como um fluxo independente e desacoplado, sem rateio da produção operacional e com apuração baseada em jornadas individuais.

```
[Entrada de Dados]
Tio Digital (REP / Ponto Mobile)
   ↓ (Webhook / JSON)
supabase/functions/importar-intermitentes-tio
   ├── EmpresaResolver (cache e vínculo por CNPJ/Departamento)
   ├── Lookup Colaborador (CPF → Matrícula → Nome)
   ├── Idempotência (unique_intermitente_com_colab / sem_colab)
   └── historico_importacoes
   ↓
Tabela: lancamentos_intermitentes (status_pipeline: 'RECEBIDO')

[Captura & Apuração Operacional]
Página: IntermitentesRecebidos.tsx
   ├── Visualização de Apontamentos (IntermitentesTableBlock.tsx)
   ├── Filtros Contextuais (Empresa, Mês/Ano, Busca textual)
   ├── Edição in-place restrita (Horas, Total, Associação de Empresa)
   └── Fechamento de Período (fecharPeriodoMutation)

[Fechamento & Geração de Lotes]
Service: IntermitentesLoteService.fecharPeriodo
   ├── Null-Blocker: Expulsa registros sem empresa_id para DEVOLVIDO
   ├── Idempotency Index: (tenant_id, empresa_id, competencia)
   ├── Criação da Âncora: intermitentes_lotes_fechamento (AGUARDANDO_VALIDACAO_RH)
   └── Amarração dos Filhos: lancamentos_intermitentes (lote_fechamento_id, EM_ANALISE_RH)

[Governança e Mesa de RH]
Páginas: IntermitentesLotes.tsx | AprovacoesRh.tsx | AprovacaoDecisaoDrawer.tsx
   ├── View: vw_aprovacoes_rh_em_validacao
   ├── Verificação de Completude: verificarCompletudeLote (Fail-Closed)
   ├── Decisão RH:
   │     ├─ Aprovar: validarLote → status VALIDADO_RH → sincroniza rh_financeiro_lotes
   │     └─ Devolver: devolverLote → status DEVOLVIDO (lançamentos voltam com status DEVOLVIDO)
   └── Reabertura Operacional: reabrirLote → Lote vira CANCELADO, filhos voltam para RECEBIDO

[Transição Financeira & Contas a Pagar]
Página: CentralFinanceira.tsx | DespesaDrawerOficial.tsx
   ├── Aprovação Financeira: aprovarFinanceiro → FECHADO_FINANCEIRO / AGUARDANDO_PAGAMENTO
   └── Sincronização do Espelho: rh_financeiro_lotes & rh_financeiro_lote_itens

[Bancário & Conciliação CNAB 240]
Páginas / Services: CentralBancariaIntermitentes.tsx | CentralBancariaDrawerOficial.tsx
   ├── Validação de Beneficiários: MotorCNAB240 / cnab240-posicional
   ├── Geração de Remessa: gerarCNABParaLote → cnab_remessas_arquivos (Lote vira CNAB_GERADO)
   └── Retorno Bancário & Baixa: CnabConciliacaoService / cnabRetorno.service.ts
         ├─ Conciliação Individual por CPF / Seu Número (INT...)
         ├─ Atualização de lançamentos_intermitentes para 'PAGO'
         └─ Liquidação Integral: Quando todos estão conciliados, lote vira 'PAGO' (sem regressão)
```

### Componentes, Tabelas e Contratos do Domínio

| Camada | Identificador Técnico | Papel e Responsabilidade |
| :--- | :--- | :--- |
| **Edge Function** | `importar-intermitentes-tio/index.ts` | Ingestão JSON de ponto externo, resolução de empresa e gravação em lote |
| **Banco / Tabela 1** | `lancamentos_intermitentes` | Tabela granular de apontamentos (horas normais, HE 50/100, noturna, total) |
| **Banco / Tabela 2** | `intermitentes_lotes_fechamento` | Cabeçalho e âncora do lote fechado por competência e empresa |
| **Banco / Tabela 3** | `rh_financeiro_lotes` / `_itens` | Espelho financeiro transversal de pagamentos operacionais |
| **Banco / Tabela 4** | `audit_log` / `auditoria` | Tabelas de trilha de auditoria e conformidade corporativa |
| **Service Principal** | `IntermitentesLoteService` | Orquestrador de ciclo: fechar, listar, detalhar, validar, aprovar e gerar CNAB |
| **Mesa de RH** | `AprovacoesRh.tsx` & `AprovacaoDecisaoDrawer.tsx` | Validação cadastral fail-closed e aprovação formal do RH |
| **UI Operacional** | `IntermitentesRecebidos.tsx` & `IntermitentesLotes.tsx` | Apuração, fechamento, gestão de lotes e histórico |
| **UI Bancária** | `CentralBancariaIntermitentes.tsx` & `CentralBancariaDrawerOficial.tsx` | Emissão de remessa CNAB 240 posicional e download do arquivo |
| **Conciliação** | `CnabConciliacaoService.ts` | Processamento do retorno bancário (.RET) e baixa integral/parcial |

---

## 3. AUDITORIA DAS PENDÊNCIAS HISTÓRICAS ESPECÍFICAS

### 3.1 Clareza e Consistência dos Status
* **Status do Lote (`intermitentes_lotes_fechamento`):**
  `AGUARDANDO_VALIDACAO_RH` → `VALIDADO_RH` → `FECHADO_FINANCEIRO` → `CNAB_GERADO` → `PAGO` (com ramos de exceção `DEVOLVIDO` e `CANCELADO`).
* **Status do Lançamento (`lancamentos_intermitentes`):**
  `RECEBIDO` → `EM_ANALISE_RH` → `APROVADO_RH` → `ENVIADO_FINANCEIRO` → `PAGO` (com ramo de devolução `DEVOLVIDO`).
* **Inconsistência Detectada na UI (`IntermitentesTableBlock.tsx`):**
  A função `getStatusBadgeVariant` mapeia apenas `APROVADO_RH`, `VALIDADO_RH`, `DEVOLVIDO`, `EM_LOTE` e `AGUARDANDO_VALIDACAO_RH`. Qualquer outro status do enum do banco (ex: `EM_ANALISE_RH`, `ENVIADO_FINANCEIRO`, `PAGO`) cai no fallback âmbar (`bg-amber-500/10`), mascarando o fato de que um lançamento já está enviado ao financeiro ou pago.
* **Classificação:** **PARCIAL** (P2).

### 3.2 Resumo Persistente de Lotes Processados e `getResumoLoteIntermitente`
* **Localização:** [`src/services/domain/intermitentes.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/intermitentes.service.ts#L393-L419).
* **Diagnóstico:** O método foi desenvolvido com cálculo de conferência agregada (recalcula `realTotalHoras`, `realTotalValor`, `uniqueColabs`, `lotePayloadMatches` e `loteInconsistencies`). Todavia, **não há nenhuma chamada a este método em todo o frontend**.
* **Impacto Operacional:** Após fechar o período em `IntermitentesRecebidos.tsx` (linhas 705–748), o modal exibe apenas as propriedades estáticas gravadas no cabeçalho do lote, sem rodar a verificação de integridade entre os lançamentos filhos e o total do lote. Na tela `IntermitentesLotes.tsx`, o drawer consome apenas `getLoteDetalhe`, sem exibir os indicadores estruturados de coerência contábil de `getResumoLoteIntermitente`.
* **Classificação:** **PENDENTE CONFIRMADO** (P1 — FIX-INT-01).

### 3.3 Eventos de Auditoria `INTERMITENTE_LOTE` e `FECHAR_PERIODO`
* **Diagnóstico no Banco:** A migration `20260624000006_sprint3_audit_log.sql` criou a trigger genérica `fn_capture_audit_log()`, porém na lista de tabelas vinculadas (`target_tables`) constam `lancamentos_intermitentes`, mas **a tabela `intermitentes_lotes_fechamento` NÃO possui trigger de auditoria**.
* **Diagnóstico no Service/Frontend:** O método `fecharPeriodo` (linhas 84–207 de `intermitentes.service.ts`) e o handler de UI em `IntermitentesRecebidos.tsx` realizam mutações diretas sem invocar `AuditoriaService.log()` ou `supabase.rpc('log_audit')`. Quando o lote é fechado, nenhum evento explícito `FECHAR_PERIODO` ou `INTERMITENTE_LOTE` é gravado na trilha de auditoria corporativa.
* **Classificação:** **PENDENTE CONFIRMADO** (P1 — FIX-INT-02).

### 3.4 Prevenção de Duplo Clique, Requisições Concorrentes e Duplicação
* **Proteção em Banco de Dados (OCC / Idempotência):**
  Existe o índice único `intermitentes_lotes_fechamento_idempotency_idx` criado na migration `20260725200500_intermitentes_lotes_idempotency.sql` com a cláusula:
  `ON intermitentes_lotes_fechamento (tenant_id, empresa_id, competencia) WHERE status NOT IN ('CANCELADO', 'DEVOLVIDO')`. Tentativas de criar múltiplos lotes ativos para a mesma empresa/mês sofrem violação de constraint no banco.
* **Proteção no Frontend (`IntermitentesRecebidos.tsx`):**
  O botão possui disable reativo (`fecharPeriodoMutation.isPending`), mas a confirmação utiliza o `confirm()` nativo do navegador (linha 651), em vez de um modal formal com prevenção de múltiplos disparos e controle de concorrência.
* **Classificação:** **PARCIAL** (P2 — FIX-INT-03).

### 3.5 Indicadores de RH e Detalhamento dos Lotes
* **Página de Apuração (`IntermitentesRecebidos.tsx`):**
  Exibe 4 ExecutiveMetricCards padronizados (Colaboradores Convocados, Jornada Total, Horas Extras/Noturna, Valor Total) e fita secundária com detalhes de HE 50%, HE 100% e Adicional Noturno.
* **Mesa de RH (`AprovacoesRh.tsx` & `AprovacaoDecisaoDrawer.tsx`):**
  O drawer de aprovação do RH consome `verificarCompletudeLote(item.id)` e `getLoteDetalhe(item.id)`. Se houver colaboradores sem documentação bancária ou com ID de vínculo nulo, a trava Fail-Closed bloqueia o botão de aprovação e exibe o detalhamento exato dos campos pendentes com direcionamento para `/colaboradores`.
* **Gestão de Lotes (`IntermitentesLotes.tsx`):**
  Possui Stepper em 6 etapas e consolidação analítica com isolamento de lotes cancelados.
* **Classificação:** **RESOLVIDO** (Comportamento operacional em conformidade).

### 3.6 Persistência de Resultados após Atualização da Página
* **Diagnóstico:** As consultas utilizam TanStack Query com invalidação de cache estruturada (`["intermitentes-recebidos"]`, `["intermitentes-lotes"]`, `["lotes-intermitentes-devolvidos"]`). Recarregar a página (F5) reexecuta as queries via Supabase REST mantendo filtros informados via URL searchParams / state.
* **Classificação:** **RESOLVIDO**.

### 3.7 Mensagens de Erro e Feedback Operacional
* **Diagnóstico:** Toasts semânticos via `sonner` com `toast.success`, `toast.error` e `toast.warning`.
* **Tratamento de Exceções no Fechamento:** Mensagens explícitas como `"Para fechar o período, selecione uma empresa."` e `"A empresa selecionada pertence ao ambiente de Homologação. Alterne o seletor no topo da página..."`.
* **Classificação:** **RESOLVIDO**.

### 3.8 Rastreabilidade dos Lançamentos Devolvidos e Bloqueados
* **Diagnóstico em `IntermitentesRecebidos.tsx`:**
  A UI possui um banner de alerta para lotes devolvidos (`lotesDevolvidos.length > 0`) com botão de reabertura. No entanto, para a tabela de lançamentos individuais (`IntermitentesTableBlock.tsx`), existem apenas duas abas: `Pendentes` (`status_pipeline === 'RECEBIDO'`) e `Histórico` (`status_pipeline !== 'RECEBIDO'`).
* **Lacuna:** Quando lançamentos são devolvidos pela mesa de RH (`status_pipeline: 'DEVOLVIDO'`), eles ficam misturados no meio do histórico geral sem sub-aba ou filtro dedicado de devolução, dificultando a triagem de jornadas com inconsistências.
* **Classificação:** **PARCIAL** (P1 — FIX-INT-04).

### 3.9 Integridade do Vínculo entre Colaborador, Empresa, Lote e Tenant
* **Isolamento Multi-tenant (RLS):**
  Corrigido na migration `20260710000001_intermitentes_correcoes_criticas.sql`. Todas as operações em `lancamentos_intermitentes` e `intermitentes_lotes_fechamento` utilizam `tenant_id = public.current_tenant_id()`.
* **Defesa contra Registros Órfãos no Fechamento:**
  O método `fecharPeriodo` (linhas 106–120) expurga automaticamente registros com `empresa_id` nulo marcando-os como `DEVOLVIDO`, impedindo que lotes recebam apontamentos sem vínculo corporativo.
* **Classificação:** **RESOLVIDO**.

---

## 4. REGRA DE NEGÓCIO FUNDAMENTAL — JORNADA INDIVIDUAL vs. PRODUÇÃO OPERACIONAL

### Auditoria da Regra
No ERP ORBE, colaboradores intermitentes são convocados e remunerados sob regime específico com base nas horas trabalhadas apuradas pelo ponto eletrônico (Tio Digital), conforme estabelecido pela CLT (Art. 452-A).

1. **Desacoplamento de Rateio Operacional:**
   * A apuração em `lancamentos_intermitentes` é realizada diretamente sobre as métricas individuais:
     $$\text{total} = (\text{horas\_normais} \times \text{valor\_hora}) + (\text{he\_50} \times \text{valor\_hora} \times 1.5) + (\text{he\_100} \times \text{valor\_hora} \times 2.0) + \text{adicional\_noturno}$$
   * Não há divisão nem rateio do valor bruto faturado das operações por volume para remunerar intermitentes.
2. **Motor de Remuneração (`RemuneracaoResolver.ts`):**
   * O motor possui tratamento específico para `INTERMITENTE` (linhas 223–257):
     - Não aplica divisor mensal CLT de 220 horas (`divisorMensal: 0`, `origemDivisor: "NAO_APLICAVEL"`).
     - Determina o valor horário a partir de `valor_hora_direto`, `valor_diaria` ou `valor_base` (taxa horária pura).
3. **Segregação Contábil e DRE:**
   * A folha de intermitentes é classificada em `rh_financeiro_lotes` com `tipo: 'INTERMITENTES'` e `origem: 'OPERACIONAL'`, separada da folha CLT mensal e das diárias operacionais.
* **Classificação:** **RESOLVIDO / CONFORME**.

---

## 5. MATRIZ DE PENDÊNCIAS HISTÓRICAS DO MÓDULO INTERMITENTES

| ID | Descrição da Pendência | Origem Histórica | Arquivo & Função Responsável | Estado Atual | Evidência Técnica Objetiva | Prioridade | Risco Operacional |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **FIX-INT-01** | Resumo de fechamento de lotes não consumido | CONV-17 / Causa Raiz Lotes | `intermitentes.service.ts`<br>`getResumoLoteIntermitente()` | **PENDENTE CONFIRMADO** | Método implementado (L393-419), porém com 0 referências em telas do frontend | **P1** | Falta de validação analítica imediata pós-fechamento e no detalhe do lote |
| **FIX-INT-02** | Ausência de evento institucional de auditoria no fechamento | Governança / Sprint 3 | `intermitentes.service.ts`<br>`fecharPeriodo()` | **PENDENTE CONFIRMADO** | `app_audit_log` não possui trigger para `intermitentes_lotes_fechamento` e código não emite log explícito | **P1** | Inconformidade de compliance: ausência de trilha formal de auditoria do fechamento |
| **FIX-INT-03** | Confirmação de fechamento via diálogo nativo | CONV-17 / Etapa 03 | `IntermitentesRecebidos.tsx`<br>`onClick Fechar` | **PARCIAL** | Uso de `window.confirm()` em vez de AlertDialog padronizado com OCC | **P2** | Disparo inadvertido por operadores e quebra de padrão visual da plataforma |
| **FIX-INT-04** | Jornadas devolvidas misturadas no histórico geral | CONV-17 / FIX 02 | `IntermitentesRecebidos.tsx`<br>`activeTab & filteredData` | **PARCIAL** | Somente 2 abas (`pendentes` e `historico`). Status `DEVOLVIDO` oculto entre registros pagos | **P1** | Dificuldade operacional do encarregado em identificar e regularizar devoluções do RH |
| **FIX-INT-05** | Badges de status desconhecidos na listagem | FIX-LAYOUT / UI | `IntermitentesTableBlock.tsx`<br>`getStatusBadgeVariant` | **PARCIAL** | `EM_ANALISE_RH`, `ENVIADO_FINANCEIRO` e `PAGO` caem no fallback amarelo/âmbar genérico | **P2** | Ruído cognitivo para o operador quanto à etapa real do lançamento |
| **FIX-INT-06** | Testes de asserção estática com layout defasado | CONV-23 / Varredura | `intermitentes_lotes_etapa_e2e.test.ts`<br>`intermitentes_saneamento_pre_hml.test.ts` | **PARCIAL** | 3 testes falham por buscarem strings textuais antigas da Sidebar convergida | **P3** | Alertas espúrios no pipeline de CI/CD sem impacto em produção |

---

## 6. PROPOSTA DE CORREÇÕES CIRÚRGICAS (SEM APLICAÇÃO NESTA ETAPA)

Quando autorizada a implementação, as seguintes intervenções cirúrgicas e estritamente desacopladas devem ser realizadas:

### Proposta 1: Ativação de `getResumoLoteIntermitente` (FIX-INT-01)
1. No método `fecharPeriodoMutation.onSuccess` de `IntermitentesRecebidos.tsx`:
   - Chamar `IntermitentesLoteService.getResumoLoteIntermitente(lote.id)` para cada lote gerado.
   - Alimentar o modal de confirmação com os indicadores calculados (`realTotalHoras`, `realTotalValor`, `uniqueColabs`, `lotePayloadMatches`).
2. No componente `IntermitentesLotes.tsx`:
   - Exibir no cabeçalho do Drawer de Detalhes o selo de auditoria de integridade (`lotePayloadMatches: true`).

### Proposta 2: Emissão do Evento Canônico de Auditoria (FIX-INT-02)
1. No método `fecharPeriodo` de `intermitentes.service.ts`:
   - Após a criação do lote e atualização dos lançamentos, invocar:
     ```typescript
     await AuditoriaService.log(
       'FECHAR_PERIODO',
       'intermitentes',
       'medio',
       { loteId: lote.id, empresaId, competencia, totalRegistros: quantidade_registros, valorTotal: valor_total }
     );
     ```

### Proposta 3: Sub-Aba e Badges para Lançamentos Devolvidos (FIX-INT-04 e FIX-INT-05)
1. Em `IntermitentesRecebidos.tsx`:
   - Acrescentar a sub-aba `"devolvidos"` (`status_pipeline === 'DEVOLVIDO'`) com badge de alerta em tom vermelho/rosa.
2. Em `IntermitentesTableBlock.tsx`:
   - Mapear explicitamente as cores dos status:
     - `ENVIADO_FINANCEIRO` → Azul Índigo
     - `PAGO` → Verde Esmeralda
     - `EM_ANALISE_RH` → Roxo/Violeta
     - `DEVOLVIDO` → Rosa/Vermelho

---

## 7. CRITÉRIOS DE HOMOLOGAÇÃO PARA AS CORREÇÕES FUTURAS

1. **Critério HML-INT-01 (Conferência do Lote):**
   Ao fechar um período em `IntermitentesRecebidos.tsx`, o modal deve apresentar os dados consolidados obtidos via `getResumoLoteIntermitente`, comprovando equivalência entre o montante dos registros filhos e a âncora do lote pai.
2. **Critério HML-INT-02 (Trilha de Governança):**
   A tabela `auditoria` deve registrar uma linha com a ação `FECHAR_PERIODO`, módulo `intermitentes`, identificação do operador logado e metadados completos do fechamento.
3. **Critério HML-INT-03 (Visibilidade de Devoluções):**
   Lançamentos devolvidos pela mesa de RH devem ser imediatamente identificáveis na aba/filtro de Devolvidos com badge visual vermelho e botão de edição habilitado.
4. **Critério HML-INT-04 (Não-Regressão):**
   Preservar 100% dos testes unitários e de integração de RH, Financeiro e CNAB 240, mantendo o pipeline verde.

---

## 8. CONCLUSÃO DA AUDITORIA

O módulo de **Intermitentes** possui fundação arquitetural sólida, com separação de domínios, isolamento multi-tenant seguro e respeito rigoroso às regras de apuração por jornada sem rateio de produção.

As pendências identificadas não impedem a operação básica do sistema, mas representam oportunidades fundamentais de **fechamento de ciclo de auditoria**, **melhoria de ergonomia para o encarregado** e **ativação de rotinas contábeis já desenvolvidas**.

Este relatório encerra a **FIX-FINAL / ETAPA 02 (Auditoria Funcional — Intermitentes)** em modo **READ-ONLY**, aguardando autorização do proprietário para execução das correções.
