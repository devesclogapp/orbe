# Auditoria de Fluxos ERP Orbe - Raio-X Técnico

## 1. Fluxo: Operação por Volume (Produção)

### Inconsistências Detectadas

| Tela | Fluxo | Dado Esperado | Dado Exibido | Causa Raiz | Gravidade |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Operacional / Painel | Lançamento Manual | Observação | Vazio | `getDisplayObservacao` não lê `item.observacao` (só `contexto_importacao`). | Crítico |
| Operacional / Painel | Lançamento Manual | Forma de Pagamento | Vazio / Errado | Alias `formas_pagamento_operacional` no Service vs Expectativa `forma_pagamento` no Mapper. | Crítico |
| Operacional / Painel | Geral | Valor Total (Dia) | Zero / Incorreto | Inconsistência entre `item.valor_total`, `item.total_final` e `item.valDia`. | Mediano |
| Operacional / Painel | Legado | Forma de Pagamento | Vazio | Falta de Join na query `getAllPainel` para a tabela legada `operacoes`. | Regular |

### Detalhes Técnicos

#### Bug de Observação
No arquivo [OperacoesTableBlock.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/OperacoesTableBlock.tsx), a função `getDisplayObservacao` ignora o campo raiz:
```typescript
const getDisplayObservacao = (item: Record<string, unknown>) =>
  getContextoImportacaoValue(item, "observacao") ??
  getLinhaOriginalValue(item, "OBSERVACAO", "OBSERVAÇÃO") ??
  ""; // Falta item.observacao aqui!
```

#### Bug de Forma de Pagamento
No arquivo [base.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/base.service.ts), a query de `OperacaoProducaoService.getAll` usa o alias `formas_pagamento_operacional`.
No entanto, o mapper `processarOperacao` em [financeiro.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/utils/financeiro.ts) espera `operacao.forma_pagamento?.nome`.

---

## 2. Próximos Passos da Auditoria
- [ ] Validar fluxos de Custos Extras.
- [ ] Validar fluxos de Serviços Extras.
- [ ] Validar fluxos de Diaristas.
- [ ] Validar integração com Dashboard Financeiro.
