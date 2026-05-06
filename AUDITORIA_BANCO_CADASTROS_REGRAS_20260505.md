# Auditoria de Banco: Cadastros e Regras

Data: 2026-05-05

Escopo desta auditoria:
- análise estática do repositório
- revisão de migrations Supabase
- revisão dos serviços e telas que gravam regras
- foco em falhas de cadastro, principalmente regras operacionais, regras dinâmicas e banco de horas

Limitação importante:
- esta auditoria não acessou o banco Supabase em produção/homologação
- portanto, os achados abaixo mostram riscos e causas prováveis a partir do código e das migrations
- a confirmação final depende de executar as queries de verificação no banco real

## Resumo executivo

O problema mais provável não é um único bug, e sim um banco em estado intermediário de migrations:

1. As tabelas de regras passaram por várias mudanças de RLS e `tenant_id`.
2. Existem migrations antigas permissivas, depois correções parciais e depois correções "nucleares".
3. Alguns fluxos de cadastro hoje dependem de `profiles.tenant_id`; se isso estiver ausente para o usuário, o insert falha.
4. Em `fornecedor_valores_servico`, regras globais/contextuais dependem de colunas nullable e policy estrita por tenant. Se faltar qualquer uma dessas correções, o cadastro quebra.
5. A interface ainda orienta aplicar uma migration antiga, embora o estado mais recente do banco exija migrations mais novas.

## Achados críticos

### 1. Histórico de RLS conflitante nas tabelas dinâmicas de regras

Evidência:
- `supabase/migrations/20260507_regras_modulos_rls.sql` criou policies com `USING (true)` e `WITH CHECK (true)`
- `supabase/migrations/20260514f_regras_modulos_tenant_isolation.sql` trocou para `tenant_id = current_tenant_id() OR tenant_id IS NULL`
- `supabase/migrations/20260515_nuclear_regras_dados_tenant_isolation.sql` endureceu para `tenant_id = current_tenant_id()` sem `OR NULL`

Impacto:
- se o banco real parou na migration de 2026-05-14, ainda pode haver vazamento ou comportamento inconsistente
- se parte dos registros ficou com `tenant_id NULL`, o select pode funcionar num cenário e falhar em outro
- inserts podem falhar após endurecimento do RLS caso triggers ou backfill não tenham sido aplicados corretamente

Arquivos-chave:
- `supabase/migrations/20260507_regras_modulos_rls.sql`
- `supabase/migrations/20260514f_regras_modulos_tenant_isolation.sql`
- `supabase/migrations/20260515_nuclear_regras_dados_tenant_isolation.sql`

### 2. Regras operacionais dependem de colunas nullable em `fornecedor_valores_servico`

Evidência:
- a tabela nasceu com `empresa_id`, `fornecedor_id` e `tipo_servico_id` como `NOT NULL`
- depois o produto passou a aceitar regras mais globais/contextuais
- há duas migrations que removem `NOT NULL`:
  - `supabase/migrations/20260430183000_regras_operacionais_contexto_transportadora.sql`
  - `supabase/migrations/20260517_fix_fvs_nullable_columns.sql`

Impacto:
- se o banco real ainda estiver com essas colunas como `NOT NULL`, cadastros globais, contextuais ou regra de ISS podem falhar com erro de constraint
- isso bate diretamente com o sintoma relatado de não conseguir cadastrar regras

Arquivos-chave:
- `supabase/migrations/20260428173000_producao_in_loco_operacional.sql`
- `supabase/migrations/20260430183000_regras_operacionais_contexto_transportadora.sql`
- `supabase/migrations/20260517_fix_fvs_nullable_columns.sql`

### 3. `fornecedor_valores_servico` também teve múltiplas correções de tenant e policy

Evidência:
- `supabase/migrations/20260511_multitenant_correct_model.sql` adiciona `tenant_id`
- `supabase/migrations/20260512_rls_tenant_purge_final.sql` tenta consolidar RLS
- `supabase/migrations/20260514c_populate_tenant_fornecedor_valores_servico.sql` faz backfill residual
- `supabase/migrations/20260514e_nuclear_fvs_policies.sql` limpa policies conflitantes
- `supabase/migrations/20260516_fix_fvs_tenant_trigger.sql` recria trigger para autopreencher `tenant_id`

Impacto:
- se o banco real não recebeu a trigger final, inserts podem falhar por `WITH CHECK (tenant_id = current_tenant_id())`
- se recebeu policy estrita mas não recebeu backfill, registros antigos ficam invisíveis
- se restou policy antiga junto com nova, o comportamento pode parecer aleatório dependendo do comando

Arquivos-chave:
- `supabase/migrations/20260514e_nuclear_fvs_policies.sql`
- `supabase/migrations/20260516_fix_fvs_tenant_trigger.sql`
- `supabase/migrations/20260517_auditoria_fvs_estrutura.sql`

### 4. O app depende de `profiles.tenant_id` para quase todos os cadastros

Evidência:
- `src/contexts/TenantContext.tsx` lê `profiles.tenant_id` e `role`
- `src/services/base.service.ts` usa `getCurrentTenantId()` lendo `profiles`
- regras dinâmicas e vários cadastros adicionam `tenant_id` no payload a partir dessa função

Impacto:
- se o usuário autenticado não tiver registro válido em `profiles`, o sistema falha antes do insert
- nesse caso o sintoma costuma aparecer como erro genérico de cadastro, mesmo com a tela aparentemente correta

Arquivos-chave:
- `src/contexts/TenantContext.tsx`
- `src/services/base.service.ts`
- `supabase/migrations/20260505000000_tenants_multitenant.sql`
- `supabase/migrations/20260512_rls_tenant_purge_final.sql`

### 5. A tela de regras operacionais aponta para uma migration desatualizada

Evidência:
- em `src/pages/RegrasOperacionais.tsx`, o tratamento de erro sugere aplicar `20260430183000_regras_operacionais_contexto_transportadora.sql`
- porém o histórico mais recente adiciona uma nova correção explícita em `20260517_fix_fvs_nullable_columns.sql`

Impacto:
- o time pode aplicar apenas a migration antiga e acreditar que o problema foi resolvido
- isso aumenta a chance de o banco continuar divergente do estado esperado pelo código atual

Arquivo-chave:
- `src/pages/RegrasOperacionais.tsx`

### 6. `regras_financeiras` ainda está com RLS totalmente aberto

Evidência:
- `supabase/migrations/20260505_regras_financeiras_nova_tabela.sql` cria policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)`

Impacto:
- isso não explica diretamente falha de cadastro
- mas é uma inconsistência séria de isolamento multi-tenant
- pode gerar leitura/gravação cruzada entre tenants em regras financeiras

Arquivo-chave:
- `supabase/migrations/20260505_regras_financeiras_nova_tabela.sql`

### 7. Tabelas auxiliares de regras também passaram por correções residuais tardias

Evidência:
- `supabase/migrations/20260516_auditoria_residual_tenant_fix.sql` corrige:
  - `tipos_servico_operacional`
  - `formas_pagamento_operacional`
  - `tipos_regra_operacional`
  - `regras_marcacao_diaristas`

Impacto:
- se essas tabelas ainda estiverem com policy permissiva ou `tenant_id NULL`, os combos podem carregar de forma errada
- isso afeta cadastro de regra mesmo quando o erro não está na tabela final

Arquivo-chave:
- `supabase/migrations/20260516_auditoria_residual_tenant_fix.sql`

## Módulos com maior risco de falha

### Regras operacionais

Maior risco atual.

Dependências para funcionar:
- `profiles.tenant_id` válido
- `fornecedor_valores_servico.tenant_id` preenchido
- policy única e estrita por tenant
- trigger de auto preenchimento de tenant
- colunas `empresa_id`, `fornecedor_id`, `tipo_servico_id` aceitando `NULL` quando o fluxo é global/contextual

### Regras dinâmicas

Risco alto.

Dependências para funcionar:
- `regras_modulos`, `regras_campos`, `regras_dados` com `tenant_id`
- sem policies antigas `USING (true)`
- sem registros residuais com `tenant_id NULL`

### Banco de horas

Risco médio para alto.

Dependências para funcionar:
- `banco_horas_regras.tenant_id`
- trigger `trg_auto_tenant_bh_regras`
- confirmar se cadastro global com `empresa_id NULL` é aceito pela estrutura real da tabela

## Checklist de validação no banco real

Rodar no Supabase SQL Editor, nesta ordem:

1. Validar se o usuário afetado tem tenant:

```sql
select user_id, tenant_id, role, full_name
from public.profiles
where user_id = auth.uid();
```

2. Verificar policies ativas em `fornecedor_valores_servico`:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'fornecedor_valores_servico'
order by policyname;
```

Esperado:
- apenas policy baseada em `tenant_id = public.current_tenant_id()`

3. Verificar trigger de tenant em `fornecedor_valores_servico`:

```sql
select tgname
from pg_trigger
where tgrelid = 'public.fornecedor_valores_servico'::regclass
  and not tgisinternal;
```

4. Confirmar nullability das colunas críticas:

```sql
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'fornecedor_valores_servico'
  and column_name in ('empresa_id', 'fornecedor_id', 'tipo_servico_id', 'tenant_id');
```

Esperado:
- `empresa_id`, `fornecedor_id`, `tipo_servico_id` como `YES`
- `tenant_id` existente

5. Medir resíduos sem tenant em FVS:

```sql
select
  count(*) as total,
  count(*) filter (where tenant_id is null) as sem_tenant
from public.fornecedor_valores_servico;
```

6. Verificar policies das tabelas dinâmicas:

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('regras_modulos', 'regras_campos', 'regras_dados')
order by tablename, policyname;
```

Esperado:
- sem `USING (true)`
- sem `OR tenant_id IS NULL`

7. Medir resíduos sem tenant nas regras dinâmicas:

```sql
select 'regras_modulos' as tabela, count(*) filter (where tenant_id is null) as sem_tenant, count(*) as total from public.regras_modulos
union all
select 'regras_campos', count(*) filter (where tenant_id is null), count(*) from public.regras_campos
union all
select 'regras_dados', count(*) filter (where tenant_id is null), count(*) from public.regras_dados;
```

8. Verificar catálogos auxiliares:

```sql
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tipos_servico_operacional',
    'formas_pagamento_operacional',
    'tipos_regra_operacional',
    'regras_marcacao_diaristas',
    'banco_horas_regras'
  )
order by tablename, policyname;
```

## Hipótese principal para o teu sintoma

Se hoje você não consegue cadastrar regras, a ordem de probabilidade é:

1. usuário atual sem `profiles.tenant_id` válido
2. banco real sem a correção de nullability em `fornecedor_valores_servico`
3. policy estrita aplicada sem trigger/backfill correspondente
4. tabelas dinâmicas de regras com mistura de policies antigas e novas
5. catálogos auxiliares de lookup sem isolamento consistente

## Sequência de correção recomendada

1. Confirmar `profiles.tenant_id` do usuário que está falhando.
2. Auditar `fornecedor_valores_servico` com as queries acima.
3. Confirmar que a migration `20260517_fix_fvs_nullable_columns.sql` está refletida no banco.
4. Confirmar que a migration `20260516_fix_fvs_tenant_trigger.sql` está refletida no banco.
5. Auditar `regras_modulos`, `regras_campos` e `regras_dados`.
6. Auditar `tipos_servico_operacional`, `formas_pagamento_operacional` e `tipos_regra_operacional`.
7. Só depois revisar erros de frontend remanescentes.

## Conclusão

O projeto mostra um padrão claro: a maior fonte de inconsistência está na transição para multi-tenant. O sintoma de "não consigo cadastrar regras" é compatível com:
- `tenant_id` ausente no usuário ou nos registros
- RLS endurecida sem trigger/backfill completo
- divergência entre a estrutura esperada pela tela e a estrutura real da tabela `fornecedor_valores_servico`

Antes de mexer no frontend, a prioridade deve ser confirmar o estado real dessas migrations no Supabase.
