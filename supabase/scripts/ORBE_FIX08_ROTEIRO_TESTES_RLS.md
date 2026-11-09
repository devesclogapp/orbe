# ORBE FIX-OCORRÊNCIAS-08 — Roteiro de Testes de Permissão e Isolamento (RLS)

> **STATUS DA HOMOLOGAÇÃO: HOMOLOGADO INTEGRALMENTE (33/33 APROVADOS)**  
> **Data de Homologação:** 2026-11-08  
> **Ambiente:** Supabase local isolado descartável `orbe_fix08_hml` (API: `http://127.0.0.1:55421`, DB: `127.0.0.1:55422`).  
> **Autenticação:** Supabase Auth (GoTrue) com usuários reais e JWTs assinados por chave exclusiva local.  
> **Isolamento Comprovado:** Stack `sec02_hml` preservada 100% inalterada; produção Cloud intocada.

---

## Pré-requisitos do ambiente isolado (Atendidos)
- Migrations `20261105220000` + `20261105233000` (FIX-08) aplicadas e validadas por POSCHECK oficial.
- Tenants fictícios **A** (`11111111-1111-1111-1111-111111111111`) e **B** (`22222222-2222-2222-2222-222222222222`).
- Empresas, colaboradores, operações de produção e catálogo cadastrados para ambos os tenants.
- 8 usuários reais autenticados via Supabase Auth (admin, rh, financeiro, encarregado para Tenants A e B).
- Chamadas executadas via **API REST PostgREST autenticada com JWT real** de cada perfil.

---

## Matriz de cenários RLS (27 Cenários)

| # | Perfil | Ação (via API autenticada) | Resultado esperado | Evidência Técnica Registrada | Status |
|---|---|---|---|---|:---:|
| 1 | ADMIN (A) | SELECT catálogo | Vê ativas **e inativas** de A; nada de B | HTTP 200, 2 itens retornados (`INF-A-01` ativa, `INF-A-02` inativa), 0 vazamentos de B | **APROVADO** |
| 2 | ADMIN (A) | INSERT/UPDATE catálogo (tenant A) | Permitido | INSERT HTTP 201 (`INF-A-TEST-02`), UPDATE HTTP 200 (ajuste valor ref para 125.00) | **APROVADO** |
| 3 | ADMIN (A) | INSERT decisão válida (op/colab/empresa de A) | Permitido | HTTP 201, registro criado com sucesso (`aaaa4444-4444-4444-4444-111111111111`) | **APROVADO** |
| 4 | ADMIN (A) | UPDATE decisão → AUTORIZADO | Permitido | HTTP 200, status atualizado para `AUTORIZADO` com registro de auditoria | **APROVADO** |
| 5 | RH (A) | Mesmos cenários 1–4 | Permitido | SELECT HTTP 200, INSERT catálogo HTTP 201, UPDATE decisão HTTP 200 | **APROVADO** |
| 6 | FINANCEIRO (A) | SELECT decisões e eventos de A | Permitido | Decisões HTTP 200 (count 2), Eventos HTTP 200 (count 1), todos do tenant A | **APROVADO** |
| 7 | FINANCEIRO (A) | INSERT/UPDATE em **decisões** | Rejeitado (RLS) | INSERT HTTP 403 (RLS policy violation), UPDATE HTTP 200 com 0 linhas afetadas | **APROVADO** |
| 8 | FINANCEIRO (A) | INSERT/UPDATE em catálogo | Rejeitado (RLS) | INSERT HTTP 403 (RLS policy violation), UPDATE HTTP 200 com 0 linhas afetadas | **APROVADO** |
| 9 | FINANCEIRO (A) | UPDATE evento PENDENTE_APLICACAO → APLICADO | Permitido | HTTP 200, transição de status autorizada para o perfil financeiro | **APROVADO** |
| 10 | ENCARREGADO (A) | SELECT catálogo | Somente `ativo = true` de A | HTTP 200, Total visível: 2 (`INF-A-01` e `INF-A-TEST-02`), inativas filtradas por RLS: 0 vazadas | **APROVADO** |
| 11 | ENCARREGADO (A) | SELECT decisões / eventos | 0 linhas | Decisões HTTP 200 (0 linhas), Eventos HTTP 200 (0 linhas) — visibilidade restrita por RLS | **APROVADO** |
| 12 | ENCARREGADO (A) | INSERT/UPDATE catálogo, decisões, eventos | Rejeitado (RLS) | Catálogo INSERT HTTP 403, Decisões INSERT HTTP 403, Eventos INSERT HTTP 403 | **APROVADO** |
| 13 | ENCARREGADO (A) | Lançar operação com ocorrência (`production_entry_collaborators` + `avaliacao_json`) | Permitido; sem efeito financeiro | Operação HTTP 201, Colaboradores HTTP 201, Eventos financeiros gerados: 0 | **APROVADO** |
| 14 | Qualquer (A) | SELECT em dados de B | 0 linhas | Catálogo B: 0 linhas, Decisões B: 0 linhas, Eventos B: 0 linhas (Isolamento Multi-tenant estrito) | **APROVADO** |
| 15 | ADMIN (A) | INSERT catálogo com `tenant_id` = B | Rejeitado (RLS WITH CHECK) | HTTP 403, violação de RLS WITH CHECK `tenant_id = current_tenant_id()` | **APROVADO** |
| 16 | ADMIN (A) | UPDATE de linha de B | 0 linhas afetadas | HTTP 200, 0 linhas modificadas (registro invisível e inalcançável) | **APROVADO** |
| 17 | ADMIN (A) | UPDATE `tenant_id` A→B em linha própria | Rejeitado (RLS/trigger) | HTTP 400, trigger de proteção rejeita alteração de tenant: `tenant_id é imutável` | **APROVADO** |
| 18 | ADMIN (A) | INSERT decisão tenant A com operação/colaborador/empresa de B | Rejeitado (trigger 23514) | HTTP 400 (trigger cross-tenant rejeitou: operação não pertence ao tenant da decisão) | **APROVADO** |
| 19 | ADMIN (A) | INSERT decisão com empresa de A e operação de outra empresa de A | Rejeitado (trigger 23514) | HTTP 400 (trigger cross-company rejeitou: operação não pertence à empresa informada) | **APROVADO** |
| 20 | FINANCEIRO (A) | INSERT evento apontando decisão de B | Rejeitado (trigger 23514) | HTTP 400 (trigger rejeitou: decisão não pertence ao tenant do evento financeiro) | **APROVADO** |
| 21 | ADMIN (A) | INSERT evento com colaborador ≠ colaborador da decisão | Rejeitado (trigger 23514) | HTTP 400 (trigger rejeitou: colaborador diverge do colaborador registrado na decisão) | **APROVADO** |
| 22 | ADMIN (A) | DELETE físico em catálogo, decisões, eventos | Bloqueado (0 linhas / permissão negada) | Catálogo HTTP 403, Decisões HTTP 403, Eventos HTTP 403 (Políticas Restritivas `USING (false)`) | **APROVADO** |
| 23 | service_role | DELETE com FK dependente | Bloqueado por `ON DELETE RESTRICT` | HTTP 409, constraint `operacoes_ocorrencias_decisoes_infracao_id_fkey` impede exclusão | **APROVADO** |
| 24 | ADMIN (A) | Mover `profiles.tenant_id` para B **durante sessão** e repetir cenário 14 com o mesmo JWT | Passa a enxergar **somente B**; nunca A + B | HTTP 200, 1 linha retornada de B (`INF-B-01`), 0 vazamentos de A (troca de contexto dinâmica 100%) | **APROVADO** |
| 25 | ADMIN (A) | JWT com claim `tenant_id` forjado/divergente do profile | Claim ignorado; vale o `profiles` | HTTP 200, linhas de A: 3, linhas de B: 0 (Decisão arquitetural: autoridade exclusiva do banco) | **APROVADO** |
| 26 | ANON | Qualquer operação nas 3 tabelas | Negado | Catálogo HTTP 401, Decisões HTTP 401, Eventos HTTP 401 (Acesso não autenticado barrado) | **APROVADO** |
| 27 | ADMIN (A) | Reexecutar `ORBE_FIX08_APLICAR.sql` | Sem erro; mesmo estado (POSCHECK idêntico) | Reexecução DDL sem erros; POSCHECK aprovado (12 policies, 5 functions, 3 triggers íntegros) | **APROVADO** |

---

## Cenários de integração financeira (F1 a F6)

| # | Cenário | Resultado Esperado | Evidência Técnica Registrada | Status |
|---|---|---|---|:---:|
| F1 | Ocorrência provisória (sem decisão) e fechamento CLT/Intermitente/Diarista | Nenhum desconto; líquido = bruto | 0 eventos financeiros pendentes; Salário Bruto: R$ 2.500,00, Desconto: R$ 0,00, Salário Líquido: R$ 2.500,00 | **APROVADO** |
| F2 | Decisão REJEITADA/ARQUIVADA | Nenhum evento financeiro gerado | Decisão com status `REJEITADO` arquivada; 0 eventos criados em `operacoes_ocorrencias_eventos_financeiros` | **APROVADO** |
| F3 | Decisão AUTORIZADA + competência fechada CLT | Evento `PENDENTE_APLICACAO` → `APLICADO` uma única vez | Status anterior: `PENDENTE_APLICACAO` → Fechamento gera item `DESCONTO_AVARIA_RESSARCIMENTO` (-R$ 150,00) no lote de folha variável → Status posterior: `APLICADO` | **APROVADO** |
| F4 | Segundo fechamento da mesma competência (Reprocessamento / Idempotência) | Sem novo desconto (idempotência preservada) | Eventos pendentes na reexecução: 0; contagem de itens de desconto no lote permaneceu inalterada (1 antes = 1 depois) | **APROVADO** |
| F5 | Lote finalizado (APROVADO/PAGO) | Itens e valores imutáveis (proteção contra alteração) | Lote com status `APROVADO_FINANCEIRO`; trava operacional do motor impede reabertura/sobrescrita por novas apurações do RH | **APROVADO** |
| F6 | Faturamento do cliente da operação | Valor inalterado pelo desconto do colaborador | Faturamento Contratado da Operação com Cliente: R$ 50,00 inalterado; Ressarcimento do Colaborador: R$ 150,00 isolado na folha | **APROVADO** |

---

## Conclusão da Homologação
- **RLS e Multi-tenant:** 27 de 27 cenários aprovados com chamadas HTTP autenticadas via JWTs reais.
- **Integração Financeira:** 6 de 6 cenários aprovados, demonstrando conformidade com as regras de fechamento e imutabilidade do ERP Orbe.
- **Veredito Geral:** **FIX-OCORRÊNCIAS-08 HOMOLOGADO INTEGRALMENTE COM SUCESSO.**
