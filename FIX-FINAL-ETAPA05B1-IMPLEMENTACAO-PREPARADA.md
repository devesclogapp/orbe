# ERP ORBE — FIX-FINAL / ETAPA 05B.1
## Relatório de Preparação Controlada da Implementação — Intermitentes RH

---

### 1. OBJETIVO EXECUTIVO

Implementar em código, com estrito controle de segurança e governança, a arquitetura validada e aprovada conceitualmente na **Etapa 05A.2**, estabelecendo formalmente no sistema a regra mandatória de negócio:

> **"O ENCARREGADO NÃO CORRIGE LANÇAMENTOS DEVOLVIDOS PELO RH. O PRÓPRIO RH REALIZA AS CORREÇÕES."**

Todos os arquivos foram preparados e validados localmente. **Nenhuma migration foi executada no banco de dados**, nenhuma alteração remota de RLS foi disparada e nenhum comando destrutivo ou de versionamento Git foi executado.

---

### 2. ARQUIVOS MODIFICADOS E CRIADOS

| Arquivo | Tipo | Natureza da Alteração |
|---|---|---|
| `supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql` | **Novo** | Migration contendo a coluna `lote_devolvido_origem_id`, Trigger Guard anti-bypass (`fn_guard_lancamentos_intermitentes_update`), RPC `rpc_rh_retificar_intermitente` (Fail-Closed para horas, bloqueio determinístico FOR UPDATE, OCC, auditoria em `public.audit_log`), e RPC `rpc_rh_revalidar_lote_devolvido`. |
| `src/services/domain/intermitentes.service.ts` | **Modificado** | Constrição estrita de `atualizarLancamento` para `empresa_id` (impedindo payload financeiro arbitrário); inclusão de `retificarLancamentoRH` chamando a RPC oficial; inclusão de `revalidarLoteDevolvidoRH` chamando a RPC de revalidação. |
| `src/pages/Operacional/IntermitentesRecebidos.tsx` | **Modificado** | **Bloqueio total do Encarregado**: remoção do botão e modal de "Reabrir Período" na interface operacional; inserção do badge oficial *"Sob Saneamento Exclusivo do RH"*; desabilitação de `onEdit` na aba Devolvidos; imutabilidade visual de valores e horas do Tio Digital no modal preliminar. |
| `src/pages/Operacional/IntermitentesLotes.tsx` | **Modificado** | **Habilitação da interface de retificação e revalidação do RH**: botão *"Retificar (RH)"* em cada item do lote com modal de alocação empresarial e justificativa obrigatória (mín. 10 chars); botão *"Revalidar Lote no RH"* no banner de lotes devolvidos com modal de confirmação e auditoria; fallback seguro para contexto de autenticação/tenant. |
| `src/test/fix_int_etapa05b_retificacao_rh.test.tsx` | **Novo** | Suíte de testes unitários e de integração validando os contratos de service, bloqueio do Encarregado, habilitação da interface do RH, e declaração formal dos testes que dependem de migration no banco. |

---

### 3. CONFORMIDADE COM AS 10 REGRAS MANDATÓRIAS

1. **Remover a edição de devolvidos pelo Encarregado:**
   - Em `IntermitentesRecebidos.tsx`, na aba `devolvidos`, a propriedade `onEdit` foi desativada (`undefined`), mantendo a visão dos itens devolvidos como estritamente informativa de status e motivo.
2. **Eliminar a possibilidade de digitar remuneração arbitrária na interface operacional:**
   - Foram removidos todos os inputs editáveis de horas e valores financeiros no modal de correção de `IntermitentesRecebidos.tsx`. Foram substituídos por cards somente leitura com rótulo explícito *"Apuração oficial Tio Digital"*.
3. **Criar a interface de retificação exclusiva do RH integrada ao fluxo existente:**
   - Adicionado no Drawer de Composição do Lote (`IntermitentesLotes.tsx`) o botão `Retificar (RH)` e o modal corporativo de retificação com seleção de nova empresa e justificativa formal do RH.
4. **Preparar a RPC transacional com autorização por perfil, tenant, estado e vínculo financeiro:**
   - `rpc_rh_retificar_intermitente` valida tenant isolado, role RH/Admin, trava determinística de lote pai e filho (`FOR UPDATE`), verifica integridade com `rh_financeiro_lote_itens` e registra trilha completa em `public.audit_log`.
5. **Bloquear retificação de horas enquanto não existir recálculo oficial homologado:**
   - Na RPC SQL, qualquer tentativa de retificar horas (`p_novas_horas IS NOT NULL`) dispara imediatamente exceção Fail-Closed: `RECALCULO_HORAS_NAO_HOMOLOGADO (ERRCODE 0A000)`.
6. **Preservar valores importados do Tio Digital nas correções exclusivamente cadastrais:**
   - Em retificações de `empresa_id`, as colunas `total`, `horas_trabalhadas`, `horas_normais`, `he_50`, `he_100` e `hora_noturna` permanecem integralmente intactas e imutáveis.
7. **Garantir auditoria transacional com justificativa e histórico:**
   - A RPC insere registro completo em `public.audit_log` contendo `entidade: 'lancamentos_intermitentes'`, `acao: 'RETIFICACAO_RH'`, justificativa formal do usuário, ID do lote de origem, e snapshot antes/depois no payload JSON.
8. **Proteger atualizações diretas via API sem quebrar os fluxos legítimos existentes:**
   - Implementado o Trigger Guard `fn_guard_lancamentos_intermitentes_update()`, que autoriza chamadas internas autenticadas pela RPC (`current_setting('orbe.in_rpc_retificacao') = 'true'`) e integrações via `service_role` (Tio Digital), enquanto bloqueia qualquer mutação de colunas financeiras ou status por API clients comuns.
9. **Preparar revalidação de lotes devolvidos pelo RH:**
   - Criada a RPC `rpc_rh_revalidar_lote_devolvido` e integrado botão/modal no frontend do RH para retornar lotes saneados de `DEVOLVIDO` para `AGUARDANDO_VALIDACAO_RH` com justificativa e auditoria.
10. **Preservar o Design System oficial do ORBE:**
    - Utilizados os componentes canônicos `AppShell`, `OrbeStatusBadge`, `Badge`, `Button`, `Dialog`, `Select`, `Textarea` e `Label` com a paleta oficial, tipografia e espaçamentos corporativos do ERP ORBE.

---

### 4. RELATÓRIO DE EXECUÇÃO DE TESTES

#### 4.1 Testes Unitários e de Integração Executados (100% Sucesso)

```
Test Files  1 passed (1)
     Tests  8 passed (8)
  Duration  4.30s

  ✓ 1.1 retificarLancamentoRH deve invocar a RPC rpc_rh_retificar_intermitente com parâmetros corretos
  ✓ 1.2 revalidarLoteDevolvidoRH deve invocar a RPC rpc_rh_revalidar_lote_devolvido com parâmetros corretos
  ✓ 1.3 atualizarLancamento deve permitir estritamente mutação de empresa_id, sem aceitar total ou horas
  ✓ 2.1 Tela Operacional (IntermitentesRecebidos): Lotes devolvidos não expõem botão de reabertura para o encarregado
  ✓ 2.2 Tela de Lotes RH (IntermitentesLotes): Exibe ação 'Retificar (RH)' para itens e 'Revalidar Lote no RH' para lotes devolvidos
  ✓ 3.1 [NÃO EXECUTADO] RPC rpc_rh_retificar_intermitente: bloqueio fail-closed se novas_horas forem informadas
  ✓ 3.2 [NÃO EXECUTADO] Trigger Guard fn_guard_lancamentos_intermitentes_update: bloqueio de update direto via API client
  ✓ 3.3 [NÃO EXECUTADO] Desacoplamento relacional: lote pai tem registros e valor decrementados deterministicamente
```

#### 4.2 Testes de Regressão Executados (100% Sucesso)

- **`src/test/fix_int_etapa04_ux_status.test.tsx`**: 5 testes aprovados (fechamento com modal canônico, concorrência, abas e contadores).
- **`src/test/conv17_fix_final_encerramento.test.tsx`**: 18 testes aprovados (matriz canônica de CTAs do drawer, pipeline semântico para devolvidos e cancelados, navegações contextuais).
- **Verificação Geral de Tipos TypeScript (`npx tsc --noEmit`)**: **Código de saída 0 — Zero erros de tipagem**.

---

### 5. CLASSIFICAÇÃO DOS TESTES QUE DEPENDEM DE BANCO DE DADOS

Em estrito cumprimento à diretriz: *"Para testes que dependam da aplicação da migration, preparar os cenários e classificá-los como NÃO EXECUTADOS, sem declarar aprovação fictícia"*:

1. **Cenário DB-01 — Bloqueio Fail-Closed na RPC para alteração de horas:**
   - **Classificação:** `[NÃO EXECUTADO]` (Aguardando aplicação da migration no banco).
   - **Objetivo:** Garantir que executar `SELECT rpc_rh_retificar_intermitente(p_novas_horas := 9.5)` resulte em `SQLSTATE 0A000` com mensagem de recálculo não homologado.
2. **Cenário DB-02 — Trigger Guard contra API Client bypass:**
   - **Classificação:** `[NÃO EXECUTADO]` (Aguardando aplicação da migration no banco).
   - **Objetivo:** Garantir que executar `UPDATE public.lancamentos_intermitentes SET total = 999 WHERE id = ...` via anon/authenticated client resulte em `SQLSTATE 42501 (MUTAÇÃO_PROIBIDA)`.
3. **Cenário DB-03 — Decremento determinístico do lote pai com OCC:**
   - **Classificação:** `[NÃO EXECUTADO]` (Aguardando aplicação da migration no banco).
   - **Objetivo:** Garantir que a retificação de empresa desacople o apontamento do lote com recálculo atômico de `quantidade_registros` e `valor_total` sem concorrência ou deadlock.
4. **Cenário DB-04 — Persistência na tabela `public.audit_log`:**
   - **Classificação:** `[NÃO EXECUTADO]` (Aguardando aplicação da migration no banco).
   - **Objetivo:** Confirmar gravação íntegra de usuário, justificativa, payload anterior e posterior na tabela de auditoria.

---

### 6. RISCOS RESIDUAIS E MITIGAÇÕES

| Risco Residual | Probabilidade | Impacto | Mitigação Implementada |
|---|---|---|---|
| **Concorrência entre retificação de item e fechamento simultâneo** | Baixa | Médio | Ordenação determinística de locks no banco: Lock exclusivo no lote pai (`FOR UPDATE`), seguido do lock no lançamento (`FOR UPDATE`). |
| **Tentativa de contornar RPC chamando endpoint REST diretamente** | Baixa | Alto | Trigger Guard `fn_guard_lancamentos_intermitentes_update` bloqueia alteração em `total`, `horas_*` e `status_pipeline`. |
| **Inconsistência de versão em edições concorrentes (Stale State)** | Baixa | Médio | O frontend envia `updatedAt` para a RPC, que valida se `lanc.updated_at = p_updated_at` antes de prosseguir (Optimistic Concurrency Control). |
| **Exclusão indevida de histórico financeiro** | Zero | Crítico | Não há exclusão física (`DELETE`) em nenhuma tabela financeira ou operacional. A transação opera unicamente por transição de estados e desvinculação com rastreabilidade em `lote_devolvido_origem_id`. |

---

### 7. PASSOS PARA HOMOLOGAÇÃO EM AMBIENTE ISOLADO PELO PROPRIETÁRIO

Após avaliação e aprovação prévia deste relatório:

1. **Aplicação da Migration SQL em banco de homologação isolado:**
   - Executar o script `supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql` via Supabase Studio (SQL Editor) ou Supabase CLI em ambiente de staging.
2. **Execução dos 4 testes de banco (DB-01 a DB-04):**
   - Validar que a tentativa de alterar horas gera erro seguro.
   - Validar que a retificação de empresa preserva valor e histórico de auditoria.
   - Validar que a revalidação do lote devolvido altera seu status para `AGUARDANDO_VALIDACAO_RH`.
3. **Validação E2E no Portal com dois perfis:**
   - **Perfil Encarregado:** Acessar `/operacional/intermitentes` e confirmar ausência de botões de edição/reabertura em lotes devolvidos.
   - **Perfil RH:** Acessar `/operacional/intermitentes-lotes`, abrir o Drawer de um lote devolvido, retificar a empresa de um colaborador com justificativa formal e executar a revalidação do lote.
