# Checklist de Rastreamento de Status (Intermitentes)
- [x] Etapa 01: Intermitentes Recebidos (Status Atual) mapeado
  * Os lotes na aba "Histórico (Fechados)" com status `ENVIADO_FINANCEIRO` representam que já passaram do RH, também já passaram Pela Central Financeira e estão aguardando o processamento do CNAB no banco.
- [x] Etapa 02: Rastreamento até o Financeiro concluído
  * Operacional (`RECEBIDO`) ↓ Lotes (`EM_ANALISE_RH`) ↓ RH (`APROVADO_RH`) ↓ Financeiro (`ENVIADO_FINANCEIRO` no item e `FECHADO_FINANCEIRO` no lote) -> Central Bancária.
- [x] Etapa 03: Verificação de lote/aprovação no Financeiro
  * Pela existência dos registros `ENVIADO_FINANCEIRO`, a criação e a aprovação no `CentralFinanceira.tsx` procedeu perfeitamente sem interrupções.
- [x] Etapa 04: Verificação na Central Bancária
  * Lotes não aparecem por não existir o filtro selecionado na UI.
- [ ] Etapa 05/06: Determinação exata da interrupção (se houver)
  * A interrupção *não é a nível transacional*. É visual: A rota `CentralBancaria.tsx` se recusa a invocar os registros na função nativa `getByEmpresaParaFinanceiro()` antes que a `empresaId` correta e isolada seja definida pelo usuário e cruzada exatamente com as datas de `competência` aplicadas. O fluxo está íntegro na base, requerendo a devida filtragem UI preenchida.
