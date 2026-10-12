# RELATÓRIO TÉCNICO: RESULTADOS DOS 14 CENÁRIOS DE HOMOLOGAÇÃO (ETAPA 05D.5C)
**ERP ORBE — DOMÍNIO RH / INTERMITENTES — FIX-FINAL / ETAPA 05D.5C**  
**Data:** 12/10/2026 | **Cluster:** PostgreSQL 17.5 Nativo Isolado (`127.0.0.1:54322`)  
**Base de Testes:** Base Sintética Isolada (`seed_etapa05c_homologacao.sql`)  
**Objeto Testado:** Migration Oficial `20261012120000_etapa05b_retificacao_intermitentes_rh.sql`

---

## 1. RESUMO EXECUTIVO E PARECER TÉCNICO

A bateria de testes automatizados com os **14 Cenários Formais de Homologação (T01 a T14)** foi executada de forma determinística e controlada no cluster PostgreSQL 17.5 local isolado.

Todos os 14 cenários foram validados contra as funções, triggers guardiões e políticas de segurança da Migration 05B:
- **14 Cenários Executados**
- **14 PASS (100% de Aprovação)**
- **0 FAIL**
- **0 INCONCLUSIVO**

### PARECER OBJETIVO: **APROVADO COM RESSALVAS**

> **Justificativa do Parecer:**  
> O motor relacional, os triggers guardiões anti-bypass, a governança transacional, o bloqueio de papéis não autorizados, a integridade matemática de lotes e a auditoria imutável comportaram-se estritamente conforme especificado no PostgreSQL. A ressalva decorre do fato de que a concorrência OCC (T12) foi validada por simulação sequencial determinística (timestamp defasado) em vez de disputa multi-transacional concorrente em tempo real, e a segurança foi validada no motor PostgreSQL, restando a homologação final pela camada HTTP/PostgREST do Supabase em fase posterior.

---

## 2. MATRIZ CONSOLIDADA DOS 14 CENÁRIOS (T01 A T14)

| ID | Cenário / Regra Validada | Comportamento Esperado | Resultado Obtido | SQLSTATE | Status |
|:---|:---|:---|:---|:---:|:---:|
| **T01** | Retificação legítima de empresa pelo RH via RPC oficial | Sucesso (200), desvincula lote, atualiza empresa, grava log | SUCESSO | `00000` | **PASS** |
| **T02** | Encarregado tenta invocar RPC de retificação | Bloqueio por falta de privilégio (`ROLE_NOT_AUTHORIZED`) | BLOQUEADO COM SUCESSO | `42501` | **PASS** |
| **T03** | Mutação direta de total financeiro / horas via SQL direto | Bloqueio anti-bypass pelo trigger guardião | BLOQUEADO COM SUCESSO | `42501` | **PASS** |
| **T04** | Tentativa de bypass direto com flag transacional forjada | Bloqueio: trigger valida stack PL/pgSQL unforgeable | BLOQUEADO COM SUCESSO | `42501` | **PASS** |
| **T05** | RPC com empresa pertencente a outro tenant | Bloqueio de isolamento multi-tenant / integridade | BLOQUEADO COM SUCESSO | `23503` | **PASS** |
| **T06** | Lote aprovado pelo RH não permite retificação | Bloqueio por estado imutável do ciclo operacional | BLOQUEADO COM SUCESSO | `55000` | **PASS** |
| **T07** | Lote com remessa CNAB gerada não permite retificação | Bloqueio estrito por existência de vínculo bancário | BLOQUEADO COM SUCESSO | `55000` | **PASS** |
| **T08** | Alteração arbitrária de horas no lançamento | Bloqueio fail-closed (`OPERACAO_BLOQUEADA`) | BLOQUEADO COM SUCESSO | `0A000` | **PASS** |
| **T09** | Preservação do valor financeiro (R$ 330,00) e horas (10h) | Lançamento preserva valores operacionais intactos | R$ 330.00 e 10.00h | `00000` | **PASS** |
| **T10** | Consistência matemática do Lote 1 após retificação | Lote decrementa 1 item e subtrai R$ 330 (fica R$ 240,00) | 1 reg, R$ 240.00 | `00000` | **PASS** |
| **T11** | Gravação compulsória em `audit_log` | Trilha imutável registra valores antes e depois | 1 registros | `00000` | **PASS** |
| **T12** | Detecção de conflito de concorrência otimista (OCC) | Bloqueio ao receber timestamp defasado de `updated_at` | BLOQUEADO COM SUCESSO | `40001` | **PASS** |
| **T13** | Fechamento operacional legítimo (vinculação inicial) | Transição permitida de `RECEBIDO` para `EM_ANALISE_RH` | SUCESSO | `00000` | **PASS** |
| **T14** | Revalidação de lote devolvido pelo RH via RPC oficial | Transição de lote de `DEVOLVIDO` para `AGUARDANDO_VALIDACAO_RH` | SUCESSO | `00000` | **PASS** |

---

## 3. EVIDÊNCIAS DETALHADAS POR CENÁRIO

### Cenário T01 — Retificação Legítima de Empresa pelo RH via RPC Oficial
- **Operação Executada:**  
  ```sql
  PERFORM public.orbe_test_set_actor('90000000-0000-0000-0000-000000000001', 'rh', 'a0000000-0000-0000-0000-000000000001');
  v_res := public.rpc_rh_retificar_intermitente(
      'f0000000-0000-0000-0000-000000000002',
      'e0000000-0000-0000-0000-000000000002',
      NULL,
      'Retificação formal de alocação de empresa executada pelo RH para testes'
  );
  ```
- **Evidência Registrada:**  
  - Lançamento `f000...002` teve a empresa alterada de `e000...001` para `e000...002`.
  - Vínculo com Lote 1 foi desfeito (`lote_fechamento_id = NULL`).
  - Status retrocedeu de `EM_ANALISE_RH` para `RECEBIDO`.
  - Proveniência preservada em `lote_devolvido_origem_id = 1000...001`.
  - Retorno HTTP/JSON: `{"sucesso": true, "codigo": "RETIFICACAO_CONCLUIDA", ...}`.
- **SQLSTATE:** `00000` | **Status:** `PASS`.

---

### Cenário T02 — Bloqueio de Invocação da RPC por Usuário Encarregado
- **Operação Executada:**  
  Ator configurado como `encarregado` (`9000...002`) tentando invocar `rpc_rh_retificar_intermitente`.
- **Evidência Registrada:**  
  - Exceção levantada: `ROLE_NOT_AUTHORIZED: Apenas usuários do perfil RH ou Administrador podem retificar lançamentos.`
  - SQLSTATE: `42501` (Insufficient Privilege).
  - Nenhuma alteração foi persistida.
- **Status:** `PASS`.

---

### Cenários T03 e T04 — Blindagem Anti-Bypass e Validação de Stack Unforgeable
- **T03 (Tentativa de UPDATE direto de total/horas):**  
  ```sql
  UPDATE public.lancamentos_intermitentes SET total = 999.00 WHERE id = 'f000...001';
  ```
  - Exceção levantada pelo trigger `trg_guard_lancamentos_intermitentes`:  
    `MUTACAO_PROIBIDA: Valores financeiros e horas apuradas de intermitentes são imutáveis via API client.`
  - SQLSTATE: `42501`.
- **T04 (Tentativa de bypass forjando flag de sessão `orbe.in_rpc_retificacao = true`):**  
  ```sql
  PERFORM set_config('orbe.in_rpc_retificacao', 'true', true);
  UPDATE public.lancamentos_intermitentes SET empresa_id = 'e000...002' WHERE id = 'f000...001';
  ```
  - O trigger inspecionou `PG_CONTEXT` dinamicamente: como a pilha não continha a chamada nativa de `rpc_rh_retificar_intermitente`, a flag foi ignorada e a mutação bloqueada com `VINCULO_PROTEGIDO`.
  - SQLSTATE: `42501`.
- **Status:** `PASS`.

---

### Cenários T05, T06 e T07 — Regras de Governança de Tenant e Ciclo Operacional
- **T05 (Empresa de outro Tenant):**  
  Invocação passando `e000...099` (Tenant B) enquanto ator está no Tenant A.  
  - Exceção: `EMPRESA_NOT_FOUND: Empresa informada não pertence ao mesmo tenant do lançamento.`  
  - SQLSTATE: `23503` (Integrity Constraint / FK).
- **T06 (Lote Aprovado pelo RH):**  
  Invocação para lançamento em lote com status `APROVADO_RH`.  
  - Exceção: `ESTADO_INVALIDO: O lote vinculado já foi aprovado pelo RH ou despachado ao financeiro...`  
  - SQLSTATE: `55000` (Object Not In Prerequisite State).
- **T07 (Lote com CNAB Bancário Gerado):**  
  Invocação para lançamento cujo lote possui registro em `cnab_remessas_arquivos`.  
  - Exceção: `VINCULO_BANCARIO: Não é permitido retificar lançamento cujo lote já possui remessa CNAB gerada...`  
  - SQLSTATE: `55000`.
- **Status:** `PASS`.

---

### Cenário T08 — Bloqueio Fail-Closed na Alteração de Horas
- **Operação Executada:**  
  Tentativa de passar `p_novas_horas = 12.50` na RPC.
- **Evidência Registrada:**  
  - Exceção: `OPERACAO_BLOQUEADA: A retificação de horas trabalhadas de intermitentes está desabilitada nesta versão...`
  - SQLSTATE: `0A000` (Feature Not Supported).
  - Garante comportamento fail-closed absoluto sem mutações silenciosas de horas.
- **Status:** `PASS`.

---

### Cenários T09 e T10 — Integridade Matemática e Preservação de Valores
- **T09 (Valores do Lançamento Retificado):**  
  Consulta ao registro `f000...002`:
  - `total`: **R$ 330.00** (intacto).
  - `horas_trabalhadas`: **10.00h** (intacto).
- **T10 (Consistência do Lote de Origem):**  
  O Lote 1 possuía 2 registros e valor total de R$ 570,00 (Item 1 = R$ 240 + Item 2 = R$ 330).
  Após o T01 desvincular o Item 2:
  - `quantidade_registros`: **1**
  - `valor_total`: **R$ 240.00**
  - Nenhuma perda de centavos ou inconsistência de cardinalidade.
- **Status:** `PASS`.

---

### Cenário T11 — Auditoria Compulsoriamente Registrada
- **Consulta Realizada em `audit_log`:**  
  ```sql
  SELECT id, acao, entidade, registro_id, usuario_id,
         valor_anterior->>'empresa_id' as emp_ant,
         valor_novo->>'empresa_id' as emp_nova,
         valor_novo->>'status_pipeline' as status_novo,
         descricao, criado_em
  FROM public.audit_log;
  ```
- **Resultado:**
  - Registro 1: Ação `RETIFICAR_INTERMITENTE_RH` para `f000...002`, gravando `emp_ant: e000...001` -> `emp_nova: e000...002`, `status_novo: RECEBIDO`, justificativa formal preservada.
  - Registro 2: Ação `REVALIDAR_LOTE_DEVOLVIDO_RH` para Lote `5000...005`.
- **Status:** `PASS`.

---

### Cenário T12 — Detecção de Conflito de Concorrência Otimista (OCC)
- **Operação Executada:**  
  Chamada da RPC passando `p_updated_at = now() - interval '1 day'`, simulando uma tentativa de alteração concorrente por usuário com tela desatualizada.
- **Evidência Registrada:**  
  - Exceção: `CONCORRENCIA: O lançamento foi alterado por outro usuário ou processo. Atualize a tela antes de tentar novamente.`
  - SQLSTATE: `40001` (Transaction Rollback / Serialization Failure).
- **Declaração Expressa de Limitação Técnica:**  
  *Este teste validou a regra de bloqueio lógico de OCC via validação de carimbo de data/hora defasado. Não representou duas transações PostgreSQL concorrentes disparadas em paralelo em conexões físicas separadas.*
- **Status:** `PASS`.

---

### Cenários T13 e T14 — Fluxos Operacionais Legítimos e Revalidação de Lote
- **T13 (Fechamento Operacional):**  
  Lançamento `f000...003` (aberto, `RECEBIDO`) vinculado legitimamente ao Lote 4 (`AGUARDANDO_VALIDACAO_RH`), transitando para `EM_ANALISE_RH`.
  - Trigger permitiu o fechamento sem exceções (`00000`).
- **T14 (Revalidação de Lote Devolvido):**  
  Lote 5 (`5000...005`), que estava em status `DEVOLVIDO`, foi submetido à `rpc_rh_revalidar_lote_devolvido` pelo RH.
  - Status transitou com sucesso para `AGUARDANDO_VALIDACAO_RH`.
  - Trilha gravada em `audit_log`.
- **Status:** `PASS`.

---

## 4. INTEGRIDADE DOS DADOS APÓS OS TESTES

Auditoria completa de contagens e integridade referencial executada após a finalização da bateria:

| Tabela | Contagem Pré-Runner | Contagem Pós-Runner | Variação Líquida |
|:---|:---:|:---:|:---:|
| `tenants` | 2 | 2 | 0 |
| `empresas` | 3 | 3 | 0 |
| `colaboradores` | 2 | 2 | 0 |
| `profiles` | 2 | 2 | 0 |
| `intermitentes_lotes_fechamento` | 8 | 8 | 0 |
| `lancamentos_intermitentes` | 9 | 9 | 0 |
| `cnab_remessas_arquivos` | 1 | 1 | 0 |
| `audit_log` | 0 | 2 | +2 (esperado: T01 e T14) |

### Auditoria de Registros Órfãos / Foreign Keys:
- Órfãos Lançamento -> Empresa: **0**
- Órfãos Lançamento -> Lote: **0**
- Órfãos Lote -> Empresa: **0**

---

## 5. DISTINÇÃO ENTRE SEGURANÇA POSTGRESQL E API SUPABASE

É mandatório explicitar a fronteira de garantias obtida nesta homologação:

1. **Garantias Validadas Diretamente no PostgreSQL (Engine Level):**
   - Imutabilidade física de colunas financeiras e horas trabalhadas via trigger guardião.
   - Bloqueio por stack de execução PL/pgSQL unforgeable contra tentativas de forjar flags de sessão.
   - Restrição estrita de papéis (`rh` e `admin`) dentro de stored procedures com `SECURITY DEFINER`.
   - Isolamento multi-tenant relacional por foreign keys e checks explícitos.
   - Integridade transacional atômica (decremento de lote + desvinculação + log).

2. **Garantias Pendentes de Homologação na Camada Supabase / PostgREST (API Level):**
   - Headers HTTP `apikey`, `Authorization: Bearer <JWT>` e resolução de `auth.uid()` / `auth.role()` gerados pelo Supabase Auth.
   - Headers PostgREST `Prefer: return=minimal` ou `return=representation` nas chamadas RPC client.
   - Validação de RLS de visualização da UI (select queries) via cliente web React / TanStack Query.
   - Concorrência real de múltiplos clientes navegadores enviando mutations simultâneas.

---

## 6. CONCLUSÃO E PRÓXIMOS PASSOS

A Migration 05B (`20261012120000_etapa05b_retificacao_intermitentes_rh.sql`) cumpriu 100% dos requisitos de governança, blindagem anti-bypass e integridade transacional na base relacional do PostgreSQL 17.5.

**Nenhuma alteração foi realizada em arquivos versionados do repositório.**  
**Nenhuma conexão foi realizada ao banco remoto/produção.**

O ambiente local isolado e a base de testes permanecem disponíveis e prontos para as deliberações de encerramento da Etapa 05.
