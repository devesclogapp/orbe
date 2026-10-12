# ERP ORBE — FIX-FINAL / ETAPA 05B.3
# Saneamento Local da Migration de Retificação RH

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Concluído com Sucesso (100% Local — Zero impacto no banco remoto)  
> **Arquivo Alvo:** [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql)  

---

## 1. OBJETIVO DA ETAPA

Sanear e blindar localmente a migration de retificação de intermitentes pelo RH, corrigindo todos os apontamentos identificados na auditoria pré-migration (Etapa 05B.2):
1. **P1 — Incompatibilidade Financeira:** Eliminar referências e operações em `rh_financeiro_lotes` e `rh_financeiro_lote_itens` incompatíveis com as constraints reais do schema, preservando o fluxo canônico em `intermitentes_lotes_fechamento`.
2. **P2 — Proteção dos Vínculos no Trigger Guardião:** Blindar o trigger contra bypass por variáveis de sessão manipuláveis via API client, exigir comprovação de role autorizada (`rh`, `admin`, `super_admin`), proteger `empresa_id`, `lote_fechamento_id`, `total`, horas apuradas e estados de pipeline contra mutação direta não autorizada, garantindo total compatibilidade com ingestão Tio Digital (`service_role`), fechamento operacional e aprovação RH.
3. **P3 — Padronização de Erros (SQLSTATE):** Substituir códigos genéricos (`22000`) por códigos semânticos padronizados do PostgreSQL (`55000` para estados inválidos de máquina e `0A000` para fail-closed de motor não implementado).

---

## 2. CORREÇÃO P1 — INCOMPATIBILIDADE FINANCEIRA

### 2.1 Análise e Causa Raiz
Na auditoria 05B.2 constatou-se que a tabela `public.rh_financeiro_lotes` é restrita aos domínios de CLT e Diaristas, contendo a constraint estrita:
```sql
CHECK (tipo IN ('BANCO_HORAS', 'FOLHA_VARIAVEL', 'FOLHA_BASE'))
```
Além disso, seus status válidos não incluem `PENDENTE_RH`. A tentativa anterior de atualizar `rh_financeiro_lotes` com `tipo = 'INTERMITENTES'` e `status = 'PENDENTE_RH'` falharia imediatamente por violação de check constraint no PostgreSQL.

No ERP ORBE, o domínio de Intermitentes possui seu próprio ciclo e motor canônico consolidado na tabela:
```sql
public.intermitentes_lotes_fechamento
```

### 2.2 Remoções Realizadas
1. **Em `rpc_rh_retificar_intermitente`:**
   - **Removida** a atualização espelho em `rh_financeiro_lote_itens` (marcando `status = 'REJEITADO'`).
   - **Removido** o recálculo agregado em `rh_financeiro_lotes` com `tipo = 'INTERMITENTES'`.
   - **Mantido e Preservado:** O ajuste transacional do lote operacional de origem em `public.intermitentes_lotes_fechamento` (decremento atômico de `quantidade_registros` e `valor_total`, e cancelamento automático caso fique zerado).
2. **Em `rpc_rh_revalidar_lote_devolvido`:**
   - **Removida** a atualização espelho em `rh_financeiro_lotes` (marcando `status = 'PENDENTE_RH'`).
   - **Mantida e Preservada:** A transição atômica do lote operacional em `public.intermitentes_lotes_fechamento` para `AGUARDANDO_VALIDACAO_RH` e dos lançamentos vinculados para `EM_ANALISE_RH`.

### 2.3 Salvaguarda dos Vínculos Financeiros Reais
Foi confirmado que o único vínculo financeiro/bancário real mantido por lotes de intermitentes é a tabela:
```sql
public.cnab_remessas_arquivos (coluna: intermitentes_lote_id)
```
A RPC mantém verificação estrita de salvaguarda:
```sql
SELECT count(*) INTO v_cnab_count
FROM public.cnab_remessas_arquivos
WHERE intermitentes_lote_id = v_lote_atual.id;

IF v_cnab_count > 0 THEN
    RAISE EXCEPTION 'VINCULO_BANCARIO: Lote já possui remessa CNAB gerada no Financeiro.' USING ERRCODE = '55000';
END IF;
```
Se qualquer remessa CNAB já foi gerada para o lote, a retificação é sumariamente bloqueada.

---

## 3. CORREÇÃO P2 — PROTEÇÃO DOS VÍNCULOS E TRIGGER GUARDIÃO

O trigger guardião [`public.fn_guard_lancamentos_intermitentes_update()`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql#L21-L100) foi reescrito para estabelecer camadas defensivas em profundidade (Defense-in-Depth):

### 3.1 Blindagem Contra Bypass por Variável de Sessão
Para impedir que um cliente REST autenticado execute `set_config('orbe.in_rpc_retificacao', 'true')` e contorne o trigger, a liberação pela flag exige comprovação simultânea de perfil RH ou Admin:
```sql
-- 2. Se executado dentro de transação autorizada pela RPC de retificação do RH:
-- Não aceita variável de sessão isoladamente; exige que o perfil do usuário seja RH ou Admin
IF current_setting('orbe.in_rpc_retificacao', true) = 'true' THEN
    IF lower(trim(coalesce(public.get_user_role(), ''))) IN ('admin', 'super_admin', 'rh') THEN
        RETURN NEW;
    END IF;
END IF;
```

### 3.2 Imutabilidade Financeira e de Jornada (Colunas Críticas)
Bloqueia qualquer alteração direta em colunas calculadas de horas e valores:
```sql
-- 3. Bloqueia alteração direta de colunas financeiras e horas via API client
IF (NEW.total IS DISTINCT FROM OLD.total) OR
   (NEW.horas_trabalhadas IS DISTINCT FROM OLD.horas_trabalhadas) OR
   (NEW.horas_normais IS DISTINCT FROM OLD.horas_normais) OR
   (NEW.he_50 IS DISTINCT FROM OLD.he_50) OR
   (NEW.he_100 IS DISTINCT FROM OLD.he_100) OR
   (NEW.hora_noturna IS DISTINCT FROM OLD.hora_noturna) THEN
    RAISE EXCEPTION 'MUTACAO_PROIBIDA: Valores financeiros e horas apuradas de intermitentes são imutáveis via API client. Utilize os fluxos oficiais de governança.'
    USING ERRCODE = '42501';
END IF;
```

### 3.3 Proteção dos Vínculos de Lote e Empresa
1. **Lançamento Já Vinculado a Lote:**
   - Proibido alterar `lote_fechamento_id` ou `empresa_id` via API client. Exclusividade da RPC `rpc_rh_retificar_intermitente`.
2. **Vinculação de Lançamento Inicial a Lote:**
   - Permitida apenas para lotes que existam, pertençam à mesma empresa e estejam no status `AGUARDANDO_VALIDACAO_RH` (suportando perfeitamente o Fechamento Operacional).
3. **Alteração de Empresa em Lançamento Aberto:**
   - Permitida apenas se o lançamento estiver no status inicial `RECEBIDO` e desvinculado de lote.
4. **Estados Terminais Imutáveis:**
   - Lançamentos em `APROVADO_RH`, `PAGO` ou `CNAB_GERADO` não podem ter seu `status_pipeline` alterado diretamente (permitindo apenas a transição autorizada de conciliação de `CNAB_GERADO` para `PAGO`).
5. **Bloqueio de Devolvidos para Usuários Operacionais:**
   - Se `OLD.status_pipeline = 'DEVOLVIDO'`, qualquer alteração de status por usuários operacionais é rejeitada com `ROLE_NOT_AUTHORIZED` (`42501`).
   - O retorno de `DEVOLVIDO` diretamente para `RECEBIDO` é proibido via API client (`TRANSICAO_INVALIDA`, `55000`), sendo admitido exclusivamente através da RPC `rpc_rh_retificar_intermitente`.

### 3.4 Matriz de Compatibilidade dos Fluxos Autorizados
| Fluxo | Identidade de Execução | Comportamento no Trigger | Compatibilidade |
| :--- | :--- | :--- | :--- |
| **Ingestão Tio Digital** | `service_role` (Edge Function / Cron) | Liberado no Step 1 (`auth.role() = 'service_role'`) | **Total** |
| **Fechamento Operacional** | Encarregado / Operacional | `OLD.lote_fechamento_id IS NULL` -> `NEW.lote_fechamento_id` de lote aberto da mesma empresa | **Total** |
| **Aprovação RH do Lote** | Analista RH / Admin | `status_pipeline` transita de `EM_ANALISE_RH` para `APROVADO_RH`; horas e vínculos preservados | **Total** |
| **Devolução RH do Lote** | Analista RH / Admin | `status_pipeline` transita de `EM_ANALISE_RH` para `DEVOLVIDO`; horas e vínculos preservados | **Total** |
| **Revalidação de Lote Devolvido** | Analista RH / Admin via RPC | `status_pipeline` transita de `DEVOLVIDO` para `EM_ANALISE_RH`; role validada | **Total** |
| **Retificação de Empresa** | Analista RH / Admin via RPC | RPC transacional com sessão `orbe.in_rpc_retificacao` + role RH/Admin | **Total** |
| **Tentativa de Edição por Encarregado** | Encarregado via API | Bloqueado com `42501` ou `55000` | **Protegido** |

---

## 4. CORREÇÃO P3 — REVISÃO E ALINHAMENTO DE SQLSTATEs

Todos os códigos de erro utilizados nas exceções foram alinhados aos padrões ANSI SQL / PostgreSQL:

| Exceção | Código Anterior | Novo Código | Classe PostgreSQL / Justificativa |
| :--- | :---: | :---: | :--- |
| `AUTH_REQUIRED` | `42501` | `42501` | `insufficient_privilege` — Sessão não autenticada |
| `TENANT_REQUIRED` | `42501` | `42501` | `insufficient_privilege` — Tenant não resolvido |
| `ROLE_NOT_AUTHORIZED` | `42501` | `42501` | `insufficient_privilege` — Perfil operacional não autorizado |
| `MUTACAO_PROIBIDA` | `42501` | `42501` | `insufficient_privilege` — Mutação direta não autorizada |
| `VINCULO_PROTEGIDO` | `42501` | `42501` | `insufficient_privilege` — Vínculo de lote protegido contra bypass |
| `DADO_INVALIDO` | `22023` | `22023` | `invalid_parameter_value` — Parâmetro nulo ou inválido |
| `EMPRESA_NOT_FOUND` | `23503` | `23503` | `foreign_key_violation` — Empresa inexistente ou fora do tenant |
| `REGISTRO_NOT_FOUND` | `P0002` | `P0002` | `no_data_found` — Lançamento não localizado |
| `LOTE_NOT_FOUND` | `P0002` | `P0002` | `no_data_found` — Lote não localizado |
| `CONCORRENCIA` | `40001` | `40001` | `serialization_failure` — Conflito de OCC (`updated_at`) |
| `ESTADO_INVALIDO` (Lote) | `22000` | **`55000`** | `object_not_in_prerequisite_state` — Lote em estado não retificável |
| `VINCULO_BANCARIO` | `22000` | **`55000`** | `object_not_in_prerequisite_state` — Lote com remessa CNAB existente |
| `ESTADO_INVALIDO` (Lançamento) | `22000` | **`55000`** | `object_not_in_prerequisite_state` — Lançamento em estado incompatível |
| `OPERACAO_BLOQUEADA` (Horas) | `22000` | **`0A000`** | `feature_not_supported` — Falta motor homologado de cálculo em banco |
| `ESTADO_IMUTAVEL` | `55000` | `55000` | `object_not_in_prerequisite_state` — Status terminal protegido |
| `TRANSICAO_INVALIDA` | `55000` | `55000` | `object_not_in_prerequisite_state` — Transição de pipeline ilegal |
| `LOTE_INVALIDO` | — | **`55000`** | `object_not_in_prerequisite_state` — Lote de destino fechado ou divergente |

---

## 5. EVIDÊNCIAS DE TESTES E VALIDAÇÕES LOCAIS

### 5.1 Verificação Estática de Tipos TypeScript
```powershell
npx tsc --noEmit
# Resultado: Exit Code 0 (Nenhum erro de tipagem no projeto)
```

### 5.2 Testes Unitários e de Integração da Etapa 05B
Arquivo: `src/test/fix_int_etapa05b_retificacao_rh.test.tsx`
```text
✓ src/test/fix_int_etapa05b_retificacao_rh.test.tsx (8 tests) 3081ms
  ✓ 1. Contrato da RPC rpc_rh_retificar_intermitente: parâmetros, governança e OCC (4 testes)
  ✓ 2. Regras de Interface: Bloqueio do Encarregado e Habilitação do RH (2 testes)
  ✓ 3. Desvinculação Transacional e Atualização de Lote de Origem (2 testes)

Test Files: 1 passed (1)
Tests:      8 passed (8)
Duration:   7.41s
```

### 5.3 Testes de Regressão da Suíte de Intermitentes
Arquivos: `src/test/fix_int_etapa04_ux_status.test.tsx` e `src/test/conv17_fix_final_encerramento.test.tsx`
```text
✓ src/test/fix_int_etapa04_ux_status.test.tsx (5 tests)
  ✓ FIX-INT-03: Diálogo Oficial de Confirmação com resumo, impacto e botões
  ✓ FIX-INT-03: Prevenção de requisições concorrentes durante fechamento
  ✓ FIX-INT-03: Validação de badges canônicos e estados de lotes

✓ src/test/conv17_fix_final_encerramento.test.tsx (18 tests)
  ✓ Comportamento e Navegação do Drawer Primário na Interface Oficial (lotes nos status:
    AGUARDANDO_VALIDACAO_RH, DEVOLVIDO, CANCELADO, VALIDADO_RH, FECHADO_FINANCEIRO, CNAB_GERADO, PAGO)

Test Files: 2 passed (2)
Tests:      23 passed (23)
Duration:   11.47s
```

---

## 6. MATRIZ DE RISCOS RESIDUAIS E GOVERNANÇA

| Risco Identificado | Nível de Risco | Mitigação Implementada | Status |
| :--- | :---: | :--- | :---: |
| **Execução Prematura em Banco Remoto** | Crítico | **Zero execuções remotas.** Migration preservada exclusivamente no filesystem local. Proibido deploy ou aplicação até aprovação do proprietário do ERP. | **Controlado** |
| **Bypass do Trigger por SQL Injection ou PostgREST** | Baixo | Validação dupla: além da variável de sessão transacional local, o trigger checa `public.get_user_role() IN ('admin', 'super_admin', 'rh')`. | **Mitigado** |
| **Incompatibilidade com o Schema Supabase** | Baixo | Todas as referências a `rh_financeiro_lotes` com tipo intermitente foram removidas. Utiliza apenas tabelas canônicas existentes. | **Saneado** |
| **Alteração de Horas sem Motor Transacional** | Médio | Fail-closed implementado via SQLSTATE `0A000` (`OPERACAO_BLOQUEADA`). Não admite retificação arbitrária de horas no banco. | **Blindado** |

---

## 7. CONCLUSÃO E PRÓXIMOS PASSOS

A migration [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql) encontra-se plenamente saneada, blindada e alinhada às regras canônicas do ERP ORBE.

**Próximo Passo:** Aguardar avaliação do proprietário do ERP antes de qualquer etapa de aplicação remota ou homologação em ambiente isolado (staging).
