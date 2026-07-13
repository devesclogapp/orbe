# RELATÓRIO: REVALIDAÇÃO LOTES INTERMITENTES

## 1. Revalidação Funcional pela Interface (ETAPA 08)

O script SQL de reparação (`.agent/scripts/repara_lote_6e9b5afc.sql`) retroagiu os novos lotes e os respectivos sub-lançamentos para os status adequados na pipeline:
- **Lote Fechamento:** `AGUARDANDO_VALIDACAO_RH`
- **Lançamentos:** `EM_ANALISE_RH`

Assim que o reparo for executado no PostgREST BD, siga as instruções diretas:

- [ ] Acesse a interface **Aprovação RH**.
- [ ] Confirme a aparição de *3 novos lotes*.
- [ ] Realize a aprovação deles com sucesso na Interface.
- [ ] Acesse **Painel Financeiro** ou **Aprovação Financeira**.
- [ ] Garanta que os 3 lotes agora estão independentes, isolados sob respectiva `empresa_id` válida e atinjam o status `FECHADO_FINANCEIRO`.
- [ ] Central Bancária / CNAB: Abra o seletor da Empresa, escolha a competência respectiva e assinale o lote desmembrado.
- [ ] O lote deve carregar os valores idênticos aos distribuídos no script gerado em Log.

### Estado Final Esperado
```text
3 lotes
cada um com empresa válida
status FECHADO_FINANCEIRO
visíveis na Central Bancária
```

---

## 2. Regressão (ETAPA 09)

Confirmar de forma focalizada (não destrutiva) no ERP que a correção isolada não gerou regressão paralela nas demais pipelines, pois a alteração foi exclusivamente voltada para intermitentes.

- [ ] **CLT e Ponto Manual:** Funcionamento íntegro na importação diária.
- [ ] **Diaristas:** Fechamento de semana continua gerando Lote.
- [ ] **Serviços / Custos Extras:** Lançamento não afetado.
- [ ] **Operações por Volume:** Funcionamento intocado.
- [ ] **Aprovações RH e Financeiro:** Continua processando fluxos normalmente.
- [ ] **CNAB BB/Itaú:** Geração e layout preservados de forma agnóstica.
- [ ] **Auditoria e RLS:** Usuários com diferentes Tenants continuam isolados em suas fatias devido ao novo Grouping por `tenantId` e reforço nas Policies já existentes.
