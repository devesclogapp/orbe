# ERP ORBE — FIX-FINAL / ETAPA 05B.2
## Relatório de Auditoria Pré-Migration — Intermitentes RH

---

### 1. RESUMO EXECUTIVO

| Métrica / Critério | Avaliação |
|---|---|
| **Domínio Auditado** | Intermitentes RH — Retificação e Revalidação |
| **Escopo** | Migration SQL, Frontend Operacional, Frontend RH, Services e Integrações |
| **Modo de Operação** | Estritamente READ-ONLY (nenhuma alteração em banco ou git) |
| **Achados Encontrados** | 1 de Severidade P1 (Alto), 1 de Severidade P2 (Médio), 1 de Severidade P3 (Baixo) |
| **Veredito Técnico** | ⚠️ **NÃO APTO para aplicação imediata em banco** (exige correção prévia de P1 e P2 no arquivo da migration antes do deploy/execução no Supabase) |

---

### 2. AUDITORIA DAS 10 VERIFICAÇÕES OBRIGATÓRIAS

#### Verificação 01 — Inspeção Integral da Migration SQL
- **Arquivo:** `supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`
- **Estrutura:** 398 linhas compreendendo:
  1. Alteração estrutural em `public.lancamentos_intermitentes` adicionando `lote_devolvido_origem_id UUID NULL` com índice relacional.
  2. Função de trigger `fn_guard_lancamentos_intermitentes_update()` com gatilho `trg_guard_lancamentos_intermitentes` `BEFORE UPDATE`.
  3. Stored Procedure `rpc_rh_retificar_intermitente` (SECURITY DEFINER, locks pessimistas ordenados, Fail-Closed em horas, OCC, auditoria).
  4. Stored Procedure `rpc_rh_revalidar_lote_devolvido` (SECURITY DEFINER, reabertura positiva exclusiva de lotes `DEVOLVIDO`).
  5. Configuração explícita de ownership (`postgres`), revogação de `anon`/`public` e concessão para `authenticated`/`service_role`.

---

#### Verificação 02 — Análise do Trigger Anti-Bypass e RLS
- **Isolamento de Flag de Sessão:** A flag `orbe.in_rpc_retificacao` é ativada via `PERFORM set_config('orbe.in_rpc_retificacao', 'true', true)`. O terceiro argumento `true` garante escopo estritamente local da transação. Não existem endpoints REST ou funções expostas que permitam a usuários clientes invocar `set_config` arbitrariamente.
- **Autorização Prévia à Flag:** A ativação da flag ocorre no passo 8 da RPC, **após** a autenticação de `auth.uid()`, validação do tenant e validação de `public.get_user_role() IN ('admin', 'super_admin', 'rh')`.
- **Políticas RLS:** A policy `lancamentos_intermitentes_update_tenant` exige `tenant_id = public.current_tenant_id()`. O trigger guard atua em camada `BEFORE UPDATE`, impedindo que mesmo usuários autorizados por RLS alterem `total`, `horas_*` ou transitem status terminais.
- **Achado de Segurança Identificado (Achado P2):** O trigger guard atual não bloqueia a mutação direta de `lote_fechamento_id` ou `empresa_id` via API client quando o lançamento possui `OLD.lote_fechamento_id IS NOT NULL` e status `DEVOLVIDO` ou `EM_ANALISE_RH`. Isso permitiria a um usuário autenticado contornar a RPC de retificação emitindo um `PATCH` REST direto (vide seção de achados).

---

#### Verificação 03 — Nomes Reais de Tabelas, Colunas, Constraints e Status
- `public.lancamentos_intermitentes`:
  - Colunas reais conferidas: `id`, `tenant_id`, `empresa_id`, `colaborador_id`, `total`, `horas_trabalhadas`, `horas_normais`, `he_50`, `he_100`, `hora_noturna`, `status_pipeline`, `lote_fechamento_id`, `updated_at`.
  - Check constraint real: `CHECK (status_pipeline IN ('RECEBIDO', 'EM_ANALISE_RH', 'APROVADO_RH', 'DEVOLVIDO', 'ENVIADO_FINANCEIRO'))`.
- `public.intermitentes_lotes_fechamento`:
  - Colunas reais conferidas: `id`, `tenant_id`, `empresa_id`, `competencia`, `periodo_inicio`, `periodo_fim`, `quantidade_registros`, `valor_total`, `status`, `observacoes`, `created_by`, `validated_by`, `validated_at`.
  - Check constraint real: `CHECK (status IN ('AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'DEVOLVIDO', 'CANCELADO', 'FECHADO_FINANCEIRO', 'CNAB_GERADO', 'PAGO'))`.
- `public.rh_financeiro_lotes` e `public.rh_financeiro_lote_itens`:
  - **Inconsistência Detectada (Achado P1):** A migration tenta referenciar `rf.tipo = 'INTERMITENTES'` e atualizar `status = 'PENDENTE_RH'`. No entanto, `rh_financeiro_lotes` aceita apenas `tipo IN ('BANCO_HORAS', 'FOLHA_VARIAVEL', 'FOLHA_BASE')` e seu check de status não contém `PENDENTE_RH`. Como o ERP ORBE opera intermitentes exclusivamente em `intermitentes_lotes_fechamento`, essas queries em `rh_financeiro_lotes` são incompatíveis.

---

#### Verificação 04 — Validações da RPC `rpc_rh_retificar_intermitente`
- **Tenant:** Validação estrita via `v_tenant_id := public.current_tenant_id()` com cláusula `tenant_id = v_tenant_id` em todos os `SELECTs` e `UPDATEs`.
- **Perfil (RBAC):** `v_role NOT IN ('admin', 'super_admin', 'rh')` dispara erro `42501 (ROLE_NOT_AUTHORIZED)`.
- **Estados do Lançamento:** Lista positiva estrita: `v_lanc.status_pipeline IN ('RECEBIDO', 'EM_ANALISE_RH', 'DEVOLVIDO')`.
- **Estados do Lote Pai:** Lista positiva estrita: `v_lote_atual.status IN ('AGUARDANDO_VALIDACAO_RH', 'DEVOLVIDO')`.
- **Bloqueio por CNAB:** Consulta em `public.cnab_remessas_arquivos` onde `intermitentes_lote_id = v_lote_atual.id`. Se houver arquivo gerado, bloqueia com erro `22000 (VINCULO_BANCARIO)`.

---

#### Verificação 05 — Locks, Concorrência, Idempotência e OCC
- **Ordem Determinística de Locks:**
  1. Lock pessimista exclusivo no Lote Pai: `SELECT * FROM public.intermitentes_lotes_fechamento ... FOR UPDATE;` (Linha 139).
  2. Lock pessimista exclusivo no Lançamento Filho: `SELECT * FROM public.lancamentos_intermitentes ... FOR UPDATE;` (Linha 165).
  - Previne 100% deadlocks entre analistas retificando diferentes lançamentos do mesmo lote.
- **OCC (Optimistic Concurrency Control):**
  - Se `p_updated_at` for informado e divergir de `v_lanc.updated_at`, dispara `40001 (CONCORRENCIA)`.
- **Idempotência:**
  - Caso o lançamento já tenha sido retificado e pertença à mesma empresa, o update não gera efeitos colaterais duplicados.

---

#### Verificação 06 — Preservação de Remuneração e Rastreabilidade
- **Preservação de Valores:**
  - Na retificação de empresa, as colunas `total`, `horas_trabalhadas`, `horas_normais`, `he_50`, `he_100` e `hora_noturna` permanecem inalteradas.
- **Ausência de Exclusão Física:** Não há comando `DELETE`. O apontamento é desvinculado do lote anterior (`lote_fechamento_id = NULL`), recebe `lote_devolvido_origem_id = v_lanc.lote_fechamento_id` e transita para `status_pipeline = 'RECEBIDO'`, ficando disponível para novo fechamento pela empresa correta.
- **Trilha de Auditoria:** Gravação compulsória em `public.audit_log` contendo snapshot JSON com `empresa_id` anterior e nova, valores preservados, justificativa e usuário.

---

#### Verificação 07 — Comportamento da RPC `rpc_rh_revalidar_lote_devolvido`
- **Filtro de Estado Positivo:** Linha 336: `IF v_lote.status <> 'DEVOLVIDO' THEN RAISE EXCEPTION ...`.
- **Garantia:** Lotes em `VALIDADO_RH`, `FECHADO_FINANCEIRO`, `CNAB_GERADO`, `PAGO`, `CANCELADO` ou `AGUARDANDO_VALIDACAO_RH` **jamais** podem ser revalidados por essa rotina.
- **Transição Atômica:** O lote transita para `AGUARDANDO_VALIDACAO_RH` e seus lançamentos vinculados para `EM_ANALISE_RH`.

---

#### Verificação 08 — Interface do Encarregado vs Interface do RH
- **Interface do Encarregado (`IntermitentesRecebidos.tsx`):**
  - Botão e modal de "Reabrir Período" eliminados.
  - Aba *Devolvidos* possui `onEdit = undefined` (bloqueio total de edição).
  - Badge visual informativo: *"Sob Saneamento Exclusivo do RH"*.
  - Modal cadastral preliminar exibe horas e totais em cards Read-Only (não editáveis).
- **Interface do RH (`IntermitentesLotes.tsx`):**
  - Botão *"Retificar (RH)"* disponível para cada item no Drawer somente para perfis RH/Admin quando o lote está em `AGUARDANDO_VALIDACAO_RH` ou `DEVOLVIDO`.
  - Modal com justificativa formal obrigatória (mínimo 10 caracteres).
  - Botão *"Revalidar Lote no RH"* disponível no banner de lotes devolvidos.
  - Fallback gracioso implementado em `useSafeTenantRole` garantindo resiliência em qualquer árvore de providers.

---

#### Verificação 09 — Avaliação de Regressões em Outros Módulos
- **Importação Tio Digital:** Não afetada. O trigger possui bypass explícito para `auth.role() = 'service_role'`.
- **Fechamento de Períodos (`fecharPeriodo`):** Não afetado. A transição de `RECEBIDO` para `EM_ANALISE_RH` é permitida pelo trigger guard.
- **Aprovação RH e Validação:** Não afetadas. Transição para `APROVADO_RH` e criação de obrigação preservadas.
- **Módulo Bancário / CNAB:** Não afetado. A transição bancária de `CNAB_GERADO` para `PAGO` na conciliação é explicitamente resguardada na linha 49 do trigger.

---

#### Verificação 10 — Matriz de Comprovação Técnica

| Item de Validação | Comprovado por Código | Comprovado por Testes Automatizados | Exige Banco Isolado |
|---|:---:|:---:|:---:|
| Bloqueio de inputs financeiros na UI do Encarregado | Sim | Sim | Não |
| Desativação de `onEdit` em Devolvidos para o Encarregado | Sim | Sim | Não |
| Habilitação do botão Retificar (RH) no Drawer | Sim | Sim | Não |
| Habilitação da Revalidação de Lote Devolvido no RH | Sim | Sim | Não |
| Contrato da chamada RPC nos services TypeScript | Sim | Sim | Não |
| Disparo de erro Fail-Closed na RPC ao alterar horas | Sim | Sim (Mock) | **SIM (SQL)** |
| Bloqueio do Trigger Guard contra mutação direta via REST | Sim | Sim (Mock) | **SIM (SQL)** |
| Decremento atômico de registros e montante no lote pai | Sim | Sim (Mock) | **SIM (SQL)** |
| Inserção de registro na tabela `public.audit_log` | Sim | Sim (Mock) | **SIM (SQL)** |

---

### 3. ACHADOS TÉCNICOS DETALHADOS (CLASSIFICAÇÃO P0 A P3)

```
┌─────────────┬────────────────────────────────────────────────────────────────────────┐
│ ACHADO P1   │ Incompatibilidade de constraints com tabela rh_financeiro_lotes       │
├─────────────┼────────────────────────────────────────────────────────────────────────┤
│ Arquivo     │ supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql │
│ Linhas      │ 211-225 e 357-364                                                      │
│ Descrição   │ A RPC tenta fazer UPDATE em `public.rh_financeiro_lotes` com           │
│             │ `tipo = 'INTERMITENTES'` e `status = 'PENDENTE_RH'`. No entanto,       │
│             │ `rh_financeiro_lotes` aceita apenas `tipo IN ('BANCO_HORAS',            │
│             │ 'FOLHA_VARIAVEL', 'FOLHA_BASE')` e o status `PENDENTE_RH` viola a      │
│             │ constraint de status daquela tabela. O domínio de intermitentes opera  │
│             │ exclusivamente sobre `public.intermitentes_lotes_fechamento`.          │
│ Impacto     │ Se um lote de intermitentes possuísse vínculo nessa tabela, a RPC      │
│             │ falharia com violação de CHECK constraint (`SQLSTATE 23514`).          │
│ Correção    │ Remover as queries de atualização em `rh_financeiro_lotes` e           │
│             │ `rh_financeiro_lote_itens` da migration, visto que intermitentes usam  │
│             │ exclusivamente o pipeline `intermitentes_lotes_fechamento`.            │
└─────────────┴────────────────────────────────────────────────────────────────────────┘

┌─────────────┬────────────────────────────────────────────────────────────────────────┐
│ ACHADO P2   │ Lacuna no Trigger Guard para alteração direta de lote_fechamento_id    │
├─────────────┼────────────────────────────────────────────────────────────────────────┤
│ Arquivo     │ supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql │
│ Linhas      │ 34-54                                                                  │
│ Descrição   │ O trigger guard bloqueia `total`, `horas_*` e status terminal, mas     │
│             │ não impede que um client comum autenticado faça um UPDATE direto de    │
│             │ `lote_fechamento_id = NULL` ou `empresa_id = nova` se o apontamento    │
│             │ estiver em `DEVOLVIDO` ou `EM_ANALISE_RH`.                             │
│ Impacto     │ Permite que um script ou chamada direta via API REST desvincule um     │
│             │ apontamento de um lote sem passar pela RPC oficial do RH, deixando os  │
│             │ acumuladores do lote pai dessincronizados.                             │
│ Correção    │ No trigger guard, adicionar verificação impedindo alteração de         │
│             │ `empresa_id` ou `lote_fechamento_id` quando `OLD.lote_fechamento_id    │
│             │ IS NOT NULL`, a menos que `current_setting('orbe.in_rpc_retificacao')  │
│             │ seja 'true' ou o executor seja `service_role`.                         │
└─────────────┴────────────────────────────────────────────────────────────────────────┘

┌─────────────┬────────────────────────────────────────────────────────────────────────┐
│ ACHADO P3   │ Código SQLSTATE genérico em raise de recálculo de horas               │
├─────────────┼────────────────────────────────────────────────────────────────────────┤
│ Arquivo     │ supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql │
│ Linha       │ 182                                                                    │
│ Descrição   │ O raise de fail-closed para recálculo de horas utiliza ERRCODE '22000' │
│             │ (data_exception). O padrão ANSI/PostgreSQL para recurso não            │
│             │ implementado é '0A000' (feature_not_supported).                        │
│ Impacto     │ Baixo / Semântico (funcionalmente o erro é capturado e impede a ação).  │
│ Correção    │ Ajustar ERRCODE para '0A000'.                                          │
└─────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

### 4. CORREÇÕES OBRIGATÓRIAS ANTES DA APLICAÇÃO DA MIGRATION

Antes de executar o arquivo SQL no banco Supabase em ambiente isolado, as seguintes correções pontuais devem ser aplicadas no arquivo local `supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`:

1. **Remoção de referências espúrias a `rh_financeiro_lotes`:**
   - Excluir os blocos de UPDATE em `public.rh_financeiro_lote_itens` e `public.rh_financeiro_lotes` (linhas 211-225 e 357-364), mantendo a sincronização exclusivamente em `intermitentes_lotes_fechamento`.
2. **Blindagem do Trigger Guard contra desvinculação direta de lote:**
   - Inserir no trigger:
     ```sql
     IF (NEW.empresa_id IS DISTINCT FROM OLD.empresa_id OR NEW.lote_fechamento_id IS DISTINCT FROM OLD.lote_fechamento_id) AND OLD.lote_fechamento_id IS NOT NULL THEN
         RAISE EXCEPTION 'MUTAÇÃO_PROIBIDA: Lançamentos vinculados a lotes só podem ser retificados através da RPC rpc_rh_retificar_intermitente.'
         USING ERRCODE = '42501';
     END IF;
     ```
3. **Padronização do ERRCODE em `p_novas_horas`:**
   - Atualizar para `ERRCODE = '0A000'`.

---

### 5. PLANO DE TESTES PARA AMBIENTE ISOLADO (STAGING)

Após a aprovação do proprietário e aplicação das correções acima:

1. **Teste SQL-01:** Executar `SELECT rpc_rh_retificar_intermitente(p_lancamento_id, p_nova_empresa_id, p_novas_horas := 10)` com perfil RH.
   - *Resultado esperado:* Erro `OPERACAO_BLOQUEADA (0A000)` comprovando o Fail-Closed.
2. **Teste SQL-02:** Tentar executar `UPDATE lancamentos_intermitentes SET empresa_id = ...` diretamente via PostgREST client autenticado para registro com lote vinculado.
   - *Resultado esperado:* Erro `42501 (MUTAÇÃO_PROIBIDA)` pelo trigger guard.
3. **Teste SQL-03:** Executar `SELECT rpc_rh_retificar_intermitente(...)` com justificativa válida (<10 chars vs >=10 chars).
   - *Resultado esperado:* Validação de string com erro `22023` se menor que 10; sucesso se >= 10.
4. **Teste SQL-04:** Retificar lançamento de Empresa A para Empresa B.
   - *Resultado esperado:* Lote pai da Empresa A decrementa `quantidade_registros` e `valor_total`. Lançamento fica desvinculado com `lote_devolvido_origem_id` preenchido. Registro inserido em `public.audit_log`.
5. **Teste SQL-05:** Executar `SELECT rpc_rh_revalidar_lote_devolvido(...)` em lote `DEVOLVIDO`.
   - *Resultado esperado:* Lote passa para `AGUARDANDO_VALIDACAO_RH` e lançamentos para `EM_ANALISE_RH`.
6. **Teste SQL-06:** Tentar revalidar lote em status `PAGO` ou `VALIDADO_RH`.
   - *Resultado esperado:* Erro `ESTADO_INVALIDO (22000)`.

---

### 6. VEREDITO TÉCNICO FINAL

| Status Atual | Status Pós-Correções P1/P2 |
|:---:|:---:|
| ⚠️ **NÃO APTO PARA BANCO** | ✅ **APTO PARA HOMOLOGAÇÃO EM BANCO ISOLADO** |

**Justificativa:**
A arquitetura conceitual e a implementação frontend/service atendem perfeitamente aos requisitos de negócio. Porém, antes de executar a migration no Supabase, é mandatório sanear o script SQL removendo os UPDATEs espúrios em `rh_financeiro_lotes` (P1) e blindando a desvinculação direta de lotes no trigger guard (P2), evitando riscos de falha em runtime ou vulnerabilidade de bypass da API REST.

Nenhuma alteração foi realizada nesta etapa, permanecendo o ambiente em modo estritamente **READ-ONLY**.

Aguardando autorização do proprietário para o próximo passo.
