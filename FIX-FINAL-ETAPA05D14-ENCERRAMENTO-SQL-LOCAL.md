# RELATÓRIO DE ENCERRAMENTO DA HOMOLOGAÇÃO SQL LOCAL E PREPARAÇÃO DE IMPLANTAÇÃO
**ERP ORBE — DOMÍNIO RH / INTERMITENTES — FIX-FINAL / ETAPA 05D.14**  
**Data:** 12/10/2026 | **Cluster:** PostgreSQL 17.5 Isolado Local (`127.0.0.1:54322`)  
**Status da Homologação SQL Local:** **100% HOMOLOGADO E CONCLUÍDO (APROVADO PARA TRANSIÇÃO)**  
**Status para Produção:** **PENDENTE DE HOMOLOGAÇÃO E2E (SUPABASE REAL / POSTGREST / UI)**

---

## 1. PARECER EXECUTIVO DE HOMOLOGAÇÃO LOCAL

A homologação SQL do módulo de **Retificação Segura de Intermitentes pelo RH (Etapas 05B, 05C e 05D)** foi formalmente encerrada no cluster PostgreSQL 17.5 local isolado.

Todos os testes canônicos, testes de regressão, testes de concorrência física real e testes de isolamento multi-tenant (RLS) foram executados e aprovados com **100% de sucesso**.

### Síntese Consolidada das Baterias:
1. **R01 (Prova Anti-Erro 55000):** **PASS** (`00000`) — Comprovada a retificação de lançamentos avulsos (`lote_fechamento_id IS NULL`) sem falha de acesso a registros não atribuídos.
2. **T01 a T14 (Bateria Canônica):** **14/14 PASS (100%)** — Todas as 14 regras de governança, bloqueios de mutação direta via API client, anti-bypass, consistência de lotes e OCC foram homologadas com zero regressões.
3. **C01 (Concorrência Real e OCC):** **PASS** — Duas conexões físicas concorrentes (`psql`) comprovadas em `pg_locks` (`granted = false`); Sessão 1 concluiu com sucesso e Sessão 2 foi bloqueada por OCC com **SQLSTATE 40001**, com zero lost update e decremento único.
4. **C02 (Permissões Não Privilegiadas e RLS):** **5/5 PASS** — Executado sob conexão física com papel não-superuser (`orbe_unprivileged_test`), atestando o bloqueio por GRANT de `anon`, fail-closed de `authenticated` sem token e isolamento multi-tenant em leitura (`USING`) e escrita (`WITH CHECK`).

---

## 2. MATRIZ CONSOLIDADA DE EVIDÊNCIAS (ETAPAS 05B, 05C E 05D)

| ID | Cenário de Teste | Papel / Contexto | Mecanismo Avaliado | SQLSTATE Esperado | SQLSTATE Obtido | Status |
|:---:|:---|:---:|:---|:---:|:---:|:---:|
| **R01** | Retificação de lançamento sem lote vinculado | `rh` (Sessão Oficial) | RPC (Lógica sem Lote) | `00000` | `00000` | **PASS** |
| **T01** | Retificação legítima pelo RH | `rh` | RPC Oficial RH | `00000` | `00000` | **PASS** |
| **T02** | Bloqueio de Encarregado na RPC | `encarregado` | RPC (Role Check) | `42501` | `42501` | **PASS** |
| **T03** | Bloqueio de UPDATE direto de total/horas | `encarregado` | Trigger Guardião UPDATE | `42501` | `42501` | **PASS** |
| **T04** | Bloqueio de bypass via flag forjada | `encarregado` | Trigger Guardião (Stack) | `42501` | `42501` | **PASS** |
| **T05** | Bloqueio de empresa de outro tenant | `rh` | FK / Verificação Tenant | `23503` | `23503` | **PASS** |
| **T06** | Bloqueio de lote aprovado pelo RH | `rh` | RPC (Lote Aprovado) | `55000` | `55000` | **PASS** |
| **T07** | Bloqueio de lote com CNAB bancário | `rh` | RPC (Vínculo Bancário) | `55000` | `55000` | **PASS** |
| **T08** | Bloqueio fail-closed de alteração de horas | `rh` | RPC (Sem Motor Convocação)| `0A000` | `0A000` | **PASS** |
| **T09** | Preservação de total e horas originais | `rh` | Imutabilidade Financeira | `00000` | `00000` | **PASS** |
| **T10** | Consistência matemática do lote de origem | `rh` | Decremento Atômico de Lote| `00000` | `00000` | **PASS** |
| **T11** | Gravação compulsória em `audit_log` | `rh` | Trilha de Auditoria | `00000` | `00000` | **PASS** |
| **T12** | Detecção de conflito de concorrência (OCC)| `rh` | Validação de `updated_at` | `40001` | `40001` | **PASS** |
| **T13** | Fechamento operacional legítimo | `encarregado` | Trigger Guardião (Vínculo)| `00000` | `00000` | **PASS** |
| **T14** | Revalidação de lote devolvido pelo RH | `rh` | RPC Revalidação de Lote | `00000` | `00000` | **PASS** |
| **C01** | Concorrência física real entre 2 sessões | `rh` (Sessões Concorrentes)| Lock `FOR UPDATE` + OCC | `40001` | `40001` | **PASS** |
| **C02.1**| Negação de EXECUTE na RPC a `anon` | `anon` | GRANT (Procedure) | `42501` | `42501` | **PASS** |
| **C02.2**| Negação de UPDATE e DELETE a `anon` | `anon` | GRANT (Tabela) | `42501` | `42501` | **PASS** |
| **C02.3**| Negação a `authenticated` sem JWT sub | `authenticated` | RPC (Fail-Closed Auth) | `42501` | `42501` | **PASS** |
| **C02.4**| Isolamento RLS de Leitura Multi-Tenant | `authenticated` (Alpha/Beta)| RLS (`USING`) | `00000` | `00000` | **PASS** |
| **C02.5**| Isolamento RLS de Escrita Multi-Tenant | `authenticated` (Alpha/Beta)| RLS (`WITH CHECK`) | `42501` | `42501` | **PASS** |

---

## 3. ARQUIVOS ENVOLVIDOS E ESCOPO PARA PRODUÇÃO

### 3.1 Único Arquivo Rastreado Destinado à Aplicação em Produção:
- [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql)
  - **Estado:** Corrigido estaticamente na Etapa 05D.10, validado em regressão na Etapa 05D.11B e auditado.
  - **Conteúdo Oficial:**
    1. Coluna de rastreabilidade `lote_devolvido_origem_id` e índice parcial.
    2. Trigger guardião `fn_guard_lancamentos_intermitentes_update` (anti-mutação client).
    3. Trigger guardião `fn_guard_lancamentos_intermitentes_delete` (anti-data-loss).
    4. Trigger guardião `fn_guard_intermitentes_lotes_delete` (anti-deleção de lotes ativos/bancários).
    5. Procedure `rpc_rh_retificar_intermitente` (com OCC, segurança fail-closed, desvinculação atômica e auditoria).
    6. Procedure `rpc_rh_revalidar_lote_devolvido` (revalidação legítima pós-saneamento).
    7. Concessões restritas (`REVOKE FROM PUBLIC, anon; GRANT TO authenticated, service_role`).

### 3.2 Arquivos Experimentais Isolados (NÃO VÃO PARA PRODUÇÃO):
Todos os artefatos abaixo foram mantidos restritos ao diretório `scratch/` e **não afetam** o repositório ou o schema de produção:
- `scratch/01_schema_base_intermitentes.sql` (schema sintético local)
- `scratch/02_test_runner_14_scenarios.sql` (runner de testes)
- `scratch/03_c01_*` e `scratch/04_c02_*` (scripts de testes complementares)
- `scratch/restore_seed_05c.sql` (seed sintético)
- Papel auxiliar de teste `orbe_unprivileged_test` (criado apenas no cluster local `54322`)
- Tabelas utilitárias de logging `hml_c01_*` e `hml_c02_*`

---

## 4. ANÁLISE DE COMPATIBILIDADE COM O SCHEMA SUPABASE REAL

A migration oficial foi comparada com o schema do Supabase em produção:

1. **Dependências Existentes:**
   - `public.profiles`: Possui `id`, `user_id`, `tenant_id`, `role`, `nome`, `email` — **Compatível**.
   - `public.tenants` e `public.empresas`: Estrutura relacional multi-tenant — **Compatível**.
   - `public.audit_log`: Colunas `tenant_id`, `empresa_id`, `usuario_id`, `usuario_nome`, `perfil_usuario`, `acao`, `entidade`, `registro_id`, `descricao`, `valor_anterior`, `valor_novo`, `origem` — **100% Compatível**.
   - `public.cnab_remessas_arquivos`: Possui coluna `intermitentes_lote_id` — **Compatível**.
2. **Funções Utilitárias Globais:**
   - `public.current_tenant_id()` e `public.get_user_role()`: Funções canônicas já presentes no Supabase do ORBE — **Compatíveis**.
   - `auth.uid()` e `auth.role()`: Nativas do ecossistema Supabase Auth — **Compatíveis**.
3. **Políticas RLS:** A migration não cria nem remove tabelas centrais; apenas reforça a segurança via triggers e RPCs `SECURITY DEFINER`, respeitando rigorosamente as políticas RLS existentes.

---

## 5. PENDÊNCIAS E RISCOS

### 5.1 Pendências Bloqueantes para Conclusão do Módulo de Intermitentes:
- **Homologação E2E via PostgREST / GoTrue:** O ambiente local isolado testou o motor SQL via emulação de claims de sessão. A validação do token JWT real emitido pelo GoTrue com assinatura RSA/HMAC e decodificado pelo PostgREST precisa ocorrer em ambiente conectado (Staging).
- **Homologação Funcional da Interface (UI / React):** Testar o comportamento das telas `IntermitentesLotes.tsx` e `IntermitentesRecebidos.tsx`, garantindo que:
  1. A modal de retificação capture o erro `40001` e exiba mensagem amigável solicitando recarregamento da página.
  2. A alteração de empresa acione a RPC corretamente com envio do `updated_at`.
  3. Lançamentos desvinculados apareçam de imediato na fila de "Recebidos".

### 5.2 Melhorias Não-Bloqueantes (Pós-Implantação):
- Automatização da bateria T01–T14 no pipeline de CI/CD via GitHub Actions com Supabase CLI nativo.
- Monitoramento de métricas de SLA na tabela `audit_log` para retificações de RH.

---

## 6. PLANO DE IMPLANTAÇÃO CONTROLADA (STAGING / PRODUÇÃO)

A aplicação da migration `20261012120000_etapa05b_retificacao_intermitentes_rh.sql` deverá seguir o roteiro abaixo:

### Fase 1: Pré-Implantação
1. Realizar backup consistente (dump) das tabelas `lancamentos_intermitentes`, `intermitentes_lotes_fechamento` e `audit_log` antes da migração.
2. Confirmar que não há lotes de intermitentes em processamento de remessa bancária concorrente no momento da aplicação.
3. Obter janela técnica de baixa concorrência operacional.

### Fase 2: Aplicação
1. Aplicar a migration via CLI oficial do Supabase (`supabase db push` ou dashboard SQL console em transação atômica).
2. Verificar no catálogo se os triggers e RPCs foram criados com `search_path = public, pg_temp` e permissões atribuídas a `authenticated`.

### Fase 3: Validação Imediata Pós-Migration
Executar checklist de integridade:
- Inspecionar a existência da coluna `lote_devolvido_origem_id` e seu índice.
- Inspecionar a existência dos triggers `trg_guard_lancamentos_intermitentes`, `trg_guard_lancamentos_intermitentes_delete` e `trg_guard_intermitentes_lotes_delete`.
- Inspecionar a assinatura e grants de `rpc_rh_retificar_intermitente` e `rpc_rh_revalidar_lote_devolvido`.

### Fase 4: Plano de Rollback Imediato
Caso seja detectada qualquer inconsistência, executar o script de reversão:
```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_guard_lancamentos_intermitentes ON public.lancamentos_intermitentes;
DROP TRIGGER IF EXISTS trg_guard_lancamentos_intermitentes_delete ON public.lancamentos_intermitentes;
DROP TRIGGER IF EXISTS trg_guard_intermitentes_lotes_delete ON public.intermitentes_lotes_fechamento;
DROP FUNCTION IF EXISTS public.rpc_rh_retificar_intermitente(UUID, UUID, NUMERIC, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_rh_revalidar_lote_devolvido(UUID, TEXT);
DROP FUNCTION IF EXISTS public.fn_guard_lancamentos_intermitentes_update();
DROP FUNCTION IF EXISTS public.fn_guard_lancamentos_intermitentes_delete();
DROP FUNCTION IF EXISTS public.fn_guard_intermitentes_lotes_delete();
ALTER TABLE public.lancamentos_intermitentes DROP COLUMN IF EXISTS lote_devolvido_origem_id CASCADE;
COMMIT;
```

---

## 7. CRITÉRIOS OBJETIVOS DE GO / NO-GO

| Critério | Condição GO | Condição NO-GO | Avaliação Atual |
|:---|:---|:---|:---:|
| **Homologação SQL Local** | 100% de aprovação (R01, T01–T14, C01, C02) | Qualquer teste FAIL ou inconsistência | **GO** |
| **Isolamento de Produção** | Zero dados de homologação ou papéis de teste em prod | Vazamento de credenciais ou scripts de teste | **GO** |
| **Integridade de Migrations** | 1 único arquivo limpo, auditado e compatível | Migrations com dependências circulares | **GO** |
| **Homologação E2E Supabase Real** | Tokens JWT reais testados via API REST | Falha de autorização no PostgREST | **NO-GO (Pendente)** |
| **Validação da Interface (UI)** | Telas de fechamento e retificação integradas | Erro não tratado de concorrência na interface | **NO-GO (Pendente)** |

---

## 8. CONCLUSÃO E PRÓXIMOS PASSOS

A camada de banco de dados (PostgreSQL) para a **Retificação Segura de Intermitentes pelo RH** encontra-se **tecnicamente concluída, auditada e homologada localmente**.

**Próximo Passo Recomendado:**
Submeter este relatório à governança do projeto para avaliação e, uma vez autorizado, proceder para a **homologação controlada de integração no ambiente Supabase / PostgREST e validação funcional pela interface do usuário (UI)**.
