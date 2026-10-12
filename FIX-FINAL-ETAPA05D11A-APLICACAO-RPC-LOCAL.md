# RELATÓRIO DE APLICAÇÃO CONTROLADA DA RPC CORRIGIDA (ETAPA 05D.11A)
**ERP ORBE — DOMÍNIO RH / INTERMITENTES — FIX-FINAL / ETAPA 05D.11A**  
**Data:** 12/10/2026 | **Cluster:** PostgreSQL 17.5 Isolado Local (`127.0.0.1:54322`)  
**Objeto Aplicado:** `public.rpc_rh_retificar_intermitente` (Correção do Erro 55000)  
**Status da Aplicação:** **CONCLUÍDA COM SUCESSO EM TRANSAÇÃO ATÔMICA**  
**Status dos Testes:** **NÃO EXECUTADOS NESTA ETAPA (AGUARDANDO ETAPA 05D.11B)**

---

## 1. EVIDÊNCIAS DE IDENTIFICAÇÃO DO CLUSTER

A operação conectou-se com sucesso ao ambiente isolado local, confirmando os parâmetros obrigatórios:

```text
 host      | port  |    db    | usuario  |                                 version                                 
-----------+-------+----------+----------+-------------------------------------------------------------------------
 127.0.0.1 | 54322 | postgres | postgres | PostgreSQL 17.5 on x86_64-windows, compiled by msvc-19.43.34808, 64-bit
```

- **Ambiente:** Cluster isolado local exclusivo para homologação da Etapa 05D.
- **Produção / Supabase Remoto:** Zero conexões ou tráfego externo.

---

## 2. BACKUP DA DEFINIÇÃO ANTERIOR DA RPC

Antes da aplicação de qualquer alteração, a definição original da função foi extraída diretamente de `pg_proc` via `pg_get_functiondef` e salva em arquivo seguro de backup:
- **Arquivo de Backup:** `scratch/backup_rpc_rh_retificar_intermitente_prev.sql`
- **Assinatura Original:** `public.rpc_rh_retificar_intermitente(p_lancamento_id uuid, p_nova_empresa_id uuid, p_novas_horas numeric, p_justificativa text, p_updated_at timestamp with time zone)`
- **Vulnerabilidade Registrada no Backup:** Acessos diretos a `v_lote_atual.empresa_id` e `v_lote_atual.id` no Step 9, Step 10 (`audit_log`) e no retorno JSON, sem guarda segura quando `v_lote_id IS NULL`.

---

## 3. DEFINIÇÃO APLICADA DA FUNÇÃO CORRIGIDA

A instrução foi aplicada através de script isolado em transação única (`BEGIN ... COMMIT`) com a diretiva `-v ON_ERROR_STOP=1`:
- **Arquivo Aplicador:** `scratch/apply_rpc_rh_retificar_intermitente_fix.sql`

### Trecho Principal da Lógica Corrigida Aplicada:
```sql
    -- Determina com segurança se haverá desvinculação de lote (somente se houver lote vinculado e empresa diverge)
    IF v_lote_id IS NOT NULL THEN
        IF v_lote_atual.empresa_id <> p_nova_empresa_id THEN
            v_desvincular_lote := true;
        END IF;
    END IF;

    -- 9. EXECUÇÃO TRANSACIONAL DA CORREÇÃO DE EMPRESA
    IF v_desvincular_lote THEN
        -- A. Desvincula do lote da Empresa A e realoca para Empresa B
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            lote_fechamento_id = NULL,
            lote_devolvido_origem_id = v_lanc.lote_fechamento_id,
            status_pipeline = 'RECEBIDO',
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;

        -- B. Decrementa lote operacional de origem no fluxo canônico
        UPDATE public.intermitentes_lotes_fechamento
        SET
            quantidade_registros = quantidade_registros - 1,
            valor_total = valor_total - v_lanc.total,
            status = CASE WHEN (quantidade_registros - 1) <= 0 THEN 'CANCELADO' ELSE status END,
            updated_at = now()
        WHERE id = v_lote_atual.id;
    ELSE
        -- Retificação interna mantendo no lote (ou lançamento avulso sem lote)
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;
    END IF;
```

---

## 4. VALIDAÇÃO DE CATÁLOGO (`pg_proc`, `pg_roles` E PERMISSÕES)

Após a aplicação do script, o catálogo interno do PostgreSQL foi consultado para atestar os atributos da função:

```text
            proname            | prosecdef |  owner   |                                 proacl                                 | contem_desvincular_lote 
-------------------------------+-----------+----------+------------------------------------------------------------------------+-------------------------
 rpc_rh_retificar_intermitente | t         | postgres | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | t                       
```

### Verificações Concluídas:
1. **Assinatura:** `(uuid, uuid, numeric, text, timestamp with time zone) RETURNS jsonb` (Inalterada).
2. **Proprietário (`owner`):** `postgres` (Inalterado).
3. **Modo de Execução:** `SECURITY DEFINER` (`prosecdef = t`) (Inalterado).
4. **Search Path:** `'public', 'pg_temp'` (Inalterado).
5. **Permissões de Execução (`proacl`):**
   - `PUBLIC`: Revogado.
   - `anon`: Revogado.
   - `authenticated`: Permitido (`X`).
   - `service_role`: Permitido (`X`).
6. **Integridade Estrutural:** A variável `v_desvincular_lote` está presente e ativa. Todas as referências a `v_lote_atual` encontram-se rigorosamente confinadas dentro de blocos condicionais que exigem `v_lote_id IS NOT NULL`.

---

## 5. VERIFICAÇÃO DE NÃO-AFETAÇÃO DOS DEMAIS OBJETOS DO BANCO

A integridade estrutural e volumétrica do schema foi checada antes e depois da operação:

```text
      tipo      | count | Status
----------------+-------+-----------------------------
 tabelas        |     9 | Inalterado (8 domínio + 1 log)
 triggers       |     3 | Inalterado
 politicas_rls  |    16 | Inalterado
 funcoes_public |    44 | Inalterado
```

### Integridade dos Dados Sintéticos:
```text
             tabela             | count 
--------------------------------+-------
 tenants                        |     2
 empresas                       |     3
 colaboradores                  |     2
 profiles                       |     2
 intermitentes_lotes_fechamento |     8
 lancamentos_intermitentes      |     9
 cnab_remessas_arquivos         |     1
```
- **Zero registros foram alterados, inseridos ou excluídos nas tabelas de negócio.**

---

## 6. DECLARAÇÃO DE RESTRIÇÕES E PRÓXIMOS PASSOS

- **Nenhum teste foi executado:** Os testes R01, T01–T14, C01 e C02 **não foram executados** nesta etapa.
- **Nenhum comando Git de escrita foi executado.**
- A procedure corrigida está instalada no PostgreSQL local e pronta para homologação.

**Aguardando autorização expressa para avançar para a ETAPA 05D.11B — Testes de Regressão.**
