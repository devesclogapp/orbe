# ERP ORBE — FIX-FINAL / ETAPA 05C.3
# Auditoria Manual SQL — Base Operacional

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Destinatário:** Proprietário do ERP ORBE  
> **Finalidade:** Verificação manual de compatibilidade de schema no Supabase SQL Editor  
> **Classificação:** 100% READ-ONLY (Consultas estritamente seguras de metadados e contagens agregadas — Zero alterações, Zero PII)  

---

## GUIA DE EXECUÇÃO PARA O PROPRIETÁRIO

1. Acesse o **Supabase Studio** do projeto operacional (`lifgjtcflzmspilhryap`).
2. No menu lateral esquerdo, clique em **SQL Editor**.
3. Crie uma nova query (**+ New Query**).
4. Copie e cole **um bloco de cada vez** (ou a query completa, executando seção por seção).
5. Clique em **Run** (ou `Ctrl + Enter`).
6. Cole os resultados obtidos de volta no chat para análise comparativa pré-migration.

---

## CONSULTA 01 — ESTRUTURA DE `lancamentos_intermitentes`

### Finalidade:
Verificar as colunas existentes, tipos de dados, nulidade e valores default da tabela canônica de jornadas de intermitentes.  
*Objetivo crítico:* Confirmar a presença de `empresa_id`, `lote_fechamento_id`, `status_pipeline`, `horas_trabalhadas`, `total` e verificar se a coluna `lote_devolvido_origem_id` já existe ou se ainda precisa ser criada pela migration.

```sql
-- CONSULTA 01: Estrutura de colunas de public.lancamentos_intermitentes
SELECT 
    ordinal_position AS pos,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'lancamentos_intermitentes'
ORDER BY ordinal_position;
```

### Resultado Esperado:
- Deve listar colunas como: `id` (uuid), `tenant_id` (uuid), `empresa_id` (uuid), `colaborador_id` (uuid), `nome_colaborador` (text), `cpf_colaborador` (text), `data_referencia` (date), `horas_trabalhadas` (numeric), `horas_normais` (numeric), `he_50` (numeric), `he_100` (numeric), `hora_noturna` (numeric), `total` (numeric), `status_pipeline` (text), `lote_fechamento_id` (uuid).
- Se `lote_devolvido_origem_id` não aparecer, a migration irá adicioná-la com sucesso. Se já existir, a cláusula `ADD COLUMN IF NOT EXISTS` da migration garantirá idempotência.

---

## CONSULTA 02 — ESTRUTURA DE `intermitentes_lotes_fechamento`

### Finalidade:
Verificar as colunas, tipos e valores default da tabela canônica de lotes de intermitentes.  
*Objetivo crítico:* Confirmar a presença de `id`, `tenant_id`, `empresa_id`, `competencia`, `periodo_inicio`, `periodo_fim`, `quantidade_registros`, `valor_total` e `status`.

```sql
-- CONSULTA 02: Estrutura de colunas de public.intermitentes_lotes_fechamento
SELECT 
    ordinal_position AS pos,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'intermitentes_lotes_fechamento'
ORDER BY ordinal_position;
```

### Resultado Esperado:
- Deve conter `id` (uuid), `tenant_id` (uuid), `empresa_id` (uuid), `competencia` (varchar/text), `quantidade_registros` (integer), `valor_total` (numeric), `status` (text), `observacoes` (text).

---

## CONSULTA 03 — CONSTRAINTS E CHAVES ESTRANGEIRAS

### Finalidade:
Mapear todas as constraints de integridade (CHECK, FOREIGN KEY, UNIQUE, PRIMARY KEY) das tabelas de intermitentes.  
*Objetivo crítico:* Inspecionar a check constraint real de `status_pipeline` em `lancamentos_intermitentes` e de `status` em `intermitentes_lotes_fechamento` para comprovar que os status `RECEBIDO`, `EM_ANALISE_RH`, `DEVOLVIDO`, `APROVADO_RH`, `CNAB_GERADO`, `PAGO` e `CANCELADO` são aceitos.

```sql
-- CONSULTA 03: Constraints e regras de validação
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
   AND tc.table_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('lancamentos_intermitentes', 'intermitentes_lotes_fechamento')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
```

### Resultado Esperado:
- `lancamentos_intermitentes`: Check constraint de status contendo os estados permitidos e foreign keys para `tenants`, `empresas`, `colaboradores` e `intermitentes_lotes_fechamento`.
- `intermitentes_lotes_fechamento`: Check constraint de status e foreign keys para `tenants` e `empresas`.

---

## CONSULTA 04 — POLÍTICAS RLS E PRIVILÉGIOS DE ACESSO

### Finalidade:
Verificar o status de Row Level Security (RLS) e as políticas ativas nas tabelas de intermitentes.  
*Objetivo crítico:* Confirmar que RLS está habilitado (`rowsecurity = true`) e identificar se existem policies que filtram por `tenant_id`.

```sql
-- CONSULTA 04: Status de RLS e Políticas de Segurança
SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual AS using_expression,
    p.with_check AS with_check_expression
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relname IN ('lancamentos_intermitentes', 'intermitentes_lotes_fechamento')
ORDER BY c.relname, p.policyname;
```

### Resultado Esperado:
- `rls_enabled` deve ser `true` para ambas as tabelas.
- Devem existir políticas de isolamento multi-tenant (`tenant_id = public.current_tenant_id()`).

---

## CONSULTA 05 — TRIGGERS E FUNÇÕES EXISTENTES

### Finalidade:
Verificar triggers atualmente anexados a `lancamentos_intermitentes` e inspecionar se as funções `get_user_role`, `current_tenant_id` e as RPCs já existem no catálogo.  
*Objetivo crítico:* Garantir que não haja trigger conflitante e comprovar se as funções auxiliares de perfil e tenant estão presentes.

```sql
-- CONSULTA 05A: Triggers ativos nas tabelas de intermitentes
SELECT 
    event_object_table AS table_name,
    trigger_name,
    action_timing,
    event_manipulation AS event,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('lancamentos_intermitentes', 'intermitentes_lotes_fechamento')
ORDER BY event_object_table, trigger_name;

-- CONSULTA 05B: Existência de funções auxiliares e RPCs da migration
SELECT 
    p.proname AS function_name,
    pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
    pg_catalog.pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS is_security_definer,
    r.rolname AS owner
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname IN (
      'fn_guard_lancamentos_intermitentes_update',
      'rpc_rh_retificar_intermitente',
      'rpc_rh_revalidar_lote_devolvido',
      'get_user_role',
      'current_tenant_id',
      'update_updated_at_column'
  )
ORDER BY p.proname;
```

### Resultado Esperado:
- 05A: Listagem de triggers existentes (ex: `update_lancamentos_intermitentes_updated_at`). Se `trg_guard_lancamentos_intermitentes` já existir, a migration utiliza `DROP TRIGGER IF EXISTS` antes de recriar.
- 05B: Deve comprovar que `get_user_role()` e `current_tenant_id()` existem no banco (funções base de governança do ORBE).

---

## CONSULTA 06 — PANORAMA DE STATUS DOS DADOS REAIS (AGREGADO)

### Finalidade:
Apresentar a distribuição quantitativa de status dos lotes e lançamentos existentes na base operacional, **sem expor nenhum dado pessoal, nome ou valor financeiro individual**.  
*Objetivo crítico:* Verificar se existem lotes atualmente no status `DEVOLVIDO` ou lançamentos aguardando saneamento.

```sql
-- CONSULTA 06A: Contagem de lotes operacionais por status
SELECT 
    status,
    COUNT(*) AS total_lotes,
    COALESCE(SUM(quantidade_registros), 0) AS total_registros_vinculados,
    COALESCE(SUM(valor_total), 0) AS soma_valor_total
FROM public.intermitentes_lotes_fechamento
GROUP BY status
ORDER BY total_lotes DESC;

-- CONSULTA 06B: Contagem de lançamentos intermitentes por status de pipeline
SELECT 
    status_pipeline,
    COUNT(*) AS total_lancamentos,
    COUNT(lote_fechamento_id) AS com_lote_vinculado,
    COUNT(*) - COUNT(lote_fechamento_id) AS sem_lote_avulsos
FROM public.lancamentos_intermitentes
GROUP BY status_pipeline
ORDER BY total_lancamentos DESC;

-- CONSULTA 06C: Lançamentos em lotes devolvidos
SELECT 
    l.status AS status_lote,
    li.status_pipeline AS status_lancamento,
    COUNT(*) AS quantidade
FROM public.lancamentos_intermitentes li
JOIN public.intermitentes_lotes_fechamento l ON l.id = li.lote_fechamento_id
WHERE l.status = 'DEVOLVIDO' OR li.status_pipeline = 'DEVOLVIDO'
GROUP BY l.status, li.status_pipeline;
```

### Resultado Esperado:
- 06A: Distribuição quantitativa de lotes (ex: quantos lotes estão em `AGUARDANDO_VALIDACAO_RH`, `APROVADO_RH`, `DEVOLVIDO`, `PAGO`).
- 06B: Quantidade de jornadas registradas em cada etapa do pipeline.
- 06C: Mapeamento da massa real que se beneficiará da retificação pelo RH.

---

## CONSULTA 07 — VÍNCULOS COM CNAB E FINANCEIRO

### Finalidade:
Verificar a estrutura de amarração bancária em `cnab_remessas_arquivos` e constatar o desacoplamento de `rh_financeiro_lotes`.  
*Objetivo crítico:* Confirmar que `cnab_remessas_arquivos` possui a coluna `intermitentes_lote_id` (utilizada na trava de salvaguarda bancária da RPC) e verificar se existem lotes de intermitentes com remessa gerada.

```sql
-- CONSULTA 07A: Estrutura da coluna de amarração bancária de intermitentes
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'cnab_remessas_arquivos'
  AND column_name = 'intermitentes_lote_id';

-- CONSULTA 07B: Contagem de remessas bancárias atreladas a lotes de intermitentes
SELECT 
    status,
    COUNT(*) AS total_remessas_intermitentes,
    COALESCE(SUM(total_registros), 0) AS total_registros_cnab,
    COALESCE(SUM(valor_total), 0) AS soma_valor_cnab
FROM public.cnab_remessas_arquivos
WHERE intermitentes_lote_id IS NOT NULL
GROUP BY status;

-- CONSULTA 07C: Confirmação da check constraint da tabela rh_financeiro_lotes
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_catalog.pg_constraint
WHERE conrelid = 'public.rh_financeiro_lotes'::regclass
  AND contype = 'c';
```

### Resultado Esperado:
- 07A: Retornar 1 linha confirmando que `intermitentes_lote_id` (uuid) existe em `cnab_remessas_arquivos`.
- 07B: Contagem agregada de remessas vinculadas (confirma que o relacionamento bancário é ativo).
- 07C: Deve comprovar que `rh_financeiro_lotes` possui a constraint restrita a CLT/Diaristas (`tipo IN ('BANCO_HORAS', 'FOLHA_VARIAVEL', 'FOLHA_BASE')`), corroborando a decisão da Etapa 05B.3 de não contaminar esta tabela com o tipo `INTERMITENTES`.

---

## CONSULTA 08 — MATRIZ CONSOLIDADA DE DEPENDÊNCIAS DA MIGRATION 05B

### Finalidade:
Executar um checklist automático de pré-requisitos para a aplicação segura da migration.  
*Objetivo crítico:* Emitir um diagnóstico `OK` ou `AUSENTE` para cada objeto que a migration manipula ou referencia.

```sql
-- CONSULTA 08: Checklist consolidado de pré-requisitos no schema
WITH checks AS (
    SELECT 'Tabela public.lancamentos_intermitentes' AS objeto, 
           EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lancamentos_intermitentes') AS status_ok
    UNION ALL
    SELECT 'Tabela public.intermitentes_lotes_fechamento', 
           EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intermitentes_lotes_fechamento')
    UNION ALL
    SELECT 'Tabela public.empresas', 
           EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'empresas')
    UNION ALL
    SELECT 'Coluna empresas.tenant_id', 
           EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'tenant_id')
    UNION ALL
    SELECT 'Tabela public.profiles', 
           EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles')
    UNION ALL
    SELECT 'Tabela public.audit_log', 
           EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log')
    UNION ALL
    SELECT 'Tabela public.cnab_remessas_arquivos', 
           EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cnab_remessas_arquivos')
    UNION ALL
    SELECT 'Função public.current_tenant_id()', 
           EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'current_tenant_id')
    UNION ALL
    SELECT 'Função public.get_user_role()', 
           EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_user_role')
)
SELECT 
    objeto,
    CASE WHEN status_ok THEN '✅ OK (Presente)' ELSE '❌ AUSENTE (Requer Atenção)' END AS diagnostico
FROM checks;
```

### Resultado Esperado:
- Todas as 9 linhas devem retornar `✅ OK (Presente)`.

---

## RECOMENDAÇÃO FINAL

1. Execute as consultas 01 a 08 no **SQL Editor** do Supabase.
2. Copie o resultado textual ou em tabela gerado pelo editor.
3. Envie os resultados para análise no chat.
4. **Nenhuma alteração ou migration deve ser executada** até que a compatibilidade dos resultados seja formalmente atestada.
