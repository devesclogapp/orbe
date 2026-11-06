# ORBE FIX-OCORRÊNCIAS-08 — Roteiro de Testes de Permissão e Isolamento (RLS)

> **STATUS DE TODOS OS CENÁRIOS: PENDENTE.**
> Dependem de autenticação real em ambiente isolado (staging/branch Supabase com 2 tenants fictícios).
> **Não executar em produção.** Nenhum cenário abaixo foi executado nem aprovado.
> Testes locais (vitest) com mocks NÃO homologam RLS.

## Pré-requisitos do ambiente isolado
- Migration original `20261105220000` + `20261105233000` aplicadas.
- Tenants fictícios **A** e **B**, cada um com: 1 empresa, 1 colaborador, 1 operação, 1 usuário por perfil
  (admin, rh, financeiro, encarregado) com `profiles.tenant_id` e `user_permissions` correspondentes.
- Catálogo em A: 1 infração ativa e 1 inativa. Catálogo em B: 1 ativa.
- Chamadas feitas via **API REST/PostgREST com o JWT do usuário** (não service_role).

## Matriz de cenários

| # | Perfil | Ação (via API autenticada) | Resultado esperado | Status |
|---|---|---|---|---|
| 1 | ADMIN (A) | SELECT catálogo | Vê ativas **e inativas** de A; nada de B | PENDENTE |
| 2 | ADMIN (A) | INSERT/UPDATE catálogo (tenant A) | Permitido | PENDENTE |
| 3 | ADMIN (A) | INSERT decisão válida (op/colab/empresa de A) | Permitido | PENDENTE |
| 4 | ADMIN (A) | UPDATE decisão → AUTORIZADO | Permitido | PENDENTE |
| 5 | RH (A) | Mesmos cenários 1–4 | Permitido | PENDENTE |
| 6 | FINANCEIRO (A) | SELECT decisões e eventos de A | Permitido | PENDENTE |
| 7 | FINANCEIRO (A) | INSERT/UPDATE em **decisões** | Rejeitado (RLS) | PENDENTE |
| 8 | FINANCEIRO (A) | INSERT/UPDATE em catálogo | Rejeitado (RLS) | PENDENTE |
| 9 | FINANCEIRO (A) | UPDATE evento PENDENTE_APLICACAO → APLICADO | Permitido | PENDENTE |
| 10 | ENCARREGADO (A) | SELECT catálogo | Somente `ativo = true` de A | PENDENTE |
| 11 | ENCARREGADO (A) | SELECT decisões / eventos | 0 linhas | PENDENTE |
| 12 | ENCARREGADO (A) | INSERT/UPDATE catálogo, decisões, eventos | Rejeitado (RLS) | PENDENTE |
| 13 | ENCARREGADO (A) | Lançar operação com ocorrência (`production_entry_collaborators` + `avaliacao_json`) | Permitido; sem efeito financeiro | PENDENTE |
| 14 | Qualquer (A) | SELECT em dados de B | 0 linhas | PENDENTE |
| 15 | ADMIN (A) | INSERT catálogo com `tenant_id` = B | Rejeitado (RLS WITH CHECK) | PENDENTE |
| 16 | ADMIN (A) | UPDATE de linha de B | 0 linhas afetadas | PENDENTE |
| 17 | ADMIN (A) | UPDATE `tenant_id` A→B em linha própria | Rejeitado (RLS/trigger) | PENDENTE |
| 18 | ADMIN (A) | INSERT decisão tenant A com operação/colaborador/empresa de B | Rejeitado (trigger 23514) | PENDENTE |
| 19 | ADMIN (A) | INSERT decisão com empresa de A e operação de outra empresa de A | Rejeitado (trigger 23514) | PENDENTE |
| 20 | FINANCEIRO (A) | INSERT evento apontando decisão de B | Rejeitado (trigger 23514) | PENDENTE |
| 21 | ADMIN (A) | INSERT evento com colaborador ≠ colaborador da decisão | Rejeitado (trigger 23514) | PENDENTE |
| 22 | ADMIN (A) | DELETE físico em catálogo, decisões, eventos | Bloqueado (0 linhas / permissão negada) | PENDENTE |
| 23 | service_role | DELETE com FK dependente | Bloqueado por `ON DELETE RESTRICT` | PENDENTE |
| 24 | ADMIN (A) | Mover `profiles.tenant_id` para B **durante sessão** e repetir cenário 14 com o mesmo JWT | Passa a enxergar **somente B**; nunca A + B | PENDENTE |
| 25 | ADMIN (A) | JWT com claim `tenant_id` forjado/divergente do profile | Claim ignorado; vale o `profiles` | PENDENTE |
| 26 | ANON | Qualquer operação nas 3 tabelas | Negado | PENDENTE |
| 27 | ADMIN (A) | Reexecutar `ORBE_FIX08_APLICAR.sql` | Sem erro; mesmo estado (POSCHECK idêntico) | PENDENTE |

## Cenários de integração financeira (ambiente isolado)

| # | Cenário | Esperado | Status |
|---|---|---|---|
| F1 | Ocorrência provisória (sem decisão) e fechamento CLT/Intermitente/Diarista | Nenhum desconto; líquido = bruto | PENDENTE |
| F2 | Decisão REJEITADA/ARQUIVADA | Nenhum evento gerado | PENDENTE |
| F3 | Decisão AUTORIZADA + competência fechada CLT | Evento `PENDENTE_APLICACAO` → `APLICADO` uma única vez | PENDENTE |
| F4 | Segundo fechamento da mesma competência | Sem novo desconto (idempotência) | PENDENTE |
| F5 | Lote finalizado (APROVADO/PAGO) | Itens e valores imutáveis | PENDENTE |
| F6 | Faturamento do cliente da operação | Valor inalterado pelo desconto do colaborador | PENDENTE |

## Como executar um cenário (modelo, apenas em ambiente isolado)
```bash
# Obter JWT do usuário de teste (login real) e chamar a API como ele:
curl -s "$SUPABASE_URL/rest/v1/infracoes_operacionais_catalogo?select=id,codigo,ativo" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT"
```
Registrar para cada cenário: usuário, requisição, resposta HTTP e linhas retornadas. Só então alterar o status para APROVADO.

