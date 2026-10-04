# UX07 — CUSTOS EXTRAS
## FASE 01 — AUDITORIA FUNCIONAL E ARQUITETURAL CURTA + PREPARAÇÃO DA UX V2

**Data:** 03/10/2026  
**Status da Auditoria:** Concluída (Source-first / Read-only)  
**Objetivo:** Mapear o domínio real de Custos Extras no ERP ORBE — lançamento, validação, origem do recurso, obrigações financeiras, reflexo em DRE, conciliação e governança — antes da concepção do protótipo no UX Lab.

---

## 1. RESUMO EXECUTIVO

1. **O que é um Custo Extra no ORBE?**  
   É uma **despesa operacional ou administrativa** realizada no pátio ou na sede (ex.: merenda/lanche da equipe de turno, manutenção emergencial de empilhadeiras, insumos, frete/transporte, comunicação, pequenos materiais administrativos), segregada da base de receitas faturáveis e da folha de pagamento CLT/Intermitentes/Diaristas.
2. **Entidade Única:**  
   Não existe uma tabela separada `contas_a_pagar` para custos extras. A entidade `public.custos_extras_operacionais` é a própria despesa e o próprio título a pagar, contendo data de vencimento (`data_vencimento`), status financeiro (`status_pagamento`) e status operacional (`pipeline_status`).
3. **Bifurcação Crítica por Origem do Recurso (`origem_recurso`):**  
   Ao contrário de módulos anteriores, Custos Extras possui dois comportamentos financeiros totalmente distintos:
   - **`PAGO_EMPRESA` (Modelo A):** A despesa já foi desembolsada no ato pela empresa (dinheiro do caixa, cartão corporativo, PIX). A aprovação operacional encerra o ciclo: o status vira `FINALIZADO` e o pagamento vira `PAGO` imediatamente. **Não gera obrigação futura a pagar.**
   - **`REEMBOLSO_COLABORADOR` (Modelo B):** O colaborador pagou com dinheiro próprio. A aprovação operacional confirma a despesa e a encaminha para a Central de Pagamentos como `A_PAGAR`, vinculada ao colaborador (`favorecido_colaborador_id`).
   - **`PAGAMENTO_PENDENTE` (Modelo B):** Boleto, nota ou fatura a prazo de fornecedor. Encaminha-se como `A_PAGAR`, vinculada ao fornecedor (`favorecido_fornecedor_id`) e data de vencimento.
   - **`LEGACY`:** Compatibilidade histórica protegida.
4. **Governança e Hardening Implementados:**  
   - RPC com OCC (`rpc_custo_extra_transicionar`) controlando cada transição e exigindo justificativa em devoluções.
   - Trigger de imutabilidade (`trg_block_update_custos_aprovados`) que congela valores, empresa, unidade, favorecido e categoria assim que o item atinge `APROVADO_OPERACAO`.
   - Tabela de histórico e auditoria (`custos_extras_historico`).
   - Reconhecimento na DRE via competência (`data` da despesa), exigindo status a partir de `APROVADO_OPERACAO` (itens `RECEBIDO` ou `EM_VALIDACAO` não afetam o resultado econômico).

---

## 2. ARQUITETURA ATUAL E MAPA DE ARTEFATOS

### 2.1 Páginas e Rotas

| Perfil / Domínio | Rota Atual | Componente | Finalidade |
| :--- | :--- | :--- | :--- |
| **Encarregado (Móvel)** | `/producao/custos-extras` | `CustosExtrasLancamento.tsx` | Formulário wizard em etapas otimizado para smartphone, com captura de origem de recurso e favorecido. Fallback de retorno: `/producao`. |
| **Admin / Operação** | `/custos-extras/lancamentos`<br>`/operacional/custos-extras` | `CustosExtrasRecebidos.tsx` | Inbox administrativo com filtros de competência (mês/ano), KPIs de categoria e tabela `CustosExtrasTableBlock`. |
| **RH / Operação (Aprovações)** | `/custos-extras/aprovacoes` | `AprovacoesRh.tsx` (flow `CUSTO EXTRA`) | Fila de conferência técnica e aprovação operacional via `rpc_custo_extra_transicionar`. |
| **Financeiro (Pagamentos)** | `/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS` | `CentralFinanceira.tsx` | Central de liberação, autorização e baixa de despesas pendentes a pagar (`ENVIADO_FINANCEIRO`). |
| **Fechamento Mensal** | `/fechamento` | `Fechamento.tsx` | Bloqueia fechamento da competência se houver custos em `RECEBIDO` ou `EM_VALIDACAO`. |
| **DRE Operacional** | `/financeiro/dre` / `/ux-lab/dre` | `RelatorioDRE.tsx` / `UxLabDRE.tsx` | Consolida despesas extras aprovadas no resultado operacional da competência. |
| **Relatório Analítico** | `/ux-lab/relatorios/r04-custos-extras` | `UxLabRelatorioView.tsx` (R04) | Consulta analítica histórica com exportação de despesas. |

### 2.2 Migrations Canônicas

1. `20260430170000_custos_extras_operacionais.sql`: Criação da tabela base e trigger de cálculo `total = quantidade * valor_unitario`.
2. `20260520000001_custos_extras_pipeline.sql`: Introdução das colunas `pipeline_status`, `justificativa_devolucao` e `centro_custo_nome`.
3. `20260608150000_update_custos_extras_schema.sql`: Normalização das 7 categorias de custo, coluna `tenant_id`, `unidade_id`, `forma_pagamento_id`.
4. `20260608160000_correct_custos_extras_semantics.sql`: Segregação estrita entre `pipeline_status` (`RECEBIDO`, `EM_VALIDACAO`, `APROVADO_OPERACAO`, `REPROVADO`, `ENVIADO_FINANCEIRO`, `FINALIZADO`) e `status_pagamento` (`A_PAGAR`, `PAGO`, `ATRASADO`, `CANCELADO`).
5. `20260608200000_hardening_custos_extras.sql`: Soft delete (`deleted_at`), tabela `custos_extras_historico`, trigger de imutabilidade e RPC de transição unificada.
6. `20260918130000_fase1_custos_extras_origem_recurso_rpc.sql`: Implantação de `origem_recurso` (`PAGO_EMPRESA`, `REEMBOLSO_COLABORADOR`, `PAGAMENTO_PENDENTE`, `LEGACY`), colunas de favorecido (`favorecido_colaborador_id`, `favorecido_fornecedor_id`) e endurecimento da máquina de estados com RBAC e OCC.

---

## 3. ENTIDADE PRINCIPAL: `public.custos_extras_operacionais`

### Matriz de Campos Auditada

| Campo | Tipo | Obrigatório? | Origem / Quem Preenche | Editável? | Finalidade no Negócio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | Sim | Banco (`uuid_generate_v4()`) | Não | Identificador primário |
| `tenant_id` | `UUID` | Sim (RLS) | Contexto de sessão | Não | Isolamento estrito multi-tenant |
| `empresa_id` | `UUID` | Sim | Encarregado / Admin | Até aprovação | Empresa tomadora/centro de custo do gasto |
| `unidade_id` | `UUID` | Não | Encarregado / Admin | Até aprovação | Unidade física / galpão onde ocorreu o custo |
| `data` | `DATE` | Sim | Encarregado / Admin | Até aprovação | Data do fato gerador (governa competência na DRE) |
| `categoria_custo` | `TEXT` | Sim | Encarregado / Admin | Até aprovação | Classificação operacional/contábil (7 categorias) |
| `descricao` | `TEXT` | Sim | Encarregado / Admin | Até aprovação | Detalhamento da despesa (ex.: Lanche 5 colaboradores) |
| `quantidade` | `NUMERIC(15,2)`| Sim | Encarregado / Admin | Até aprovação | Quantidade física adquirida |
| `valor_unitario` | `NUMERIC(15,2)`| Sim | Encarregado / Admin | Até aprovação | Preço unitário praticado |
| `total` | `NUMERIC(15,2)`| Sim | Trigger automático | Não | Quantidade $\times$ Valor Unitário |
| `origem_recurso` | `TEXT` | Sim | Encarregado / Admin | Até aprovação | Define o modelo de liquidação (`PAGO_EMPRESA` vs Reembolso vs Fornecedor) |
| `forma_pagamento_id`| `UUID` | Sim | Encarregado / Admin | Até aprovação | Meio financeiro (PIX, Boleto, Dinheiro, etc.) |
| `favorecido_colaborador_id`| `UUID` | Condicional | Encarregado / Admin | Até aprovação | Obrigatório quando `origem_recurso = 'REEMBOLSO_COLABORADOR'` |
| `favorecido_fornecedor_id` | `UUID` | Condicional | Encarregado / Admin | Até aprovação | Preenchido quando `origem_recurso = 'PAGAMENTO_PENDENTE'` |
| `data_vencimento`| `DATE` | Condicional | Encarregado / Admin | Sim (adm) | Vencimento para despesas a prazo (`PAGAMENTO_PENDENTE`) |
| `pipeline_status`| `TEXT` | Sim | RPC / Transição | Via RPC | Status do fluxo de aprovação (`RECEBIDO` a `FINALIZADO`) |
| `status_pagamento`| `TEXT` | Sim | RPC / Financeiro | Via RPC | Status da obrigação financeira (`A_PAGAR`, `PAGO`, `ATRASADO`, `CANCELADO`) |
| `justificativa_devolucao` | `TEXT` | Não | Operação / RH / Fin | Via RPC | Motivo do retorno para ajuste |
| `observacao` | `TEXT` | Não | Encarregado / Admin | Sim | Notas gerais, identificador do recibo ou comprovante |
| `origem_lancamento` | `TEXT` | Não | Form (`encarregado`/`admin`)| Não | Rastreabilidade do canal de captura |
| `responsavel_id` | `UUID` | Não | Sessão (`auth.uid()`) | Não | Usuário criador do lançamento |
| `deleted_at` | `TIMESTAMPTZ` | Não | Soft delete | Via delete | Exclusão lógica |
| `criado_em` | `TIMESTAMPTZ` | Sim | Banco (`now()`) | Não | Timestamp de criação |
| `atualizado_em` | `TIMESTAMPTZ` | Sim | Trigger / RPC | Não | Timestamp para OCC e auditoria |

---

## 4. FLUXO PONTA A PONTA E MÁQUINAS DE ESTADO

### 4.1 Diagrama A — Fluxo Operacional e Financeiro Real

```text
LANÇAMENTO OPERACIONAL (Encarregado / Admin)
[pipeline_status = 'RECEBIDO' | status_pagamento = 'A_PAGAR']
        │
        ▼
CONFERÊNCIA TÉCNICA (Avançar Validação)
[pipeline_status = 'EM_VALIDACAO' | status_pagamento = 'A_PAGAR']
        │
        ├────────────────────────────────────────┐
        ▼ (devolver com justificativa)          ▼ (aprovar via RPC)
[pipeline_status = 'RECEBIDO']           BIFURCAÇÃO POR ORIGEM DO RECURSO:
                                                │
                 ┌──────────────────────────────┴─────────────────────────────┐
                 ▼ (PAGO_EMPRESA)                                             ▼ (REEMBOLSO ou PAGAMENTO_PENDENTE)
    [pipeline_status = 'FINALIZADO']                             [pipeline_status = 'APROVADO_OPERACAO']
    [status_pagamento = 'PAGO']                                   [status_pagamento = 'A_PAGAR']
                 │                                                            │
                 │ (Despesa liquidada no ato                                  ▼ (enviar_financeiro)
                 │  pela empresa, ex.: caixinha)                 [pipeline_status = 'ENVIADO_FINANCEIRO']
                 │                                               [status_pagamento = 'A_PAGAR']
                 │                                                            │
                 │                                                            ▼ (finalizar_pagamento)
                 │                                               [pipeline_status = 'FINALIZADO']
                 │                                               [status_pagamento = 'PAGO']
                 │                                                            │
                 └──────────────────────────────┬─────────────────────────────┘
                                                ▼
                                    DRE & COMPETÊNCIA
                      (Reconhecido pelo valor integral na competência da data)
```

### 4.2 Tabela de Transições da RPC `rpc_custo_extra_transicionar`

| Ação RPC | Estado Origem | Origem Recurso | Novo `pipeline_status` | Novo `status_pagamento` | Perfis Permitidos |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `avancar_validacao` | `RECEBIDO` | Qualquer | `EM_VALIDACAO` | Inalterado | `admin`, `rh`, `financeiro` |
| `aprovar` | `RECEBIDO` ou `EM_VALIDACAO` | `PAGO_EMPRESA` | `FINALIZADO` | `PAGO` | `admin`, `rh`, `financeiro` |
| `aprovar` | `RECEBIDO` ou `EM_VALIDACAO` | `REEMBOLSO_COLABORADOR` | `APROVADO_OPERACAO` | `A_PAGAR` | `admin`, `rh`, `financeiro` |
| `aprovar` | `RECEBIDO` ou `EM_VALIDACAO` | `PAGAMENTO_PENDENTE` | `APROVADO_OPERACAO` | `A_PAGAR` | `admin`, `rh`, `financeiro` |
| `aprovar` | `RECEBIDO` ou `EM_VALIDACAO` | `LEGACY` | `APROVADO_OPERACAO` | `A_PAGAR` | `admin`, `rh`, `financeiro` |
| `enviar_financeiro` | `APROVADO_OPERACAO` | Reembolso / Pendente / Legacy | `ENVIADO_FINANCEIRO` | `A_PAGAR` | `admin`, `rh`, `financeiro` |
| `finalizar_pagamento`| `ENVIADO_FINANCEIRO` | Reembolso / Pendente / Legacy | `FINALIZADO` | `PAGO` | `admin`, `financeiro` |
| `devolver` | `EM_VALIDACAO`, `APROVADO_OPERACAO`, `ENVIADO_FINANCEIRO` | Não-pago | `RECEBIDO` | Inalterado | `admin`, `rh`, `financeiro` |

---

## 5. NATUREZA CONTÁBIL, DRE E COMPETÊNCIA

1. **Regime de Competência (DRE):**
   - No ERP ORBE, o reconhecimento contábil do Custo Extra é governado estritamente pela coluna **`data`** do lançamento.
   - Uma despesa ocorrida em 25/09/2026, mesmo que seja enviada ao financeiro e paga em 10/10/2026, **permanece registrada e debitada no resultado de Setembro/2026**.
   - A função canônica `isCustoExtraReconhecidoDRE(item)` exige:
     - `deleted_at == null`
     - `pipeline_status` $\in$ (`APROVADO_OPERACAO`, `ENVIADO_FINANCEIRO`, `FINALIZADO`)
     - `status_pagamento != 'CANCELADO'`
   - Registros em `RECEBIDO` ou `EM_VALIDACAO` **não afetam a DRE** porque ainda são pré-lançamentos operacionais pendentes de homologação.
2. **Impacto no Fechamento Mensal (`Fechamento.tsx`):**
   - O Fechamento Mensal impede a conclusão de um ciclo operacional caso existam despesas extras daquele ciclo em `RECEBIDO` ou `EM_VALIDACAO`. O sistema exige que a equipe aprove, libere ou cancele todas as pendências para que o custo real da operação seja congelado.

---

## 6. HERANÇA E ADAPTAÇÃO DA UX05 / UX06 PARA A UX07

| Elemento Visual / Estrutural | UX05 / UX06 | Aplicação em UX07 (Custos Extras) | Classificação |
| :--- | :--- | :--- | :--- |
| **Container Grid** | `max-w-[1560px]`, gutters 4/6 | Reutilizar rigorosamente o mesmo grid externo alinhado com Dashboard e Torre | **HERDAR** |
| **Cabeçalho Operacional** | Título + Subtítulo + Seletor de Empresa + CTA | Reutilizar com ícone representativo de custos/saídas (`Receipt` ou `Coins`) e CTA "Novo Custo Extra" | **HERDAR** |
| **Filtro Temporal Híbrido** | `UxLabFiltroTemporal` | Reutilizar com os mesmos presets (Hoje, Mês Atual, Mês Anterior, Data, Período), filtrando a coluna `data` da despesa | **HERDAR** |
| **Barra de Trabalho** | Busca rápida + Filtro Temporal + Filtro de Categoria + Filtro de Origem | Adaptar os dropdowns para **Categoria de Custo** (7 categorias) e **Origem do Recurso** (`PAGO_EMPRESA`, `REEMBOLSO_COLABORADOR`, `PAGAMENTO_PENDENTE`) | **ADAPTAR** |
| **Cards de Síntese Operacional** | 4 botões de navegação circular orientados ao processo | Adaptar para responder ao ciclo de saídas financeiras, **exibindo valor monetário R$** (essencial para despesas) | **ADAPTAR** |
| **Navegação Circular nos Cards** | Priorização por severidade + ciclo em loop + reset no filtro | Herdar a mesma regra canônica (ex.: card Requer Ação prioriza `REPROVADO` $\rightarrow$ `EM_VALIDACAO` $\rightarrow$ `RECEBIDO`) | **HERDAR** |
| **Separação de 3 Camadas de Cor** | Card $\neq$ Badge $\neq$ Highlight | Regra mandatória: o highlight da linha reflete o status real da despesa localizada, nunca a cor do card superior | **HERDAR** |
| **Superfície dos Cards** | `bg-card` em Light/Dark com `border` e `ring-1` | Manter `bg-card`, eliminando blocos sólidos de cor saturada | **HERDAR** |
| **Tabela Especialista** | Alta densidade, linhas clicáveis para Drawer | Tabela com colunas especializadas de despesa (Data, Empresa/Unidade, Categoria, Descrição, Favorecido, Valor Total, Origem do Recurso, Pipeline, Pagamento) | **ADAPTAR** |
| **Drawer Lateral de Continuidade** | Consultar $\rightarrow$ Diagnosticar $\rightarrow$ Despachar | Header sem botão X (fechamento por rodapé e ESC), badges desacoplados (Pipeline e Pagamento), Composição do Custo, Favorecido e Ações Contextuais | **HERDAR** |

---

## 7. PROPOSTA CANÔNICA DE CARDS PARA A UX07

Ao contrário de Operações por Volume (onde o foco era quantitativo de carretas/toneladas), em Custos Extras o **impacto financeiro em Reais (R$)** é um fato operacional indispensável. Portanto, cada card deve exibir o valor financeiro consolidado acompanhado da contagem de registros:

```text
┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│ CUSTOS NO PERÍODO         │ │ REQUER AÇÃO               │ │ A PAGAR / FINANCEIRO      │ │ PAGOS / LIQUIDADOS        │
│ R$ 14.850,00              │ │ R$ 2.410,00               │ │ R$ 4.340,00               │ │ R$ 8.100,00               │
│ 18 despesas registradas   │ │ 3 pendências (1 devolvida)│ │ 4 obrigações pendentes    │ │ 11 despesas liquidadas    │
│ Cor: Neutro institucional │ │ Cor: Âmbar (Atenção)      │ │ Cor: Índigo (Financeiro)  │ │ Cor: Esmeralda (Concluído)│
└───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

### Regras de Navegação e Priorização nos Cards:
1. **Card 1 — Custos no Período:** Leva ao topo da listagem sem alterar filtros.
2. **Card 2 — Requer Ação:** Agrupa despesas pendentes de conferência ou ajuste (`REPROVADO`, `EM_VALIDACAO`, `RECEBIDO`). Cliques circulares priorizam:
   - 1º: `REPROVADO` (inconsistência operacional com bloqueio);
   - 2º: `EM_VALIDACAO` (em análise pelo gestor/RH);
   - 3º: `RECEBIDO` (recém-capturado em campo pelo encarregado).
3. **Card 3 — A Pagar / Financeiro:** Agrupa despesas aprovadas que aguardam liberação ou pagamento bancário (`APROVADO_OPERACAO` e `ENVIADO_FINANCEIRO` com `status_pagamento = 'A_PAGAR'`). Prioriza as mais antigas / próximas do vencimento.
4. **Card 4 — Pagos / Liquidados:** Agrupa despesas concluídas (`FINALIZADO` / `PAGO`), englobando tanto os pagamentos efetuados pelo Financeiro quanto os gastos já liquidados da empresa (`PAGO_EMPRESA`).

---

## 8. RECOMENDAÇÃO DE COLUNAS PARA A TABELA ESPECIALISTA

| Coluna | Conteúdo | Classificação | Justificativa |
| :--- | :--- | :--- | :--- |
| **Código / ID** | Formato `CE-2026-XXX` | **ESSENCIAL** | Rastreabilidade imediata |
| **Data** | Data do fato gerador `DD/MM/AAAA` | **ESSENCIAL** | Regime de competência contábil |
| **Empresa / Unidade** | Nome da empresa e galpão | **ESSENCIAL** | Centro de custo tomador da despesa |
| **Categoria** | Badge monocromático institucional (7 tipos) | **ESSENCIAL** | Classificação analítica rápida |
| **Descrição** | Texto sucinto do gasto | **ESSENCIAL** | Entendimento imediato do lançamento |
| **Favorecido** | Colaborador (Reembolso) ou Fornecedor (Boleto/NF) | **ESSENCIAL** | Transparência de quem recebe o recurso |
| **Valor Total** | R$ formatado em mono font | **ESSENCIAL** | Dimensão financeira primária |
| **Origem do Recurso**| Badge sutil (`Empresa`, `Reembolso`, `A Pagar`) | **ESSENCIAL** | Esclarece se gera ou não desembolso futuro |
| **Pipeline Status** | Badge semântico do fluxo (`Recebido`, `Em Validação`, etc.) | **ESSENCIAL** | Estágio atual na governança operacional |
| **Status Pagamento** | Badge financeiro (`A Pagar`, `Pago`, `Atrasado`) | **ESSENCIAL** | Situação da liquidação financeira |
| **Ação** | Ícone discreto para abrir Drawer | **ESSENCIAL** | Padrão interativo do ORBE |

---

## 9. DIAGNÓSTICO DE RISCOS (P0 A P3)

- **P0 (Integridade Financeira) — Risco Mitigado:** O backend já possui trigger de imutabilidade bloqueando alteração de valor ou favorecido após aprovação. Na UX V2, deve-se manter o formulário de edição do Drawer estritamente travado para registros aprovados.
- **P1 (Confusão Conceitual Empresa vs Reembolso) — Risco Mitigado:** Exibir distintamente o badge de `Origem do Recurso` na tabela e no Drawer para que o operador nunca confunda um gasto pago pelo caixinha da empresa com uma dívida de reembolso a um colaborador.
- **P2 (Cross-Tenant / RLS):** A tabela possui `tenant_id` e a RPC de transição valida `v_user_tenant_id` fail-closed.
- **P3 (Exclusão Inadvertida):** Apenas permitir soft delete em itens ainda não aprovados (`RECEBIDO`).

---

## 10. CONCLUSÃO E PRÓXIMO PASSO

A auditoria comprova que o domínio de Custos Extras está completamente modelado e estabilizado no backend e nos contratos TypeScript, com regras consistentes de transição, imutabilidade e separação de desembolso.

A **Fase 01 está concluída**. O projeto está apto para receber a **Fase 02 — Concepção do Protótipo 1 no UX Lab (`/ux-lab/custos-extras`)**, aplicando as diretrizes visuais consolidadas em UX05 e UX06.
