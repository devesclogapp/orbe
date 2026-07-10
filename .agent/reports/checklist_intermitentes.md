# ✅ CHECKLIST E2E: DOMÍNIO INTERMITENTES

**Fase:** Homologação Funcional Completa  
**Status:** HOMOLOGADO  
**Data:** 10 de Julho de 2026  

## ETAPA 4.1 — IMPORTAÇÃO
- [x] Recebimento dos dados via POST 
- [x] Criação de `lancamentos_intermitentes`
- [x] Idempotência (upsert sem duplicação ou fallback inteligente)
- [x] Preenchimento correto de Empresa via lookup/fallback
- [x] Preenchimento correto de `tenant_id`
- [x] Inserção da coluna crítica `cpf_colaborador`
- [x] Status Inicial como `RECEBIDO`
- [x] Re-processamento seguro (registros já analisados/no pipeline são blindados contra updates destrutivos da Edge Function)

## ETAPA 4.2 — INTERMITENTES RECEBIDOS (TELA)
- [x] Carregamento seguro da rota `/operacional/intermitentes`
- [x] Link presente e acessível na Sidebar (`processamento_rh`)
- [x] Filtros, KPIs e paginação responsivos aos lançamentos do tenant corrente (isolamento de RLS garantido na tela)
- [x] Renderização integral (CPFs/Empresas vinculadas preenchidos) e Badges de status (RECEBIDO, EM_ANALISE etc) funcionais. 

## ETAPA 4.3 — FECHAMENTO DE PERÍODO
- [x] Seleção de Múltiplos Registros `RECEBIDO`
- [x] Agrupamento correto na respectiva `competencia` e `empresa_id`
- [x] Lote criado (`intermitentes_lotes_fechamento`) em status `AGUARDANDO_VALIDACAO_RH`
- [x] Lançamentos em `lancamentos_intermitentes` transacionados para `EM_ANALISE_RH`
- [x] Bloqueio UI: Apenas lançamentos `RECEBIDO` são selecionáveis para o Botão "Fechar Período".

## ETAPA 4.4 — APROVAÇÃO RH
- [x] União perfeita com a fila de RH (`vw_aprovacoes_rh`) 
- [x] Separação visível pelo tipo `"INTERMITENTE"`
- [x] Aprovação correta (Lote -> `VALIDADO_RH`, Lançamento -> `APROVADO_RH`)
- [x] Devolução coerente e fluxo de correção operante
- [x] Justificativas implementadas 

## ETAPA 4.5 — APROVAÇÃO FINANCEIRA
- [x] Vizibilidade correta na aba Lotes RH (Filtrado por `"INTERMITENTE"` no hook de financeiro)
- [x] Trigger manual via botão na UI de Central Financeira 
- [x] Lote escalado para status firme -> `FECHADO_FINANCEIRO`
- [x] Lançamento reflete `ENVIADO_FINANCEIRO`

## ETAPA 4.6 & ETAPA 4.7 — INTEGRAÇÃO BANCÁRIA (CNAB/RET)
- [x] Arquivo CNAB (.rem) gerado usando dados dos lançamentos agregados por CPF (cpf_colaborador) 
- [x] Remessa gerada sem quebrar `faturas_bancarias` genéricas, utilizando `intermitentes_lotes_fechamento` como origem. 
- [x] CNAB lê agência e contas do cadastro atualizado via Supabase
- [x] Status Lote -> `CNAB_GERADO`
- [x] Parsing de .ret cruza arquivo por CPF correspondente e intermitentes_lote_id 

## ETAPA 4.8 — CONCILIAÇÃO
- [x] Baixa Automática atualiza rigorosamente para `PAGO`
- [x] Bug do CHECK constraint anulado via Migration. Ambas as entidades Lote e Lançamentos aceitam o novo State `PAGO`.

## ETAPA 4.9 — SEGURANÇA E TENANTS (RLS)
- [x] Políticas de RLS reforçadas (`using (tenant_id = current_tenant_id())`) verificadas nativamente
- [x] Edge function executa em _Service Role_ para ingestão bypass, mas salva o tenant explicitamente
- [x] Intersecção impossível entre Tenants na interface. Isolamento provado!

## ETAPA 4.10 / ETAPA 4.11 — AUDITORIA E RESILIÊNCIA
- [x] Histórico persistido (`historico_importacoes`)
- [x] Idempotência comprovada no processamento múltiplo
- [x] Operações são temporais e autorais

**PARECER CHECKLIST:** Todos os nós funcionais estruturados para processamento e repasse financeiro estão de pé e estáveis! 🚀 
