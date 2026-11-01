# DIAGNÓSTICO TÉCNICO COMPLEMENTAR: TESTE C01 (ETAPA 05D.8)
**ERP ORBE — DOMÍNIO RH / INTERMITENTES — FIX-FINAL / ETAPA 05D.8**  
**Data:** 12/10/2026 | **Ambiente:** Cluster PostgreSQL 17.5 Isolado Local (`127.0.0.1:54322`)  
**Status do Teste C01:** **INCONCLUSIVO**  
**Status do Teste C02:** **NÃO EXECUTADO**

---

## 1. RESPOSTAS OBJETIVAS AOS 10 QUESTIONAMENTOS

### 1. Qual foi o resultado final da Sessão 1?
- **Resultado:** **SUCESSO**, com SQLSTATE `00000`.
- **Início:** `2026-10-12 17:08:14.887729-03`
- **Término:** `2026-10-12 17:08:17.937952-03` (Duração: 3,050 segundos).
- **Ação:** Retificou com sucesso o lançamento `f0000000-0000-0000-0000-000000000006`, desvinculou do Lote 5, atualizou a empresa para a Empresa B e comitou a transação.

---

### 2. Qual foi o resultado final da Sessão 2?
- **Resultado:** **ERRO_INESPERADO**, com SQLSTATE `55000`.
- **Mensagem:** `record "v_lote_atual" is not assigned yet`.
- **Início:** `2026-10-12 17:08:18.483413-03`
- **Término:** `2026-10-12 17:08:18.483413-03`
- **Ação:** A transação da Sessão 2 abortou imediatamente sem persistir qualquer alteração.

---

### 3. A Sessão 2 recebeu SQLSTATE 40001? Apresente a evidência.
- **NÃO.** A Sessão 2 **não** recebeu o SQLSTATE `40001` esperado de concorrência OCC.
- **Evidência Extraída Diretamente de `public.hml_c01_concurrency_log`:**
  ```text
   session_id |          started_at           |          finished_at          | duracao_seg |    resultado    | sqlstate_obtido |                 mensagem                  
  ------------+-------------------------------+-------------------------------+-------------+-----------------+-----------------+-------------------------------------------
   SESSAO_1   | 2026-10-12 17:08:14.887729-03 | 2026-10-12 17:08:17.937952-03 |       3.050 | SUCESSO         | 00000           | Transação 1 commitada com sucesso
   SESSAO_2   | 2026-10-12 17:08:18.483413-03 | 2026-10-12 17:08:18.483413-03 |       0.000 | ERRO_INESPERADO | 55000           | record "v_lote_atual" is not assigned yet
  ```
- **Causa Raiz Técnica:**
  Quando a Sessão 2 executou a RPC, a Sessão 1 já havia commitado e desvinculado o registro (`lote_fechamento_id` tornou-se `NULL`). A RPC pulou o bloco `IF v_lote_id IS NOT NULL`, deixando a variável PL/pgSQL `v_lote_atual` não inicializada. Mais adiante na procedure, o acesso ao campo de um `RECORD` não inicializado disparou a exceção nativa do PostgreSQL `record "v_lote_atual" is not assigned yet` (SQLSTATE `55000`), antes de atingir a checagem de OCC.

---

### 4. Houve sobreposição temporal real entre as transações?
- **Na execução registrada no log:** **NÃO.**
  - Sessão 1 finalizou em `17:08:17.937952-03`.
  - Sessão 2 iniciou em `17:08:18.483413-03` (+545ms após o commit da Sessão 1).
  - O atraso no arranque do job em background da Sessão 2 fez com que ela conectasse após a liberação do lock da Sessão 1, não havendo disputa simultânea ativa de lock pessimista na janela registrada.

---

### 5. O lançamento foi retificado quantas vezes?
- **Exatamente 1 vez.**
- O lançamento `f0000000-0000-0000-0000-000000000006` reflete exclusivamente as mutações da Sessão 1:
  - `empresa_id`: alterada de `e000...001` para `e000...002`.
  - `status_pipeline`: `RECEBIDO`.
  - `lote_fechamento_id`: `NULL`.
  - `total`: R$ 100,00 (intacto).
  - `horas_trabalhadas`: 4,00h (intacto).

---

### 6. O lote sofreu quantos decrementos?
- **Exatamente 1 decremento.**
- O Lote 5 (`50000000-0000-0000-0000-000000000005`) possuía 1 registro e R$ 100,00.
- Após a desvinculação atômica pela Sessão 1:
  - `quantidade_registros`: **0**
  - `valor_total`: **R$ 0,00**
  - `status`: **CANCELADO**
- Não houve duplo decremento nem valores negativos.

---

### 7. Quantos registros de auditoria foram criados?
- **Exatamente 1 registro de auditoria.**
- Registro ID `586400b7-f554-4551-aad0-f7efb7f51a49`:
  - `acao`: `RETIFICAR_INTERMITENTE_RH`
  - `entidade`: `lancamentos_intermitentes`
  - `registro_id`: `f0000000-0000-0000-0000-000000000006`
  - `descricao`: `Retificação pelo RH. Justificativa: Retificação Concorrente Sessão 1 (Vencedora)`
  - `criado_em`: `2026-10-12 17:08:14.169146-03`
- A Sessão 2 não gerou nenhum registro espúrio em `audit_log`.

---

### 8. Por que foi necessário criar e executar `reset_c01.sql`?
- Durante a primeira tentativa do teste concorrente, a Sessão 1 completou com sucesso, mas o script da Sessão 2 utilizava `UPDATE ... WHERE session_id = 'SESSAO_2'` dentro do bloco de exceção PL/pgSQL. Como a subtransação sofreu rollback na exceção, o `INSERT` anterior foi desfeito e o log da Sessão 2 ficou em branco.
- Para reexecutar a prova com o script da Sessão 2 corrigido (usando `INSERT ... ON CONFLICT`), era indispensável que o registro alvo e o lote retornassem ao estado original de pré-teste. Caso contrário, o registro já estaria em estado `RECEBIDO` sem lote, inviabilizando qualquer teste de concorrência sobre o lote pai.

---

### 9. Quais registros foram alterados ou excluídos durante a restauração?
1. `public.lancamentos_intermitentes`:
   - Registro `f0000000-0000-0000-0000-000000000006`: restaurado para `lote_fechamento_id = 5000...005`, `empresa_id = e000...001`, `status_pipeline = EM_ANALISE_RH`, `updated_at = 2026-10-12 16:52:30.536099-03`.
2. `public.intermitentes_lotes_fechamento`:
   - Lote `50000000-0000-0000-0000-000000000005`: restaurado para `status = AGUARDANDO_VALIDACAO_RH`, `quantidade_registros = 1`, `valor_total = 100.00`.
3. `public.audit_log`:
   - Excluído o 1 registro gerado pela primeira tentativa para o item 6 (`DELETE FROM audit_log WHERE registro_id = 'f000...006'`).
4. `public.hml_c01_concurrency_log`:
   - Truncado para permitir o novo registro limpo de timeline.

---

### 10. O Teste C02 chegou a ser executado?
- **NÃO.** O Teste C02 não foi iniciado nem executado.

---

## 2. CLASSIFICAÇÃO OBJETIVA DO TESTE C01

### Classificação: **INCONCLUSIVO**

### Justificativas Técnicas:
1. **Aspectos Positivos Comprovados:**
   - **Ausência Absoluta de Lost Update:** Apenas uma transação gravou e seus dados foram preservados.
   - **Ausência de Duplo Decremento:** O lote foi decrementado exatamente 1 vez.
   - **Isolamento de Auditoria:** Foi gerado exatamente 1 log de auditoria.
   - A Sessão 2 abortou e não corrompeu os dados.

2. **Aspectos Pendentes / Falhos:**
   - O objetivo precípuo do C01 era a rejeição por **conflito de versão OCC** (SQLSTATE `40001`). O erro retornado foi `55000` (`record "v_lote_atual" is not assigned yet`), decorrente de um comportamento interno da procedure quando invocada sobre registro cujo lote pai foi desvinculado pela transação anterior.
   - Não houve sobreposição temporal estrita na segunda tentativa (Sessão 2 arrancou após o commit da Sessão 1).

---

## 3. ESTADO ATUAL DO AMBIENTE E PRÓXIMOS PASSOS

- Nenhuma operação de escrita adicional foi realizada.
- Nenhuma alteração foi feita em arquivos versionados ou migrations.
- O ambiente local permanece ativo e isolado em `127.0.0.1:54322`.

Aguardando sua avaliação e diretrizes sobre como proceder com o refinamento do cenário C01 e a execução do teste C02.
