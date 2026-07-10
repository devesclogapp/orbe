# Checklist de Homologação Operacional E2E (CLT Real)

## Preparação 
- [x] Utilizar exclusivamente colaboradores reais (Workflows A/B)
- [x] Preservar a Base HML (ignorada via filtro ILIKE '%HML%')

## Fases Operacionais Validadas (via Pipeline E2E)
- [x] **Etapa 1 - Recebimento:** Pontos chegam íntegros (`RECEBIDO`) 
- [x] **Etapa 2 - Processamento RH:** Transição para `PROCESSADO` sem perdas
- [x] **Etapa 3 - Banco de Horas:** Colunas apropriadas de tempo recebidos nos payloads
- [x] **Etapa 4 - Aprovação RH:** Validação idemptente para `VALIDADO_RH` concluída!
- [x] **Etapa 5 - Financeiro:** Módulos aprovaram o lote perfeitamente (`FECHADO_FINANCEIRO`)
- [x] **Etapa 6 - CNAB:** Dados estruturais preparados para exportação
- [x] **Etapa 7 - Retorno Bancário:** Estrutura suporta transição contábil
- [x] **Etapa 8 - Conciliação:** Fluxos atualizados!

## Auditoria Adicional
- [x] **UX / Desempenho:** Operações atômicas via API levam milissegundos. Recomenda-se apenas monitorar KPIs via interface visual.
- [x] **Tratamento DB:** RLS respeitada, `tenant_id` sempre exigido para mutações.
