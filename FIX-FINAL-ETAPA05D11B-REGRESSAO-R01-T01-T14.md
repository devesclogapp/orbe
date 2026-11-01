# RELATÓRIO DE REGRESSÃO DA RPC CORRIGIDA (ETAPA 05D.11B)
**ERP ORBE — DOMÍNIO RH / INTERMITENTES — FIX-FINAL / ETAPA 05D.11B**  
**Data:** 12/10/2026 | **Cluster:** PostgreSQL 17.5 Isolado Local (`127.0.0.1:54322`)  
**Objeto Validado:** `public.rpc_rh_retificar_intermitente` (Versão Corrigida na Etapa 05D.11A)  
**Status do Cenário R01:** **PASS (100% HOMOLOGADO / ERRO 55000 ELIMINADO)**  
**Status dos Cenários T01 a T14:** **14/14 PASS (100% HOMOLOGADO / ZERO REGRESSÃO)**

---

## 1. PARECER EXECUTIVO DE HOMOLOGAÇÃO

A versão corrigida da procedure `public.rpc_rh_retificar_intermitente` foi submetida com sucesso à validação de regressão completa no cluster PostgreSQL 17.5 local isolado.

### Resumo dos Resultados:
- **Cenário R01 (Lançamento Sem Lote):** **PASS (`00000`)** — Erro `55000` eliminado com sucesso.
- **Bateria Canônica T01 a T14:** **14/14 PASS (100% de Aprovação)** — Zero regressão nas regras homologadas.
- **Integridade Pós-Teste:** Zero registros órfãos, consistência matemática estrita de lotes, preservação de valores financeiros e de horas, e 2 registros imutáveis gravados em `audit_log`.

---

## 2. RESULTADO DETALHADO DO CENÁRIO R01 (PROVA ANTI-ERRO 55000)

O teste R01 foi executado para atestar que a procedure não mais acessa atributos de `v_lote_atual` quando um lançamento não possui lote associado (`lote_fechamento_id IS NULL`).

### 2.1 Matriz de Resultado R01
| ID | Cenário | Estado Inicial | Resultado Esperado | Resultado Obtido | SQLSTATE | Status |
|:---:|:---|:---|:---|:---|:---:|:---:|
| **R01** | Retificação de lançamento avulso sem lote | `lote_fechamento_id IS NULL`, status `RECEBIDO`, Empresa B | Sucesso sem erro 55000, empresa alterada para A | SUCESSO (00000) | `00000` | **PASS** |

### 2.2 Evidência de Execução SQL
- **Script:** `scratch/05_test_r01_sem_lote.sql`
- **Evidência do Runner:**
  ```text
   id  |                nome                |        esperado        |     obtido      | sqlstate_obtido | status 
  -----+------------------------------------+------------------------+-----------------+-----------------+--------
   R01 | Retificação de lançamento sem lote | SUCESSO SEM ERRO 55000 | SUCESSO (00000) | 00000           | PASS
  ```
- **Evidência no Banco:** O lançamento `f000...002` teve sua empresa alterada para `e000...001` (Empresa A), manteve `lote_fechamento_id = NULL`, status `RECEBIDO`, R$ 330,00 e 10.00h preservados, gerando registro correspondente em `audit_log`. O erro `55000` foi **definitivamente eliminado**.

---

## 3. AUDITORIA DA RESTAURAÇÃO CONTROLADA DA BASE SINTÉTICA

Em conformidade com a autorização prévia, a base de testes foi restaurada para garantir o determinismo das pré-condições da bateria T01 a T14:

1. **Backup Realizado Pré-Restauração:**
   - As 6 tabelas sintéticas foram salvas em arquivos CSV em `scratch/` (`backup_tenants.csv`, `backup_empresas.csv`, `backup_colaboradores.csv`, `backup_lotes.csv`, `backup_lancamentos.csv`, `backup_audit_log.csv`).
2. **Execução da Restauração (`scratch/restore_seed_05c.sql`):**
   - Transação atômica (`BEGIN ... COMMIT`) sob `service_role`.
   - Limpeza e recarga canônica de `supabase/seed_etapa05c_homologacao.sql`:
     - 2 Tenants (`Alpha`, `Beta`)
     - 3 Empresas (`Origem A`, `Destino B`, `Outro Tenant C`)
     - 2 Colaboradores sintéticos
     - 8 Lotes operacionais
     - 1 Remessa bancária CNAB
     - 9 Lançamentos de intermitentes
3. **Auditoria de Pré-Condições Pós-Restauração:**
   - Lote 1: `DEVOLVIDO`, 2 registros, R$ 570.00.
   - Item 2: vinculado ao Lote 1, Empresa A, R$ 330.00, 10h.
   - Item 3: `RECEBIDO`, sem lote vinculado.
   - Lote 5: `DEVOLVIDO`, 1 registro, R$ 100.00.
   - RPC Corrigida: Confirmada ativa no catálogo (`pg_proc`).

---

## 4. MATRIZ DE REGRESSÃO CONSOLIDADA (T01 A T14)

A bateria oficial foi executada através de `scratch/02_test_runner_14_scenarios.sql` contra a procedure corrigida:

```text
 id  |                    nome                     |             esperado              |        obtido         | sqlstate_obtido | status 
-----+---------------------------------------------+-----------------------------------+-----------------------+-----------------+--------
 T01 | Retificação legítima pelo RH                | SUCESSO (200)                     | SUCESSO               | 00000           | PASS
 T02 | Bloqueio de Encarregado na RPC              | ERRO 42501                        | BLOQUEADO COM SUCESSO | 42501           | PASS
 T03 | Bloqueio de UPDATE direto de total/horas    | ERRO 42501                        | BLOQUEADO COM SUCESSO | 42501           | PASS
 T04 | Bloqueio de bypass via flag forjada         | ERRO 42501                        | BLOQUEADO COM SUCESSO | 42501           | PASS
 T05 | Bloqueio de empresa de outro tenant         | ERRO 23503                        | BLOQUEADO COM SUCESSO | 23503           | PASS
 T06 | Bloqueio de lote aprovado pelo RH           | ERRO 55000                        | BLOQUEADO COM SUCESSO | 55000           | PASS
 T07 | Bloqueio de lote com CNAB bancário          | ERRO 55000                        | BLOQUEADO COM SUCESSO | 55000           | PASS
 T08 | Bloqueio fail-closed de alteração de horas  | ERRO 0A000                        | BLOQUEADO COM SUCESSO | 0A000           | PASS
 T09 | Preservação de total (330.00) e horas (10h) | R$ 330,00 e 10h                   | R$ 330.00 e 10.00h    | 00000           | PASS
 T10 | Consistência do Lote 1 (1 reg, R$ 240,00)   | 1 reg, R$ 240,00                  | 1 reg, R$ 240.00      | 00000           | PASS
 T11 | Gravação compulsória em audit_log           | >= 1 registro                     | 1 registros           | 00000           | PASS
 T12 | Detecção de conflito de concorrência (OCC)  | ERRO 40001                        | BLOQUEADO COM SUCESSO | 40001           | PASS
 T13 | Fechamento operacional legítimo             | SUCESSO (EM_ANALISE_RH)           | SUCESSO               | 00000           | PASS
 T14 | Revalidação de lote devolvido pelo RH       | SUCESSO (AGUARDANDO_VALIDACAO_RH) | SUCESSO               | 00000           | PASS
(14 linhas)
```

---

## 5. AUDITORIA DE INTEGRIDADE E ESTADO FINAL DO BANCO

Após a conclusão da bateria, foram realizadas consultas de validação física:

### 5.1 Contagem Volumétrica e Ausência de Órfãos
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
 audit_log                      |     2
```
- **Órfãos Lançamento -> Empresa:** 0
- **Órfãos Lançamento -> Lote:** 0
- **Órfãos Lote -> Empresa:** 0

### 5.2 Trilha de Auditoria Gravada
Exatamente 2 registros em `public.audit_log`:
1. `RETIFICAR_INTERMITENTE_RH` para `f000...002` (T01): registrou alteração de empresa de A para B, status RECEBIDO e desvinculação do Lote 1.
2. `REVALIDAR_LOTE_DEVOLVIDO_RH` para Lote 5 (`5000...005`) (T14): registrou transição de status de `DEVOLVIDO` para `AGUARDANDO_VALIDACAO_RH`.

---

## 6. CONCLUSÃO

A correção da procedure `public.rpc_rh_retificar_intermitente` foi **100% validada e homologada**:
1. Eliminou o erro 55000 para lançamentos avulsos ou desvinculados (Cenário R01 PASS).
2. Manteve 100% de compatibilidade e aprovação em todos os 14 cenários originais de segurança, governança, OCC e consistência matemática de lotes (T01 a T14 PASS).
3. O código da migration oficial `20261012120000_etapa05b_retificacao_intermitentes_rh.sql` encontra-se corrigido, saneado e livre de vulnerabilidades de acesso a registros não atribuídos.

**Aguardando avaliação para os passos de encerramento da Etapa 05.**
