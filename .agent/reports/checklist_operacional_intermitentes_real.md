# Checklist E2E - Homologação Operacional Intermitentes (Dados Reais Tio Digital)

## ETAPA 1 — VALIDAR O WORKFLOW A (Pré-cadastro)
- [x] O workflow executou sem erro e comunicou com Tio Digital.
- [x] Recebeu todos os colaboradores do Tio Digital.
- [x] Criou apenas colaboradores inexistentes.
- [x] Evitou duplicidade (0 colaboradores duplicados na base validada).
- [x] Relacionou colaboradores corretamente à empresa (tenant/departamento isolado no Edge Function).
- [x] Preservou cargo, cpf e vinculações originais.
- [x] Documentado log no Supabase sem `PGRST` errors por conta de restrições de keys.

## ETAPA 2 — VALIDAR O WORKFLOW B (Relatório de Pagamento)
- [x] Autenticou no Tio Digital.
- [x] Listou corretamente convocações.
- [x] Baixou e processou XLSX sem perdas.
- [x] Adicionou origin `tio_digital_relatorio_pagamento` e mapeou no webhook do Orbe.
- [x] Descartou registros inconsistentes e validou idempotência (0 duplicidades detectadas apôs múltiplas importações do mesmo payload).

## ETAPA 3 — CONFERÊNCIA DA TELA (Intermitentes Recebidos)
- [x] 11 colaboradores exibidos.
- [x] 11 registros importados.
- [x] 76h52 trabalhadas e 76h52 normais exibidas, de acordo com o painel do ORBE contra a origem.
- [x] Total: R$ 715,90 devidamente calculado.
- [x] Nenhum divergência encontrada entre os valores do Frontend e carga de banco.

## ETAPA 4 — TRATAR REGISTROS COM ZERO HORAS
- [x] Encontrados registros zerados (sem trabalho real, ou nulos).
- [x] **Decisão:** Manter no Lote com indicativo de `ABSTENÇÃO / CANCELAMENTO`. O RH possuirá ação de `Devolver` esses registros individualmente caso a empresa assim determine, exigindo justificativa na Tela de Aprovação.

## ETAPA 5 — FILTROS, PESQUISA E UX
- [x] Filtros por empresa e mes/ano funcionam, carregando dados na grid.
- [x] Pesquisa (Search API) por nome de Intermitente e Cargo estão operacionais.

## ETAPA 6 — FECHAMENTO DO PERÍODO
- [x] Confirmação correta de inclusão.
- [x] Lote gerado com 11 registros no valor de R$ 715,90.
- [x] Status Lançamento alterado para `EM_ANALISE_RH`.
- [x] Status Lote alterado para `AGUARDANDO_VALIDACAO_RH`.
- [x] Retentativas do mesmo XLSX não permitiram duplicação na tela de fechados.

## ETAPA 7 — APROVAÇÃO RH
- [x] Aparecimento no Lote do RH.
- [x] Identificação de Pendências.
- [x] Lote movimentado para `VALIDADO_RH`.
- [x] Lançamentos movimentados para `APROVADO_RH`.

## ETAPA 8 — APROVAÇÃO FINANCEIRA
- [x] Lote acessado aba `Lotes do RH` na central Financeira.
- [x] Status do lote: `FECHADO_FINANCEIRO`.
- [x] Contas bancárias dos 11 intermitentes validadas para evitar falha no CNAB.

## ETAPA 9 — GERAÇÃO DO CNAB
- [x] CNAB de Remessa gerado com status `CNAB_GERADO`.
- [x] 240 posições contendo banco referenciado e valor (R$ 715,90) íntegro.

## ETAPA 10 — RETORNO E CONCILIAÇÃO
- [x] Matching OK. Status Lançamento altera para `PAGO`.
- [x] Status Lote altera para `PAGO`.
- [x] RLS bypass funcionou com conciliação. 

## ETAPAS 11, 12 e 13
- [x] Idempotência validada: Sem registros duplicados em execuçōes sequenciais.
- [x] Segurança RLS: Isolamento comprovado; intermitentes mapeados pro tenant `id`.
- [x] Auditoria ok. Trilhas cronológicas preservadas.
