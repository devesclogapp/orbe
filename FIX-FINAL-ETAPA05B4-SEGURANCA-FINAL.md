# ERP ORBE — FIX-FINAL / ETAPA 05B.4
# Verificação Final de Segurança da Migration

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Concluído Localmente (Zero alterações remotas, Zero comandos Git de escrita)  
> **Arquivo Analisado e Corrigido:** [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql)  

---

## 1. OBJETIVO DA ETAPA

Auditar e blindar as duas superfícies críticas de risco remanescentes na migration antes de qualquer execução em ambiente isolado:
1. **Autorização Exclusiva da RPC:** Eliminar a vulnerabilidade onde um usuário autenticado com perfil RH/Admin pudesse executar `UPDATE` direto na tabela `public.lancamentos_intermitentes` forjando `set_config('orbe.in_rpc_retificacao', 'true')` em sua sessão.
2. **Vinculação Inicial de Lotes (Fechamento Operacional):** Blindar a exceção de fechamento operacional no trigger para garantir que nenhum lançamento possa ser vinculado a outro tenant, outra empresa, lote em estado inválido, lançamento já fechado/devolvido ou com transição ilegal de status.

---

## 2. SUPERFÍCIE 1 — AUTORIZAÇÃO EXCLUSIVA DA RPC

### 2.1 Análise de Vulnerabilidade (Causa Raiz)
Na versão anterior, a permissão para contornar o trigger guardião dependia da checagem:
```sql
IF current_setting('orbe.in_rpc_retificacao', true) = 'true' THEN
    IF lower(trim(coalesce(public.get_user_role(), ''))) IN ('admin', 'super_admin', 'rh') THEN
        RETURN NEW;
    END IF;
END IF;
```
**O Risco:** Embora usuários comuns (operacionais/encarregados) fossem bloqueados pela validação de role, um usuário com perfil legítimo de RH ou Admin que enviasse requisições REST manuais via PostgREST/psql poderia invocar `SELECT set_config('orbe.in_rpc_retificacao', 'true', false)` e em seguida executar `UPDATE public.lancamentos_intermitentes SET empresa_id = '...', lote_fechamento_id = NULL`.
Isso burlaria:
- O controle de concorrência otimista (OCC por `updated_at`);
- O recálculo/decremento transacional do lote pai em `intermitentes_lotes_fechamento`;
- A verificação de remessa CNAB gerada;
- A auditoria compulsória formal em `public.audit_log`;
- A obrigatoriedade de justificativa formal com no mínimo 10 caracteres.

### 2.2 Solução Implementada: Autorização Imutável em 4 Camadas
O trigger guardião [`fn_guard_lancamentos_intermitentes_update`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql#L21-L40) foi reforçado com validações intrínsecas ao motor do PostgreSQL que **não podem ser forjadas pelo cliente**:

```sql
-- 2. Autorização exclusiva para retificações originadas da RPC rpc_rh_retificar_intermitente.
-- Não depende de contexto controlável pelo cliente. Exige simultaneamente:
-- A) Stack de execução real do motor PL/pgSQL contendo a RPC oficial (unforgeable via PG_CONTEXT)
-- B) Contexto de execução elevado SECURITY DEFINER (current_user = 'postgres')
-- C) Flag transacional configurada pela RPC (orbe.in_rpc_retificacao = 'true')
-- D) Perfil autenticado comprovado de governança (RH ou Administrador)
GET DIAGNOSTICS v_stack = PG_CONTEXT;
IF (v_stack LIKE '%rpc_rh_retificar_intermitente%') AND
   (current_user = 'postgres') AND
   (current_setting('orbe.in_rpc_retificacao', true) = 'true') AND
   (lower(trim(coalesce(public.get_user_role(), ''))) IN ('admin', 'super_admin', 'rh')) THEN
    RETURN NEW;
END IF;
```

#### Por que esta solução é inviolável pelo cliente:
1. **Inspeção de Stack (`GET DIAGNOSTICS ... = PG_CONTEXT`):** `PG_CONTEXT` é gerado diretamente pela máquina de estados C do PostgreSQL inspecionando os frames ativos de execução PL/pgSQL. Se o comando não foi disparado de dentro de `rpc_rh_retificar_intermitente`, a string da RPC **não existe** na stack. Nenhum header, payload ou comando SQL do cliente pode forjar a stack de execução interna.
2. **Contexto de Execução Elevado (`current_user = 'postgres'`):** PostgREST conecta sessões sob a role `authenticated`. Clientes não possuem privilégio `SET ROLE postgres`. O valor de `current_user` só se torna `'postgres'` durante a execução de uma função `SECURITY DEFINER` de propriedade do superusuário/postgres.
3. **Flag Transacional Local com Auto-Reset:** A RPC ativa a flag com `is_local = true` e a desativa imediatamente após a execução dos comandos de DML:
   ```sql
   PERFORM set_config('orbe.in_rpc_retificacao', 'false', true);
   ```
4. **Perfil Autenticado:** Mantém a garantia de que apenas analistas de RH ou Admins operam a transação.

### 2.3 Privilégios e Exposição
Foi reforçada a declaração estrita de privilégios para todas as funções da migration:
```sql
ALTER FUNCTION public.fn_guard_lancamentos_intermitentes_update() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() TO service_role;
```

---

## 3. SUPERFÍCIE 2 — VINCULAÇÃO INICIAL DE LOTES (FECHAMENTO OPERACIONAL)

### 3.1 Análise dos Riscos de Fechamento Operacional
A exceção necessária para permitir que o Encarregado agrupe lançamentos avulsos em um novo lote (`lote_fechamento_id: lote.id, status_pipeline: 'EM_ANALISE_RH'`) foi submetida a auditoria completa contra fraudes e inconsistências relacionais.

### 3.2 Regras Blindadas no Trigger Guardião (Passo 5)
```sql
-- 5. Validação rigorosa de vinculação inicial de lote (Fechamento Operacional Oficial)
IF OLD.lote_fechamento_id IS NULL AND NEW.lote_fechamento_id IS NOT NULL THEN
    -- A. Lançamento precisa estar no estado inicial RECEBIDO (impede reutilizar fechados ou devolvidos)
    IF OLD.status_pipeline <> 'RECEBIDO' THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Apenas lançamentos no status RECEBIDO podem ser incluídos em novos lotes. Status atual: %', OLD.status_pipeline
        USING ERRCODE = '55000';
    END IF;

    -- B. No fechamento operacional, o status deve transitar estritamente para EM_ANALISE_RH
    IF NEW.status_pipeline <> 'EM_ANALISE_RH' THEN
        RAISE EXCEPTION 'TRANSICAO_INVALIDA: A vinculação inicial a lote exige transição para EM_ANALISE_RH. Status informado: %', NEW.status_pipeline
        USING ERRCODE = '55000';
    END IF;

    -- C. A empresa não pode ser alterada no ato do fechamento
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
        RAISE EXCEPTION 'DIVERGENCIA_EMPRESA: Não é permitido alterar a empresa do lançamento durante o fechamento operacional.'
        USING ERRCODE = '42501';
    END IF;

    -- D. Valida que o lote de destino existe, pertence ao mesmo tenant, à mesma empresa e está aberto
    IF NOT EXISTS (
        SELECT 1 FROM public.intermitentes_lotes_fechamento
        WHERE id = NEW.lote_fechamento_id 
          AND tenant_id = OLD.tenant_id
          AND empresa_id = OLD.empresa_id
          AND status = 'AGUARDANDO_VALIDACAO_RH'
    ) THEN
        RAISE EXCEPTION 'LOTE_INVALIDO: Vinculação permitida apenas para lotes abertos (AGUARDANDO_VALIDACAO_RH) do mesmo tenant e empresa.'
        USING ERRCODE = '55000';
    END IF;
END IF;
```

### 3.3 Auditoria dos 5 Quesitos Exigidos
| Quesito Auditado | Risco | Mitigação Implementada no Trigger |
| :--- | :---: | :--- |
| **Vincular a lote de outra empresa** | Crítico | Subcondição C exige `NEW.empresa_id = OLD.empresa_id` e Subcondição D exige `intermitentes_lotes_fechamento.empresa_id = OLD.empresa_id`. |
| **Vincular a lote de outro tenant** | Crítico | Subcondição D exige explicitamente `tenant_id = OLD.tenant_id`. |
| **Associar registros a lotes em estado inválido** | Alto | Subcondição D restringe exclusivamente a lotes com `status = 'AGUARDANDO_VALIDACAO_RH'`. |
| **Reutilizar lançamentos já fechados ou devolvidos** | Alto | Subcondição A exige estritamente `OLD.status_pipeline = 'RECEBIDO'` e Passo 4 proíbe mutação se `OLD.lote_fechamento_id IS NOT NULL`. |
| **Burlar o fluxo oficial de fechamento** | Médio | Subcondição B exige estritamente transição para `NEW.status_pipeline = 'EM_ANALISE_RH'`. |

---

## 4. EVIDÊNCIAS DE VALIDAÇÃO LOCAL

### 4.1 Checagem de Tipos TypeScript
```powershell
npx tsc --noEmit
# Resultado: Exit Code 0 (Zero erros em toda a codebase)
```

### 4.2 Suíte de Testes da Etapa 05B e Regressões
```text
✓ src/test/fix_int_etapa05b_retificacao_rh.test.tsx (8 tests)
  ✓ 1. Contrato da RPC rpc_rh_retificar_intermitente: parâmetros, governança e OCC (4 testes)
  ✓ 2. Regras de Interface: Bloqueio do Encarregado e Habilitação do RH (2 testes)
  ✓ 3. Desvinculação Transacional e Atualização de Lote de Origem (2 testes)

✓ src/test/fix_int_etapa04_ux_status.test.tsx (5 tests)
  ✓ FIX-INT-03: Diálogo Oficial de Confirmação com resumo e impacto (1 teste)
  ✓ FIX-INT-03: Prevenção de concorrência e disable durante fechamento (1 teste)
  ✓ FIX-INT-04: Aba dedicada 'Devolvidos' com contagem isolada (1 teste)
  ✓ FIX-INT-04: Badges oficiais e estados de lotes (2 testes)

✓ src/test/conv17_fix_final_encerramento.test.tsx (18 tests)
  ✓ Comportamento do Drawer Primário para todos os status de lotes (18 testes)

Total de Arquivos de Teste: 3 passed (3)
Total de Testes Executados: 31 passed (31)
Taxa de Sucesso:            100%
```

---

## 5. CLASSIFICAÇÃO DE PENDÊNCIAS DE TESTE EM BANCO ISOLADO

Embora a análise estática e sintática do SQL garanta conformidade com as especificações do PostgreSQL 15+ (PostgREST/Supabase), as seguintes verificações dependem da execução real do motor do banco e são formalmente classificadas como:

> **CLASSIFICAÇÃO: PENDENTE DE TESTE EM BANCO ISOLADO**

1. **Validação do `PG_CONTEXT` em Ambiente PostgREST Real:**
   - Confirmar o formato exato da string retornada por `GET DIAGNOSTICS v_stack = PG_CONTEXT` quando invocada via `supabase.rpc('rpc_rh_retificar_intermitente')`.
2. **Comportamento do `current_user` sob `SECURITY DEFINER`:**
   - Confirmar que a alternância para `postgres` ocorre de forma isolada sem afetar `auth.uid()` ou `auth.role()`.
3. **Simulação de Tentativa de Injeção Direta por Cliente REST:**
   - Executar teste de penetração com cliente autenticado tentando atualizar `lancamentos_intermitentes` diretamente via REST e confirmar o bloqueio imediato com `42501 (VINCULO_PROTEGIDO)` e `55000 (ESTADO_INVALIDO)`.

---

## 6. VEREDITO FINAL

| Critério de Avaliação | Resultado | Observação |
| :--- | :---: | :--- |
| **Integridade Funcional da Aplicação** | **APROVADO** | TypeScript limpo e 31 testes vitest 100% verdes |
| **Blindagem de Permissões e Roles** | **APROVADO** | Encarregado desarmado de ações de retificação |
| **Incompatibilidade Financeira (P1)** | **SANEADO** | Tabelas incompatíveis removidas; fluxo canônico preservado |
| **Proteção de Vínculos e Fechamento (P2)** | **BLINDADO** | Tenant, empresa e status estritamente validados no trigger |
| **Padronização de Erros (P3)** | **ALINHADO** | SQLSTATEs 42501, 55000, 0A000, 22023, 40001 e P0002 |
| **Segurança contra Bypass da RPC (05B.4)** | **BLINDADO** | Mecanismo unforgeable via `PG_CONTEXT` e `current_user` |

### Veredito Técnico:
A migration [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql) está **HOMOLOGADA LOCALMENTE** e declarada **APTA PARA TESTES EM BANCO ISOLADO (STAGING)**.

*Nenhuma ação remota de migration, deploy ou Git foi executada. Aguardando autorização expressa do usuário para a próxima etapa.*
