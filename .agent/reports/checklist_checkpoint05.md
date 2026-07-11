# CHECKLIST DE HOMOLOGAÇÃO — CHECKPOINT 05

## Preparação
- [x] Autenticação e acesso à Central Bancária (`/bancario`)
- [x] Filtro por Empresas e Competência

## Etapa 01 — Localização dos Lotes
- [ ] Lotes apareceram automaticamente na fila de remessa
- [ ] Empresa vinculada está correta
- [ ] Valores, total de colaboradores e lançamentos conferem
*Status: 🔴 FALHOU (Nenhum lote foi localizado no banco de dados para nenhuma das empresas testadas).*

## Etapa 02 — Seleção para Remessa
- [ ] Seleção individual e múltipla funcional
- [ ] Filtros aplicam corretamente
*Status: 🔴 FALHOU (Não há lotes disponíveis para selecionar).*

## Etapa 03 — Geração do CNAB
- [ ] Botão de geração dispara corretamente
- [ ] Loading e confirmação visual de sucesso
*Status: 🔴 BLOQUEADO*

## Etapa 04 — Validação Estrutural do Arquivo
- [ ] Arquivo CNAB segue padrão FEBRABAN 240
*Status: 🔴 BLOQUEADO*

## Etapa 05 e 06 — Integridade Financeira
- [ ] Valores, CPFs e banco origem conferem com o lote
*Status: 🔴 BLOQUEADO*

## Etapa 07 — Persistência
- [ ] Registro gerado em `cnab_remessas_arquivos` com status atualizado
*Status: 🔴 BLOQUEADO*

## Etapa 08 e 09 — Idempotência e Auditoria
- [ ] Proteção contra duplicação de remessas
- [ ] Logs no `audit_log`
*Status: 🔴 BLOQUEADO*

## Etapa 10 e 11 — Banco e UX
- [ ] Validação FEBRABAN Banco do Brasil/Itaú formatada perfeitamente
- [ ] UX do operador amigável.
*Status: 🔴 BLOQUEADO*

---

### RESULTADO
🔴 **NÃO HOMOLOGADO** (Devido à ausência de dados consistentes vindos do CP04 e à crash no Pipeline Operacional por falha de schema).
