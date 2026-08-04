# Bloco 3: Smoke Test Visual - Diaristas

## Cenário 1 — Produção
**Ambiente:** PRODUCAO
**Critérios:**
- [ ] Listagem mostra somente lançamentos PROD
- [ ] Lotes mostram somente empresas PROD
- [ ] Nenhum registro HML aparece em filtros ou seletores
- [ ] Registros sem empresa não aparecem como elegíveis
- [ ] Fechamento vazio não cria lote
- [ ] Fechamento válido cria somente um lote
- [ ] Tentativa duplicada retorna aviso controlado
- [ ] Nenhum CNAB HML aparece

**Status PASS/FAIL:** Pendente

---

## Cenário 2 — Homologação
**Ambiente:** HOMOLOGACAO
**Critérios:**
- [ ] Listagem mostra somente lançamentos HML
- [ ] Lotes mostram somente empresas HML
- [ ] Nenhum dado PROD aparece
- [ ] Fechamento HML gera lote HML
- [ ] Dados bancários utilizados pertencem ao ambiente correto
- [ ] Arquivo gerado permanece isolado da Central PROD

**Status PASS/FAIL:** Pendente

---

## Cenário 3 — Troca de ambiente
**Ambiente:** MISTO (PROD → HML, HML → PROD)
**Critérios:**
- [ ] Dados antigos desaparecem imediatamente
- [ ] Cache é invalidado
- [ ] Nenhum card mantém valores residuais
- [ ] Nenhuma tabela mantém paginação contaminada
- [ ] Refresh preserva o ambiente selecionado

**Status PASS/FAIL:** Pendente

---

## Cenário 4 — Inconsistência nula
**Ambiente:** AMBOS
**Critérios:**
- [ ] Lançamento sem `empresa_id` não entra no fechamento
- [ ] Recebe status DEVOLVIDO
- [ ] Possui observação explicativa
- [ ] Gera log de auditoria
- [ ] Não entra em lote de pagamento
- [ ] Não alcança o CNAB

**Status PASS/FAIL:** Pendente

---

## Cenário 5 — Concorrência
**Ambiente:** PROD
**Ação:** Acionar o fechamento duas vezes rapidamente
**Critérios:**
- [ ] Apenas um lote é criado
- [ ] Segunda tentativa é interceptada
- [ ] Erro 23505 não aparece cru para o usuário
- [ ] Nenhum item financeiro é duplicado

**Status PASS/FAIL:** Pendente

---

## Assinatura Final

**Smoke PROD:** Pendente
**Smoke HML:** Pendente
**Troca de ambiente:** Pendente
**Null sanitation:** Pendente
**Idempotência visual:** Pendente

**Status Final:** PENDENTE
