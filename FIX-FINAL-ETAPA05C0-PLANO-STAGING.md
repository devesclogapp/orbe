# ERP ORBE — FIX-FINAL / ETAPA 05C.0
# Plano de Homologação em Banco Isolado

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Planejamento Concluído (Estritamente READ-ONLY — Zero operações de escrita em banco e Git)  
> **Arquivo Analisado:** [`supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261012120000_etapa05b_retificacao_intermitentes_rh.sql)  

---

## 1. OBJETIVO DO PLANO

Estabelecer a estratégia técnica, matriz de testes e critérios de governança para executar e homologar a migration de retificação de intermitentes pelo RH em ambiente **estritamente isolado**, protegendo a integridade da base de produção, as integrações ativas (Tio Digital, n8n) e as rotinas financeiras homologadas.

---

## 2. COMPROVAÇÃO DE ISOLAMENTO DO AMBIENTE

### 2.1 Auditoria das Configurações Atuais do Repositório
Realizou-se varredura completa nos arquivos de configuração do projeto:
- **Arquivo Ativo:** [`.env.local`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/.env.local)
- **URL Configurada:** `https://lifgjtcflzmspilhryap.supabase.co`
- **Project Ref:** `lifgjtcflzmspilhryap`
- **Ambiente Local Supabase:** [`supabase/config.toml`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/config.toml) (`project_id = "Orbe"`, portas locais 54321/54322 desativadas no momento).

### 2.2 Veredito sobre a Existência de Staging Remoto
> ⚠️ **DECLARAÇÃO OBRIGATÓRIA:**  
> **NÃO existe atualmente no repositório um projeto Supabase remoto de Staging provisionado ou configurado de forma isolada e verificável.**  
> O único projeto apontado nas variáveis de ambiente (`lifgjtcflzmspilhryap`) contém dados compartilhados e operacionais da ESC Log. Aplicar qualquer migration diretamente nesse endpoint violaria as diretrizes de isolamento de homologação.

### 2.3 Riscos de Contaminação de Produção Identificados
1. **Workflows n8n e Webhooks Tio Digital:**  
   A Edge Function [`supabase/functions/importar-intermitentes-tio/index.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/functions/importar-intermitentes-tio/index.ts) atende chamadas da automação do Tio Digital usando a chave `service_role` de produção. Se a migration for executada no banco atual, qualquer regressão afetará a ingestão real de dados às 07h.
2. **Dados Reais vs. Dados de Homologação:**  
   Embora exista a convenção da "Base Oficial de Homologação" ([`base_oficial_homologacao.md`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/base_oficial_homologacao.md)) com `is_teste = true`, ela reside fisicamente na **mesma instância de banco de dados**.
3. **Ausência de Separação de Credenciais:**  
   Não existem credenciais distintas (`STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SERVICE_ROLE_KEY`) configuradas no repositório.

### 2.4 Requisitos Obrigatórios para Provisionamento de Staging
Para que a homologação ocorra em ambiente verdadeiramente isolado, são necessárias as seguintes opções (aguardando definição do proprietário):
- **Opção A (Recomendada — Supabase Staging Remoto):** Criar um projeto Supabase dedicado (ex: `orbe-staging-isolated`), aplicar as migrations base até a versão anterior, carregar a massa sintética da Base de Homologação e apontar `.env.staging` para este projeto.
- **Opção B (Alternativa Local — Supabase CLI / Docker):** Iniciar contêiner local isolado (`npx supabase start`), rodar `supabase db reset` com seeds sintéticas, testar a migration e descartar os contêineres após a validação.

---

## 3. REVISÃO DO MODELO DE AUTORIZAÇÃO DA RPC

Na Etapa 05B.4, implementou-se a inspeção de pilha via `GET DIAGNOSTICS v_stack = PG_CONTEXT` combinada com `current_user = 'postgres'`. Embora eficaz conceitualmente, cabe avaliar suas limitações antes da homologação final.

### 3.1 Limitações Técnicas do `PG_CONTEXT`
1. **Dependência de Formatação de Texto:** `PG_CONTEXT` retorna strings formatadas para logs/debug. Qualquer variação em releases futuras do PostgreSQL (ou configurações de localização/verbosidade) pode alterar a sintaxe dos frames de chamada.
2. **Risco de Falsos Positivos:** Uma busca com `LIKE '%rpc_rh_retificar_intermitente%'` pode coincidir se uma função auxiliar ou comentário invocar esse identificador.
3. **Não-Canônico para Controle de Acesso:** Em arquitetura relacional clássica, o PostgreSQL controla acessos através do sistema de privilégios (`GRANT`/`REVOKE`), RLS (`CREATE POLICY`) e privilégios colunares.

### 3.2 Alternativas Mais Robustas Baseadas no Banco

| Modelo de Proteção | Mecanismo | Vantagens | Desvantagens / Impacto |
| :--- | :--- | :--- | :--- |
| **Modelo 1: Atual (PG_CONTEXT + SECURITY DEFINER + Role)** | Inspeciona stack de execução em runtime e checa `current_user = 'postgres'`. | Não requer alteração de schemas nem criação de tabelas adicionais. | Dependente de string parsing de diagnóstico do PostgreSQL. |
| **Modelo 2: Tabela de Token Transacional Privada (`_orbe_private_tokens`)** | A RPC gera um UUID randômico e o insere em tabela com RLS bloqueado para `authenticated` (apenas `postgres` tem acesso). O trigger lê e deleta o token (One-Time Pad). | 100% à prova de falsificação pelo cliente; independe de strings de stack. | Exige criação de uma tabela auxiliar privada no schema `public` ou `auth`. |
| **Modelo 3: Revogação de Privilégios Colunares (`REVOKE UPDATE (colunas)`)** | `REVOKE UPDATE (total, horas_*, lote_fechamento_id) FROM authenticated`. Apenas funções `SECURITY DEFINER` (rodando como `postgres`) conseguem atualizar. | Segurança nativa do PostgreSQL no nível mais baixo (parser/permission check). | Bloquearia o Fechamento Operacional direto via Supabase client, exigindo que o Fechamento também migrasse para uma RPC (`rpc_operacional_fechar_lote`). |

### 3.3 Recomendação Técnica
Para a homologação em Staging:
1. **Manter o Modelo 1 (PG_CONTEXT + current_user + role)** para teste preliminar de regressão, pois ele preserva compatibilidade total com o código TypeScript existente.
2. **Executar teste de penetração no Staging:** Tentar forçar o bypass via SQL e via PostgREST. Se houver qualquer inconsistência, adotar o **Modelo 2 (Tabela de Token Transacional Privada)**, que é matematicamente inviolável e não quebra fluxos legados.

---

## 4. MATRIZ DE TESTES DE HOMOLOGAÇÃO (14 CENÁRIOS OBRIGATÓRIOS)

A matriz abaixo deverá ser executada integralmente no banco isolado de Staging:

| ID | Cenário de Teste | Ator | Ação Executada | Resultado Esperado | SQLSTATE / Status | Critério de Aceite |
| :---: | :--- | :---: | :--- | :--- | :---: | :--- |
| **T01** | **Retificação legítima de empresa pelo RH** | Analista RH | Invoca `rpc_rh_retificar_intermitente` passando lançamento em `DEVOLVIDO` e nova empresa válida. | Lançamento desvinculado do lote anterior, empresa alterada, status volta para `RECEBIDO`, lote pai decrementado. | `200 OK` (JSON success) | Lançamento desvinculado; lote de origem teve `quantidade_registros` e `valor_total` decrementados; audit_log gravado. |
| **T02** | **Encarregado tenta retificar via RPC** | Encarregado | Invoca `rpc_rh_retificar_intermitente`. | Rejeitado por perfil não autorizado. | `42501` (`ROLE_NOT_AUTHORIZED`) | Nenhuma linha alterada; erro de autorização claro retornado. |
| **T03** | **Usuário autenticado tenta UPDATE direto via API** | PostgREST Client | Executa `UPDATE lancamentos_intermitentes SET horas_trabalhadas = 10`. | Bloqueado pelo trigger guardião no passo 3. | `42501` (`MUTACAO_PROIBIDA`) | Banco rejeita; horas e totais permanecem inalterados. |
| **T04** | **RH tenta contornar a RPC via UPDATE direto com flag** | Analista RH | Executa `SELECT set_config('orbe.in_rpc_retificacao', 'true')` e roda `UPDATE` direto. | Bloqueado pelo trigger guardião (falha na validação de stack `PG_CONTEXT` e `current_user`). | `42501` (`VINCULO_PROTEGIDO` ou `MUTACAO_PROIBIDA`) | Impossível contornar as regras da RPC mesmo tendo perfil RH. |
| **T05** | **Empresa de outro tenant é rejeitada** | Analista RH | Invoca RPC informando `p_nova_empresa_id` de tenant diferente. | Rejeitado na validação de empresa do mesmo tenant. | `23503` (`EMPRESA_NOT_FOUND`) | Transação abortada; isolamento multi-tenant preservado. |
| **T06** | **Lote aprovado ou pago não pode ser retificado** | Analista RH | Invoca RPC para lançamento pertencente a lote em status `APROVADO_RH` ou `PAGO`. | Rejeitado na validação de lista positiva de status do lote pai. | `55000` (`ESTADO_INVALIDO`) | Dados protegidos; lotes finalizados permanecem imutáveis. |
| **T07** | **Lote com CNAB gerado não pode ser alterado** | Analista RH | Invoca RPC para lote que já possui registro em `cnab_remessas_arquivos`. | Rejeitado na trava bancária. | `55000` (`VINCULO_BANCARIO`) | Preserva conciliação financeira; impede divergência com arquivo bancário. |
| **T08** | **Alteração de horas é bloqueada (Fail-Closed)** | Analista RH | Invoca RPC passando `p_novas_horas <> lancamento.horas_trabalhadas`. | Bloqueado pela trava de motor de cálculo não implementado. | `0A000` (`OPERACAO_BLOQUEADA`) | Nenhuma alteração arbitrária de horas permitida no banco. |
| **T09** | **Correção de empresa preserva remuneração** | Analista RH | Retifica empresa de lançamento que possui valor total de R$ 330,00. | Empresa é alterada para B, mas `total` e horas permanecem exatamente R$ 330,00. | `200 OK` | Nenhuma recalculação matemática indevida ou perda de centavos. |
| **T10** | **Totais dos lotes permanecem matematicamente consistentes** | Analista RH | Retifica item de R$ 150 de um lote que tinha 5 itens e R$ 750. | Lote passa a ter 4 itens e R$ 600. Se o lote ficar com 0 itens, passa para `CANCELADO`. | `200 OK` | `sum(total)` dos itens bate 100% com `valor_total` do lote pai. |
| **T11** | **Auditoria registra antes e depois** | Analista RH | Executa retificação via RPC. | Consulta `public.audit_log` para o registro retificado. | Registro criado com `acao = 'RETIFICAR_INTERMITENTE_RH'` | Contém JSON de `valor_anterior` e `valor_novo` com justificativa e usuário real. |
| **T12** | **Concorrência simultânea (OCC)** | 2 Analistas | Usuário A e B tentam retificar o mesmo lançamento ao mesmo tempo. | Um tem sucesso; o segundo é rejeitado por conflito de `p_updated_at`. | `40001` (`CONCORRENCIA`) | Zero duplicidades; integridade relacional garantida. |
| **T13** | **Fechamento operacional legítimo continua funcionando** | Encarregado | Executa fechamento agrupando 3 lançamentos em `RECEBIDO` para novo lote da mesma empresa. | Lançamentos vinculados com sucesso ao lote e transitam para `EM_ANALISE_RH`. | `200 OK` | Passo 5 do trigger aceita vinculação legítima sem falhas. |
| **T14** | **Revalidação de lote devolvido respeita estados permitidos** | Analista RH | Invoca `rpc_rh_revalidar_lote_devolvido` em lote devolvido. | Lote transita para `AGUARDANDO_VALIDACAO_RH` e itens para `EM_ANALISE_RH`. Tentativa em lote não-devolvido falha. | `200 OK` / `55000` | Máquina de estados oficial respeitada; auditoria gravada. |

---

## 5. CRITÉRIOS DE APROVAÇÃO E HOMOLOGAÇÃO (GO / NO-GO)

A migration somente receberá parecer de **HOMOLOGADA PARA PRODUÇÃO** após satisfazer 100% dos critérios abaixo em banco isolado:

1. [ ] **Execução sem Erros em Banco Limpo:** Migration aplicada sem warnings, locks infinitos ou erros de sintaxe em instância isolada.
2. [ ] **Aprovação nos 14 Testes da Matriz:** 100% dos testes da matriz T01 a T14 executados e aprovados.
3. [ ] **Zero Regressão nos Fluxos Legados:**
   - Ingestão de pontos e intermitentes pelo `service_role` funcional.
   - Fechamento operacional de lotes executado com sucesso.
   - Aprovação de lote pelo RH funcional.
   - Geração de remessa CNAB e conciliação bancária funcionais.
4. [ ] **Validação de Performance e Deadlocks:** Execução com locks pessimistas (`FOR UPDATE`) em lote e lançamento sem ocorrência de deadlocks sob carga concorrente.
5. [ ] **Ausência de Falhas Críticas ou Altas:** Nenhum tenant leak, bypass de RLS ou divergência contábil detectado.

---

## 6. DECLARAÇÕES FORMAIS E CONCLUSÃO

### 1. Se existe staging isolado e verificável:
**NÃO.** O repositório aponta exclusivamente para a instância compartilhada `lifgjtcflzmspilhryap`. Não existe endpoint de staging remoto isolado configurado.

### 2. Quais testes estão prontos:
- **Testes Unitários / Integração Local:** 31 testes vitest (`fix_int_etapa05b_retificacao_rh.test.tsx`, `fix_int_etapa04_ux_status.test.tsx`, `conv17_fix_final_encerramento.test.tsx`) 100% verdes.
- **Checagem de Tipagem:** `tsc --noEmit` com Zero erros.
- **Roteiro de Testes para Banco Isolado:** Matriz com 14 cenários estruturados e prontos para execução automatizada ou manual assim que o ambiente for provisionado.

### 3. Quais riscos permanecem:
- **Risco de Aplicação Acidental na Base Compartilhada:** Se a migration for disparada no projeto atual sem isolamento, qualquer erro afetará o ambiente operacional.
- **Validação Específica do `PG_CONTEXT`:** Necessidade de comprovação empírica de que a string de contexto gerada pelo Supabase PostgREST em produção é idêntica à esperada pelo trigger.

### 4. Quais ações exigem autorização expressa do proprietário:
1. **Definição e Provisionamento do Ambiente de Staging:** Autorizar a criação de um projeto Supabase Staging isolado (ou aprovar o uso de contêiner local isolado via Supabase CLI).
2. **Definição do Modelo de Autorização:** Decidir entre o Modelo 1 (Stack `PG_CONTEXT` otimizado) ou o Modelo 2 (Tabela Privada de Tokens Transacionais).
3. **Autorização para Execução da Migration no Staging:** Nenhuma migration será aplicada sem comando explícito.

---

*Documento finalizado. Nenhuma operação de escrita foi executada. O sistema permanece em estado seguro e estável.*
