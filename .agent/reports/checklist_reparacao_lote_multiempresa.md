# RELATÓRIO: CHECKLIST REPARAÇÃO LOTE MULTIEMPRESA

## Passos para o Saneamento Oficial Completo (FASE 12)

- [x] Backend corrigido via arquivo TypeScript para subagrupamento obrigatório com a tripla chave: `${tenantId}_${empresaId}_${competencia}`.
- [x] Lote legado `6e9b5afc-e2f0-4ae8-b0ef-9c581da5e8f0` auditado via script Node.js bypassando RLS.
- [x] Script Node de correção transposto e embutido em Arquivo **SQL Puro** (`.agent/scripts/repara_lote_6e9b5afc.sql`) para execução segura no Supabase Dashboard by-passando Service Role.
- [ ] Rodar o script `.agent/scripts/repara_lote_6e9b5afc.sql` via Supabase SQL Editor.
- [ ] Validar a Notice via Log Console do Postgres com os resultados da Reparação (Lote Cancelado e Lotes Criados).
- [ ] Acessar painel RH na plataforma de Homologação.
- [ ] Aprovar os 3 sub-lotes originários dos 11 lançamentos descompactados formados pelo script.
- [ ] Central Bancária testa a aparição dos Lotes recém convertidos com "FECHADO_FINANCEIRO".
