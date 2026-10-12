# DIAGNÓSTICO TÉCNICO E PROPOSTA DE CORREÇÃO DO ERRO 55000 (ETAPA 05D.9)
**ERP ORBE — DOMÍNIO RH / INTERMITENTES — FIX-FINAL / ETAPA 05D.9**  
**Data:** 12/10/2026 | **Ambiente:** Cluster PostgreSQL 17.5 Isolado Local (`127.0.0.1:54322`)  
**Objeto Investigado:** Função `public.rpc_rh_retificar_intermitente`  
**Origem do Erro:** Teste C01 (Concorrência Real)  
**Status:** DIAGNÓSTICO CONCLUÍDO / PROPOSTA PREPARADA (AGUARDANDO AUTORIZAÇÃO PARA IMPLEMENTAÇÃO)

---

## 1. RESUMO EXECUTIVO DO PROBLEMA

Durante a execução do teste de concorrência real (C01), a Sessão 1 retificou o lançamento `f000...006`, desvinculando-o com sucesso do Lote 5 (`lote_fechamento_id` tornou-se `NULL`).

Quando a Sessão 2 tentou executar a procedure `rpc_rh_retificar_intermitente` sobre esse mesmo lançamento, o motor PL/pgSQL abortou com o erro:
```text
SQLSTATE: 55000 (object_not_in_prerequisite_state)
MENSAGEM: record "v_lote_atual" is not assigned yet
```

O comportamento esperado para um cliente que tenta operar sobre um registro já alterado é a rejeição por **Concorrência Otimista (OCC)** com **SQLSTATE 40001**. A ocorrência do erro `55000` evidenciou um defeito na procedure: a tentativa de leitura de campos de uma variável do tipo `RECORD` não inicializada quando o lançamento alvo não possui lote vinculado (`lote_fechamento_id IS NULL`).

---

## 2. INVESTIGAÇÃO DA CAUSA RAIZ

### 2.1 O Ciclo de Vida da Variável `v_lote_atual`
Na função `rpc_rh_retificar_intermitente` (migration `20261012120000_etapa05b_retificacao_intermitentes_rh.sql`):
1. **Declaração (Linha 259):**
   ```sql
   v_lote_atual RECORD;
   v_lote_id UUID;
   ```
   No PL/pgSQL do PostgreSQL, variáveis do tipo `RECORD` são estruturas genéricas não tipadas que permanecem sem definição de campos até que recebam uma linha via `SELECT ... INTO v_lote_atual`.

2. **Atribuição Condicional (Linhas 308–314):**
   ```sql
   IF v_lote_id IS NOT NULL THEN
       SELECT * INTO v_lote_atual
       FROM public.intermitentes_lotes_fechamento
       WHERE id = v_lote_id AND tenant_id = v_tenant_id
       FOR UPDATE;
       ...
   END IF;
   ```
   Se o lançamento não possuir lote vinculado (`v_lote_id IS NULL`), o bloco `IF` é ignorado.  
   **Consequência:** A variável `v_lote_atual` **nunca é atribuída**.

3. **Acesso Indevido a Campos de RECORD Não Atribuído:**
   Mais adiante na procedure, ocorrem quatro acessos diretos a `v_lote_atual.empresa_id` e `v_lote_atual.id`:
   - **Linha 363 (Condição de Mutação):**
     ```sql
     IF v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN
     ```
   - **Linha 382 (Cláusula WHERE do UPDATE do Lote):**
     ```sql
     WHERE id = v_lote_atual.id;
     ```
   - **Linhas 421–422 (Expressões CASE no INSERT em `audit_log`):**
     ```sql
     'lote_fechamento_id', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN NULL ELSE v_lanc.lote_fechamento_id END,
     'status_pipeline', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN 'RECEBIDO' ELSE v_lanc.status_pipeline END
     ```
   - **Linha 433 (Expressão no JSON de Retorno):**
     ```sql
     'desvinculado_por_empresa_divergente', (v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id)
     ```

### 2.2 Por que a Condição `v_lote_id IS NOT NULL AND ...` não evitou o Erro?
Em expressões SQL executadas dentro do PL/pgSQL (como a instrução `INSERT INTO public.audit_log VALUES (..., jsonb_build_object(...))` e a instrução `RETURN jsonb_build_object(...)`), os argumentos são avaliados pelo motor de execução SQL do PostgreSQL.

Ao resolver os identificadores de colunas e variáveis compostas nos argumentos da função `jsonb_build_object`, o PostgreSQL tenta inspecionar os atributos do registro `v_lote_atual`. Como `v_lote_atual` é um `RECORD` não inicializado, o motor interrompe imediatamente a execução antes de resolver o resultado booleano da expressão, disparando:
`ERROR: record "v_lote_atual" is not assigned yet (SQLSTATE 55000)`.

### 2.3 Cenários em que `v_lote_id` é NULL
1. **Lançamento Avulso Inicial:** Qualquer lançamento criado no status inicial `RECEBIDO` que ainda não foi agrupado em nenhum lote de fechamento.
2. **Lançamento Anteriormente Desvinculado:** Lançamentos desvinculados por retificação anterior que precisam ter sua empresa ajustada novamente.
3. **Corrida Concorrente (Caso do Teste C01):** Uma primeira sessão retifica e desvincula o lançamento; uma segunda sessão, ao tentar retificar o mesmo registro, encontra `lote_fechamento_id = NULL`.

---

## 3. AVALIAÇÃO DA ORDEM DAS VALIDAÇÕES (OCC, TENANT E LOCKS)

A ordem lógica atual da procedure é:
1. Validação de autenticação e papel (`rh` / `admin`).
2. Validação de formato da entrada (empresa, justificativa >= 10 chars).
3. Validação de existência da empresa de destino no mesmo tenant.
4. Peek no lançamento para identificar `lote_fechamento_id`.
5. Locks pessimistas determinísticos:
   - Lock no Lote Pai (`SELECT ... FOR UPDATE`), se `v_lote_id IS NOT NULL`.
   - Lock no Lançamento Filho (`SELECT ... FOR UPDATE`).
6. **Validação OCC:**  
   `IF p_updated_at IS NOT NULL AND v_lanc.updated_at IS DISTINCT FROM p_updated_at THEN RAISE EXCEPTION ... ERRCODE = '40001';`
7. Validação de status permitido do lançamento (`RECEBIDO`, `EM_ANALISE_RH`, `DEVOLVIDO`).
8. Validação fail-closed de horas.
9. Mutação de dados.
10. Gravação em `audit_log` e retorno.

### Conclusão sobre a Ordem das Validações:
- A verificação de OCC **já se encontra posicionada imediatamente após a aquisição do lock no lançamento (`v_lanc`)**.
- Essa posição é arquiteturalmente correta, pois a comparação de versão só pode ocorrer de forma atômica após o lock pessimista garantir que nenhuma outra transação altere `updated_at` simultaneamente.
- **Por que a Sessão 2 no teste C01 não disparou OCC 40001?**  
  Na execução registrada, a Sessão 2 iniciou milissegundos após o término da Sessão 1 e obteve o carimbo que a Sessão 1 acabara de gravar. Por isso, a validação de OCC foi considerada satisfeita (`p_updated_at = v_lanc.updated_at`) e a execução avançou para a etapa de mutação e auditoria, onde colidiu com o acesso a `v_lote_atual`.
- Se a Sessão 2 tivesse enviado o timestamp pré-Sessão 1, o OCC teria bloqueado com 40001 na Linha 342. Porém, **qualquer lançamento legítimo avulso (sem lote) chamando a procedure crasharia no erro 55000**.

---

## 4. PROPOSTA MÍNIMA E SEGURA DE CORREÇÃO

### 4.1 Princípio da Solução
Eliminar completamente qualquer referência a atributos de `v_lote_atual` fora do bloco protegido `IF v_lote_id IS NOT NULL`.

Para isso, introduz-se uma variável booleana de controle:
```sql
v_desvincular_lote BOOLEAN := false;
```

Essa variável é avaliada e definida **exclusivamente** quando `v_lote_id IS NOT NULL`:
```sql
IF v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN
    v_desvincular_lote := true;
END IF;
```

Nas etapas subsequentes (mutação, gravação de auditoria e retorno JSON), substitui-se a expressão vulnerável `(v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id)` pela variável booleana `v_desvincular_lote`.

---

### 4.2 Comparativo Antes vs Depois (Trechos Exatos)

#### Trecho 1: Declaração de Variáveis (Linhas 258–261)
```diff
 DECLARE
     v_user_id UUID;
     v_tenant_id UUID;
     v_role TEXT;
     v_user_nome TEXT;
     v_lanc RECORD;
     v_lote_atual RECORD;
     v_lote_id UUID;
     v_cnab_count INTEGER;
+    v_desvincular_lote BOOLEAN := false;
 BEGIN
```

#### Trecho 2: Determinação da Necessidade de Desvinculação (Linhas 360–365)
```diff
     -- Ativa flag transacional local para passar pelo trigger guardião
     PERFORM set_config('orbe.in_rpc_retificacao', 'true', true);
 
+    -- Determina se há desvinculação de lote (somente quando há lote vinculado e empresa diverge)
+    IF v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN
+        v_desvincular_lote := true;
+    END IF;
+
     -- 9. EXECUÇÃO TRANSACIONAL DA CORREÇÃO DE EMPRESA
-    IF v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN
+    IF v_desvincular_lote THEN
         -- A. Desvincula do lote da Empresa A e realoca para Empresa B
         UPDATE public.lancamentos_intermitentes
```

#### Trecho 3: Gravação em `audit_log` (Linhas 420–424)
```diff
         jsonb_build_object(
             'empresa_id', p_nova_empresa_id,
             'horas_trabalhadas', v_lanc.horas_trabalhadas,
             'total', v_lanc.total,
-            'lote_fechamento_id', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN NULL ELSE v_lanc.lote_fechamento_id END,
-            'status_pipeline', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN 'RECEBIDO' ELSE v_lanc.status_pipeline END
+            'lote_fechamento_id', CASE WHEN v_desvincular_lote THEN NULL ELSE v_lanc.lote_fechamento_id END,
+            'status_pipeline', CASE WHEN v_desvincular_lote THEN 'RECEBIDO' ELSE v_lanc.status_pipeline END
         ),
         'RPC_RH_RETIFICAR_INTERMITENTE'
```

#### Trecho 4: JSON de Retorno (Linhas 431–435)
```diff
         'total', v_lanc.total,
         'lote_anterior_id', v_lote_id,
-        'desvinculado_por_empresa_divergente', (v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id)
+        'desvinculado_por_empresa_divergente', v_desvincular_lote
     );
```

---

## 5. AVALIAÇÃO DE OUTRAS FUNÇÕES DA MIGRATION 05B

Foi realizada varredura completa nas demais funções e triggers da migration:
1. **`fn_guard_lancamentos_intermitentes_update`:** Utiliza exclusivamente variáveis escalares `v_stack TEXT`, `NEW` e `OLD`. Não possui variáveis `RECORD` genéricas.
2. **`fn_guard_lancamentos_intermitentes_delete`:** Sem variáveis `RECORD` genéricas.
3. **`fn_guard_intermitentes_lotes_delete`:** Sem variáveis `RECORD` genéricas.
4. **`rpc_rh_revalidar_lote_devolvido`:** Possui `v_lote RECORD`, porém a atribuição via `SELECT * INTO v_lote ...` é incondicional no início da função. Se o registro não for encontrado, a função aborta imediatamente com `P0002` antes de qualquer acesso a campos de `v_lote`. Não há risco de `55000`.

**Conclusão:** O problema restringe-se pontualmente a `rpc_rh_retificar_intermitente`.

---

## 6. ANÁLISE DE RISCOS E IMPACTOS

| Dimensão | Avaliação | Mitigação / Evidência |
|:---|:---:|:---|
| **Impacto em Contratos de API** | **ZERO** | A assinatura, parâmetros, tipos de retorno e estrutura JSON da RPC permanecem rigorosamente idênticos. |
| **Impacto no Frontend** | **ZERO** | Nenhuma alteração de chaves JSON retornadas (`success`, `id`, `empresa_id`, `total`, `desvinculado_por_empresa_divergente`). |
| **Impacto em Outros Módulos** | **ZERO** | A função atua exclusivamente no domínio de intermitentes do RH. |
| **Risco de Regressão** | **MUITO BAIXO** | Apenas simplifica o acesso condicional a uma variável booleana pré-calculada, eliminando a avaliação insegura de `v_lote_atual`. |

---

## 7. PLANO DE TESTES DE REGRESSÃO

Após a autorização e aplicação da correção pontual no cluster local de homologação, serão executados:

1. **Cenário de Teste Dedicado R01 (Lançamento Sem Lote):**
   - Retificar empresa de lançamento avulso no status `RECEBIDO` (`lote_fechamento_id IS NULL`).
   - Critério de Aceite: Sucesso (`00000`), empresa alterada, `audit_log` registrado, `desvinculado_por_empresa_divergente = false`, **sem erro 55000**.
2. **Revalidação da Bateria T01 a T14:**
   - Garantir que todos os 14 cenários anteriores continuam com status **PASS**.
3. **Reexecução do Teste C01 (Concorrência Real):**
   - Executar Sessão 1 e Sessão 2 com sincronização rigorosa de timestamp, validando o bloqueio por OCC com SQLSTATE `40001`.
4. **Execução do Teste C02 (Permissões e RLS Não Privilegiadas):**
   - Concluir a homologação com conexão não-superuser.

---

**Nenhuma alteração foi realizada em arquivos do repositório ou no banco de dados.**  
Aguardando autorização expressa para proceder com a aplicação controlada da correção proposta.
