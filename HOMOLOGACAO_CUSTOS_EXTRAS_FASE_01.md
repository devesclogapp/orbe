# HOMOLOGAÇÃO DE CUSTOS EXTRAS — FASE 1: AUDITORIA DO FLUXO
**ERP ORBE | ESC LOG 2026**  
**Data:** 21 de Outubro de 2026  
**Status da Auditoria:** Concluída (100% Read-Only)  
**Ambiente:** Homologação / Staging Supabase  

---

## 1. FLUXOGRAMA TEXTUAL DO PROCESSO REAL

O fluxo de **Custos Extras Operacionais** do ERP ORBE difere fundamentalmente do fluxo de Mão de Obra (Diaristas, Intermitentes e CLT). Ele não se estrutura em ciclos de apuração semanal nem gera remessas bancárias CNAB 240. Trata-se de despesas operacionais avulsas com trifurcação de liquidação conforme a **Origem do Recurso** (`origem_recurso`).

```text
[ ENTRADA OPERACIONAL ]
Encarregado / Operador / Admin
  │
  ├── 1. Seleciona Empresa e Unidade (opcional)
  ├── 2. Informa Data, Categoria e Descrição do Custo
  ├── 3. Informa Quantidade e Valor Unitário (Total calculado automaticamente)
  ├── 4. Seleciona Forma de Pagamento Operacional (Dinheiro, Cartão, PIX, Boleto)
  └── 5. Seleciona a ORIGEM DO RECURSO (Trifurcação Obrigatória Fail-Closed):
        ├── A) PAGO_EMPRESA (Desembolso direto pelo caixa ou cartão da empresa)
        ├── B) REEMBOLSO_COLABORADOR (Colaborador pagou do próprio bolso -> Requer Favorecido Colaborador)
        └── C) PAGAMENTO_PENDENTE (Boleto/fatura a faturar -> Requer Favorecido Fornecedor e Vencimento)
  │
  ▼
[ PERSISTÊNCIA INICIAL ]
Tabela: custos_extras_operacionais
  ├── pipeline_status: 'RECEBIDO'
  ├── status_pagamento: 'A_PAGAR' (ou 'PAGO' se PAGO_EMPRESA)
  └── Imutabilidade: Aberto para correções na operação
  │
  ▼
[ ETAPA 2: AVALIAÇÃO / APROVAÇÃO RH & OPERAÇÃO ]
Telas: /rh/aprovacoes (vw_aprovacoes_rh) e /operacional/custos-extras
Perfis autorizados: admin, rh, financeiro (via rpc_custo_extra_transicionar)
  │
  ├── [DEVOLVER / REJEITAR]:
  │     Executa ação 'devolver' com justificativa -> Retorna para pipeline_status: 'RECEBIDO'
  │
  └── [APROVAR]:
        │
        ├── Se PAGO_EMPRESA (Modelo A):
        │     pipeline_status = 'FINALIZADO'
        │     status_pagamento = 'PAGO'
        │     [CICLO ENCERRADO: Não gera Contas a Pagar pendente]
        │
        └── Se REEMBOLSO_COLABORADOR ou PAGAMENTO_PENDENTE:
              pipeline_status = 'APROVADO_OPERACAO'
              status_pagamento = 'A_PAGAR'
              [Gera Obrigação Financeira]
  │
  ▼
[ ETAPA 3: TRANSMISSÃO AO FINANCEIRO ]
  ├── Transição: 'enviar_financeiro'
  ├── pipeline_status = 'ENVIADO_FINANCEIRO'
  └── status_pagamento = 'A_PAGAR'
  │
  ▼
[ ETAPA 4: DESPESAS & CONTAS A PAGAR ]
Telas: /financeiro (CentralFinanceira -> DespesaDrawerOficial)
Service: DespesasContasPagarOficialService (Normalização Federada)
Identidade Federada: 'CUSTOS_EXTRAS:<id>' (Deduplicação Canônica)
  │
  ├── Reconhecimento UX:
  │     - PAGO_EMPRESA -> Situação 'PAGA' (integrado aos desembolsos)
  │     - APROVADO_OPERACAO -> Situação 'AGUARDANDO_LIBERACAO'
  │     - ENVIADO_FINANCEIRO -> Situação 'A_PAGAR' (Pronta para Execução Direta)
  │
  └── Liquidação Financeira:
        Ação 'finalizar_pagamento' via RPC (restrita a admin/financeiro)
        pipeline_status = 'FINALIZADO'
        status_pagamento = 'PAGO'
        Forma: Liquidação direta (Caixa, PIX, Transferência direta)
        *NÃO GERA CNAB — ISOLADO DA CENTRAL BANCÁRIA*
  │
  ▼
[ ETAPA 5: RECONHECIMENTO CONTÁBIL NA DRE ]
Telas: /financeiro/dre (RelatorioDRE)
Service: DashboardConsolidadoService -> dreOficialAdapter
  ├── Critério DRE: pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')
  │                 AND status_pagamento != 'CANCELADO' AND deleted_at IS NULL
  ├── Competência: Mês do fato gerador (data do custo extra: YYYY-MM)
  └── Linha DRE: Dedução operacional 'Custos Extras & Logística' (-)
```

---

## 2. INVENTÁRIO DE TABELAS, SERVIÇOS E COMPONENTES

### 2.1 Banco de Dados (Supabase PostgreSQL)
| Objeto | Tipo | Finalidade | Regras Críticas |
| :--- | :--- | :--- | :--- |
| `public.custos_extras_operacionais` | Tabela | Armazenamento de lançamentos de despesas extras | RLS ativo, trigger de cálculo `total = quantidade * valor_unitario`, soft delete (`deleted_at`) |
| `public.vw_aprovacoes_rh` | View | Fila unificada de aprovações do RH | Unifica com `tipo = 'CUSTO EXTRA'`, `security_invoker = on` |
| `public.audit_log` | Tabela | Trilha de auditoria formal e imutável | Registra INSERT/UPDATE com snapshot anterior e novo |
| `public.trg_block_update_custos_aprovados` | Trigger | Proteção de Imutabilidade Condicional | Impede alteração de valores e origem após `APROVADO_OPERACAO` |
| `public.rpc_custo_extra_transicionar` | Function (RPC) | Transição atômica de estados e concorrência (OCC) | Fail-closed multi-tenant, RBAC estrito (`admin`/`rh`/`financeiro`), OCC via `atualizado_em` |

### 2.2 Serviços e Adapters Frontend
| Arquivo | Responsabilidade |
| :--- | :--- |
| `src/services/domain/despesas.service.ts` | Classe `CustoExtraOperacionalServiceClass`: `getAll`, `getByDate`, `getByCompetencia`, `createMany`, `update`, `delete`, `transicionar` |
| `src/services/despesasOficial.service.ts` | Adapter federado `DespesasContasPagarOficialService`: normaliza itens como `CUSTOS_EXTRAS:<id>`, calcula KPIs e separa de CNAB |
| `src/services/dashboard.service.ts` | Motor econômico `DashboardConsolidadoService`: calcula indicadores DRE respeitando `CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE` |
| `src/services/adapters/dreOficialAdapter.ts` | Formatação e segregação das linhas contábeis da DRE |
| `src/types/custosExtrasForm.ts` | Validação estrita (`validateCustoExtraForm`), montagem de payload sanitizado (`buildCustoExtraInsertPayload`) e helpers visuais |

### 2.3 Componentes e Páginas Frontend
| Rota / Componente | Arquivo | Perfil / Uso |
| :--- | :--- | :--- |
| `/producao/custos-extras` | `src/pages/Producao/CustosExtrasLancamento.tsx` | Wizard operacional em 4 etapas para Encarregado |
| `/operacional/custos-extras` | `src/pages/Operacional/CustosExtrasRecebidos.tsx` | Torre operacional de recebidos, filtros temporais e síntese de KPIs |
| `CustosExtrasDetalhesDrawer` | `src/components/operacoes/CustosExtrasDetalhesDrawer.tsx` | Drawer de detalhes, timeline e acionamento de transições |
| `CustosExtrasTableBlock` | `src/components/operacoes/CustosExtrasTableBlock.tsx` | Tabela operacional de itens com ações contextuais |
| `/rh/aprovacoes` | `src/pages/Rh/AprovacoesRh.tsx` | Fila unificada de aprovação com filtro `CUSTO EXTRA` |
| `AprovacaoDecisaoDrawer` | `src/components/aprovacoes/AprovacaoDecisaoDrawer.tsx` | Decisão formal de aprovação/devolução pelo RH |
| `/financeiro` | `src/pages/CentralFinanceira.tsx` | Hub financeiro com aba Despesas & Contas a Pagar |
| `DespesaDrawerOficial` | `src/pages/Financeiro/components/DespesaDrawerOficial.tsx` | Drawer financeiro com botão de liquidação direta (`finalizar_pagamento`) |
| `/financeiro/dre` | `src/pages/Financeiro/RelatorioDRE.tsx` | Demonstração contábil do resultado operacional |

---

## 3. MATRIZ DE PERMISSÕES E ESTADOS

### 3.1 Matriz de Permissões (RBAC)
| Ação Operacional | Encarregado | RH | Financeiro | Admin | Mecanismo de Controle |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Lançar Custo Extra** | ✅ | ✅ | ✅ | ✅ | `INSERT` autenticado + validação de tenant |
| **Avançar Validação** | ❌ | ✅ | ✅ | ✅ | RPC `rpc_custo_extra_transicionar('avancar_validacao')` |
| **Aprovar Operação** | ❌ | ✅ | ✅ | ✅ | RPC `rpc_custo_extra_transicionar('aprovar')` |
| **Enviar ao Financeiro** | ❌ | ✅ | ✅ | ✅ | RPC `rpc_custo_extra_transicionar('enviar_financeiro')` |
| **Liquidar Pagamento (Baixa)** | ❌ | ❌ | ✅ | ✅ | RPC `rpc_custo_extra_transicionar('finalizar_pagamento')` |
| **Devolver Registro** | ❌ | ✅ | ✅ | ✅ | RPC `rpc_custo_extra_transicionar('devolver')` com motivo |
| **Editar Valores após Aprovação**| ❌ | ❌ | ❌ | ❌ | **Bloqueio Absoluto** via trigger `trg_block_update_custos_aprovados` |

### 3.2 Matriz de Estados e Transições
| Estado Atual (`pipeline_status`) | Ação RPC | Próximo `pipeline_status` | Próximo `status_pagamento` | Comportamento Específico |
| :--- | :--- | :--- | :--- | :--- |
| `RECEBIDO` | `avancar_validacao` | `EM_VALIDACAO` | Preservado | Transição preparatória de triagem |
| `RECEBIDO` ou `EM_VALIDACAO` | `aprovar` | `FINALIZADO` | `PAGO` | Se `origem_recurso = 'PAGO_EMPRESA'` (Modelo A) |
| `RECEBIDO` ou `EM_VALIDACAO` | `aprovar` | `APROVADO_OPERACAO` | `A_PAGAR` | Se `REEMBOLSO_COLABORADOR` ou `PAGAMENTO_PENDENTE` |
| `APROVADO_OPERACAO` | `enviar_financeiro` | `ENVIADO_FINANCEIRO` | `A_PAGAR` | Bloqueado para `PAGO_EMPRESA` |
| `ENVIADO_FINANCEIRO` | `finalizar_pagamento`| `FINALIZADO` | `PAGO` | Baixa financeira direta (proibido para `PAGO_EMPRESA`) |
| Qualquer estado não-finalizado | `devolver` | `RECEBIDO` | Preservado | Justificativa obrigatória; bloqueado se `PAGO` ou `FINALIZADO` |

---

## 4. CADASTROS NECESSÁRIOS

Para que um custo extra possa ser lançado e transicionado com sucesso, os seguintes dados devem existir previamente no tenant:

1. **Empresa Contratante / Operacional (`public.empresas`):**
   - Registro ativo com `tenant_id` correspondente.
2. **Unidade Operacional (`public.unidades_operacionais`):**
   - Opcional, vinculada à empresa selecionada.
3. **Formas de Pagamento Operacionais (`public.formas_pagamento_operacionais`):**
   - Deve existir ao menos uma forma ativa (ex: Dinheiro, PIX, Cartão Corporativo, Boleto a Prazo).
4. **Colaborador Ativo (`public.colaboradores`):**
   - **Obrigatório** quando `origem_recurso = 'REEMBOLSO_COLABORADOR'`. O colaborador deve estar ativo para que o reembolso seja nominal.
5. **Fornecedor Ativo (`public.fornecedores`):**
   - **Obrigatório** quando `origem_recurso = 'PAGAMENTO_PENDENTE'`. O fornecedor deve estar cadastrado para emissão de duplicata/conta a pagar.
6. **Perfis de Usuário (`public.profiles`):**
   - Encarregado cadastrado para lançar (`role = 'encarregado'`).
   - Usuário RH cadastrado para aprovar (`role = 'rh'`).
   - Usuário Financeiro/Admin para baixa (`role = 'financeiro'` ou `'admin'`).

---

## 5. RISCOS E INCONSISTÊNCIAS IDENTIFICADOS

Durante a auditoria estática e de schema, foram identificados 4 pontos de atenção e inconsistências técnicas:

### ⚠️ Risco 1: Divergência na Ação de Devolução pelo Financeiro
- **Localização:** `src/pages/Financeiro/components/DespesaDrawerOficial.tsx` (linhas 150–156).
- **Problema:** Quando o usuário clica em "Devolver" no Drawer Financeiro para um item de `CUSTOS_EXTRAS`, o código invoca:
  ```typescript
  CustoExtraOperacionalService.transicionar(despesa.canonicalId, "reprovar", ...)
  ```
- **Causa Raiz:** A RPC `rpc_custo_extra_transicionar` aceita exclusivamente as ações `'avancar_validacao'`, `'aprovar'`, `'enviar_financeiro'`, `'finalizar_pagamento'` e `'devolver'`. A ação `'reprovar'` **não existe na RPC**, disparando exceção `RAISE EXCEPTION 'Açao de transicao desconhecida: %', p_acao`.
- **Severidade:** **Média** (impede devolução do Custo Extra a partir da tela de Despesas Financeiras; funciona se devolvido pela tela operacional).

### ⚠️ Risco 2: Devolução no RH sem chamada à RPC
- **Localização:** `src/pages/Rh/AprovacoesRh.tsx` (linhas 564–571).
- **Problema:** O método `devolverMutation` executa um `update` direto na tabela `custos_extras_operacionais` setando `pipeline_status: 'REPROVADO'`.
- **Causa Raiz:** Bypassa a RPC `rpc_custo_extra_transicionar`, não registrando o histórico na RPC e divergindo da semântica onde a devolução deveria retornar o registro para `RECEBIDO` para que o encarregado o corrija.
- **Severidade:** **Média** (o registro fica preso em `REPROVADO` e não em `RECEBIDO`).

### ⚠️ Risco 3: Contrato de Colunas na View `vw_aprovacoes_rh`
- **Localização:** `supabase/migrations/20261018130100_fix_dia_02_vw_aprovacoes_rh_diaristas_lotes.sql` (linha 74).
- **Problema:** Na view, a coluna `raw_status` para Custos Extras foi mapeada como `ce.status_pagamento AS raw_status` em vez de `ce.pipeline_status`.
- **Impacto:** Como novos custos extras entram com `status_pagamento = 'A_PAGAR'`, na query externa da view a situação cai no fallback `'Em análise'`. Quando pago, vira `'Aprovado'`. No entanto, para fins de aprovação do pipeline operacional, o status relevante de governança é o `pipeline_status`.
- **Severidade:** **Baixa / Cosmética** (não impede a aprovação, mas gera ambiguidade semântica entre status de pagamento e status de aprovação).

### ⚠️ Risco 4: CHECK Constraint Legada de `categoria_custo`
- **Localização:** `supabase/migrations/20260430170000_custos_extras_operacionais.sql` (linha 7).
- **Problema:** A constraint original exigia `CHECK (categoria_custo IN ('MERENDA', 'ADMINISTRATIVO', 'OPERACIONAL', 'FORNECEDOR'))`. O formulário atual envia categorias expandidas como `'MERENDA/LANCHE'`, `'MANUTENCAO'`, `'TRANSPORTE'`, `'COMUNICACAO'`, `'OUTROS'`.
- **Constatação:** Nos testes e registros existentes em Outubro/2026, foram inseridos registros com `categoria_custo = 'MANUTENCAO'` e `'MERENDA/LANCHE'`, comprovando que a constraint no banco ativo foi afrouxada ou alterada, mas deve ser validada em qualquer migração futura.
- **Severidade:** **Baixa** (já compatibilizada no banco ativo).

---

## 6. DADOS EXISTENTES (OUTUBRO DE 2026)

Conforme auditoria read-only executada diretamente na base do Supabase em 21/10/2026, foram localizados exatamente os **4 registros de homologação** apontados na especificação:

| ID | Data | Empresa | Categoria | Descrição | Valor | Origem Recurso | Favorecido | Pipeline Status | Status Pagto |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- | :--- | :---: | :---: |
| `f6c3685e...` | 16/10/2026 | Empresa Teste - Hml | MANUTENCAO | HML LOTE 1 — Manutenção de paleteira | R$ 380,00 | `PAGAMENTO_PENDENTE` | Fornecedor Genérico (`e67fbebb...`) | `APROVADO_OPERACAO` | `A_PAGAR` |
| `1837369f...` | 16/10/2026 | Empresa Teste - Hml | OPERACIONAL | HML LOTE 1 — Abastecimento gerador | R$ 150,00 | `PAGO_EMPRESA` | — | `FINALIZADO` | `PAGO` |
| `c1aa8f36...` | 16/10/2026 | Empresa Teste - Hml | MERENDA/LANCHE | HML LOTE 1 — Lanche equipe noturna | R$ 85,00 | `REEMBOLSO_COLABORADOR` | Homologação Itaú 001 (`1b294acc...`) | `APROVADO_OPERACAO` | `A_PAGAR` |
| `98c5defd...` | 16/10/2026 | Empresa Teste - Hml | MANUTENCAO | HML LOTE 1 — Manutenção de paleteira | R$ 380,00 | `PAGAMENTO_PENDENTE` | Fornecedor Genérico (`e67fbebb...`) | `APROVADO_OPERACAO` | `A_PAGAR` |

### Diagnóstico Contábil e Financeiro dos 4 Itens:
1. **Total de Despesas em Outubro/2026:** **R$ 995,00** (380 + 150 + 85 + 380).
2. **Reconhecimento na DRE de Outubro/2026:** **100% Reconhecidos (R$ 995,00)**. Todos possuem `pipeline_status` elegível (`APROVADO_OPERACAO` e `FINALIZADO`) e `deleted_at: null`.
3. **Contas a Pagar / Central de Despesas:**
   - **R$ 150,00** (PAGO_EMPRESA) aparece como liquidado (`PAGA`), sem gerar duplicata em aberto.
   - **R$ 845,00** (380 + 85 + 380) figuram como obrigações abertas a pagar (`A_PAGAR` / `AGUARDANDO_LIBERACAO`).
4. **Isolamento de CNAB:** Nenhum dos 4 itens transitou ou transitará por arquivos de remessa CNAB 240, preservando estritamente a Central Bancária.

---

## 7. ROTEIRO DE HOMOLOGAÇÃO MANUAL (FASE 2)

O roteiro de testes funcionais deve ser executado em 6 etapas sequenciais:

### Etapa 2.1 — Lançamento Operacional (Encarregado)
- **Cenário A:** Lançar despesa com `PAGO_EMPRESA` (ex: Combustível gerador, R$ 100,00). Verificar cálculo automático, bloqueio de favorecidos e persistência com `pipeline_status = 'RECEBIDO'`.
- **Cenário B:** Lançar despesa com `REEMBOLSO_COLABORADOR` (ex: Lanche equipe, R$ 50,00). Verificar obrigatoriedade da seleção de Colaborador Favorecido.
- **Cenário C:** Lançar despesa com `PAGAMENTO_PENDENTE` (ex: Conserto balança, R$ 200,00). Verificar seleção de Fornecedor Favorecido e data de vencimento.

### Etapa 2.2 — Torre Operacional e Filtros (/operacional/custos-extras)
- Validar se os 3 lançamentos aparecem imediatamente na lista de recebidos.
- Validar filtros por empresa, período temporal e categoria.
- Testar abertura do `CustosExtrasDetalhesDrawer` e verificação da timeline.

### Etapa 2.3 — Aprovação Operacional e RH (/rh/aprovacoes)
- Filtrar por domínio `CUSTO EXTRA`.
- **Aprovar Cenário A (`PAGO_EMPRESA`):** Validar se o item avança direto para `FINALIZADO` / `PAGO` (Modelo A) sem gerar conta a pagar.
- **Aprovar Cenários B e C:** Validar se avançam para `APROVADO_OPERACAO` / `A_PAGAR`.
- Testar devolução de um item e verificar preenchimento de justificativa.

### Etapa 2.4 — Transmissão e Liquidação Financeira (/financeiro)
- Acessar a aba "Despesas & Contas a Pagar".
- Verificar se Cenário A consta como `PAGA` e Cenários B e C constam como `A_PAGAR`.
- Executar liquidação direta (`finalizar_pagamento`) do Reembolso (Cenário B) e Fornecedor (Cenário C).
- Confirmar que o botão "Bancário (CNAB)" **NÃO é exibido** e que nenhum lote CNAB é afetado.

### Etapa 2.5 — Validação Contábil na DRE (/financeiro/dre)
- Consultar a competência do mês do lançamento.
- Validar se o total dos Custos Extras aprovados/liquidados compõe a dedução operacional da DRE.
- Verificar se itens reprovados/devolvidos ficam excluídos da DRE.

### Etapa 2.6 — Auditoria e Imutabilidade
- Tentar editar o valor ou empresa de um custo já aprovado no banco e confirmar que o trigger `trg_block_update_custos_aprovados` rejeita com `IMUTABILIDADE_VIOLADA`.
- Verificar se os eventos de criação e transição foram gravados na tabela `audit_log`.

---

## 8. PARECER CONCLUSIVO

### **PARECER: [ GO COM RESSALVAS ]**

**Justificativa Técnica:**
1. A arquitetura de Custos Extras no ERP ORBE encontra-se **robusta, desacoplada dos fluxos de Diaristas/CLT e totalmente isolada do motor bancário de CNAB**, conforme as melhores práticas de segregação de domínio.
2. A trifurcação de `origem_recurso` (`PAGO_EMPRESA`, `REEMBOLSO_COLABORADOR`, `PAGAMENTO_PENDENTE`) está formalmente implementada tanto no banco (`rpc_custo_extra_transicionar`, constraints e triggers de imutabilidade) quanto no frontend.
3. Os registros históricos de Outubro/2026 (R$ 380, R$ 380, R$ 85 e R$ 150) estão íntegros e compatíveis com a esteira.
4. **Ressalva:** As ações de devolução no frontend (Risco 1 e Risco 2) possuem pequenas divergências com a RPC (ação `'reprovar'` em vez de `'devolver'`), o que pode gerar erro ao devolver itens pelo Drawer Financeiro. Os testes funcionais de aprovação e liquidação podem ser iniciados imediatamente, mantendo atenção à devolução.
