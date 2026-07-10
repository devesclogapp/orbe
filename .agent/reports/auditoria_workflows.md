# Auditoria de Workflows (N8N e Edge Functions)
**Data da Auditoria**: 2026-07-10
**Fase**: 09 (Go-Live)
**Tipo**: Relatório de Resiliência

## 1. Topologia de Integração
As integrações do ERP (receber CSVs, buscar dados do TIO, relatórios do RHID e conciliação do Drive) são primordialmente gerenciadas de duas formas: Edge Functions e/ou Workers do Node limitados. A validação anterior da "Architecture Pipeline B" apontou o uso de cron jobs.

## 2. Padrões de Falha e Idempotência
A auditoria foca na idempotência — isto é, se uma edge/function disparar duas vezes (por lentidão de rede), não pode duplicar as entradas.
- **Tolerância a timeout**: Nas automações, foi criado um limite de execução e fallbacks (onde os scripts batem limites restritos para falhar rapidamente ou escalam tempo limite conforme tamanho do lote).
- **Unique Chaves (Idempotency Keys)**: Todo registro em Ponto/Diarista ou Operação possui hash de origem mitigando duplicação via UUID. Mesmo que o n8n ou a EF processe o webhook três vezes, o `ON CONFLICT DO NOTHING` ou UPSERT evita danos à base de homologação.
- **Histórico**: A API alimenta ativamente um registro `historico_importacoes` que possibilita ao operador no painel enxergar sucesso/erro.

## 3. Integrações Mapeadas Auditadas
- O **Workflow A** (Pré-cadastro) manipula apenas inserts com verificação.
- O **Workflow B** (Importação Ponto) trabalha com UUID de integridade de data e hash. Validados na última aprovação E2E.
- O **CNAB/Retorno Bancário**: Trabalha lendo lotes e alterando status, mas não refaz operações em quem já tem 'PAGO'.

**Status**: ✅ O orquestramento apresenta resiliência, e falhas nos workflows (indisponibilidade da API destino) farão retry em escopos controlados sem duplicar no Supabase, garantindo single-source of truth.
