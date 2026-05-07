BEGIN;

-- ============================================================
-- FASE 9.1 - Reset Ambiente Demo / Homologacao Controlada
-- Objetivo:
--   1. Adicionar quarto nivel de reset para demo/homologacao
--   2. Preservar apenas estrutura sistemica, usuarios e auditoria estrutural
--   3. Integrar auditoria central, workflow e governanca executiva
-- ============================================================

ALTER TABLE public.auditoria_reset_operacional
  DROP CONSTRAINT IF EXISTS auditoria_reset_operacional_tipo_reset_check;

ALTER TABLE public.auditoria_reset_operacional
  ADD CONSTRAINT auditoria_reset_operacional_tipo_reset_check
  CHECK (
    tipo_reset IN (
      'RESET_OPERACIONAL',
      'RESET_FINANCEIRO',
      'RESET_COMPLETO_TENANT',
      'RESET_AMBIENTE_DEMO'
    )
  );

DROP FUNCTION IF EXISTS public.reset_demo_environment_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.reset_completo_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.reset_financeiro_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.reset_operacional_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.run_tenant_reset(TEXT, UUID, TEXT, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.get_reset_mode_metadata(TEXT);

CREATE OR REPLACE FUNCTION public.get_reset_mode_metadata(p_mode TEXT)
RETURNS TABLE (
  mode_key TEXT,
  mode_audit_label TEXT,
  expected_confirmation TEXT,
  workflow_stage TEXT,
  human_label TEXT,
  corporate_event TEXT
) AS $$
BEGIN
  CASE upper(COALESCE(p_mode, ''))
    WHEN 'OPERACIONAL' THEN
      RETURN QUERY
      SELECT
        'operacional'::text,
        'RESET_OPERACIONAL'::text,
        'DIGITE RESET OPERACIONAL'::text,
        'OPERACIONAL'::text,
        'Reset Operacional'::text,
        'RESET_OPERACIONAL_EXECUTADO'::text;
    WHEN 'FINANCEIRO' THEN
      RETURN QUERY
      SELECT
        'financeiro'::text,
        'RESET_FINANCEIRO'::text,
        'DIGITE RESET FINANCEIRO'::text,
        'FINANCEIRO'::text,
        'Reset Financeiro'::text,
        'RESET_FINANCEIRO_EXECUTADO'::text;
    WHEN 'COMPLETO' THEN
      RETURN QUERY
      SELECT
        'completo'::text,
        'RESET_COMPLETO_TENANT'::text,
        'DIGITE RESET COMPLETO'::text,
        'SISTEMA'::text,
        'Reset Completo do Tenant'::text,
        'RESET_COMPLETO_EXECUTADO'::text;
    WHEN 'DEMO' THEN
      RETURN QUERY
      SELECT
        'demo'::text,
        'RESET_AMBIENTE_DEMO'::text,
        'RESET AMBIENTE DEMO'::text,
        'SISTEMA'::text,
        'Reset Ambiente Demo'::text,
        'RESET_DEMO_EXECUTADO'::text;
    ELSE
      RAISE EXCEPTION 'Modo de reset invalido: %', p_mode;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.build_reset_plan(p_mode TEXT)
RETURNS JSONB AS $$
DECLARE
  v_plan JSONB;
BEGIN
  CASE upper(COALESCE(p_mode, ''))
    WHEN 'OPERACIONAL' THEN
      v_plan := jsonb_build_array(
        jsonb_build_object(
          'table_name', 'processamento_rh_inconsistencias',
          'category_key', 'operacional',
          'delete_priority', 10,
          'descricao', 'Inconsistencias do processamento RH',
          'count_sql', 'SELECT COUNT(*) FROM public.processamento_rh_inconsistencias WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.processamento_rh_inconsistencias WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'processamento_rh_logs',
          'category_key', 'operacional',
          'delete_priority', 20,
          'descricao', 'Logs transitorios do processamento RH',
          'count_sql', 'SELECT COUNT(*) FROM public.processamento_rh_logs WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.processamento_rh_logs WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'resultados_processamento',
          'category_key', 'operacional',
          'delete_priority', 30,
          'descricao', 'Memoria transitoria de processamento',
          'count_sql', 'SELECT COUNT(*) FROM public.resultados_processamento WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.resultados_processamento WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'motor_auditoria_logs',
          'category_key', 'operacional',
          'delete_priority', 40,
          'descricao', 'Memoria transitoria do motor operacional',
          'count_sql', 'SELECT COUNT(*) FROM public.motor_auditoria_logs WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.motor_auditoria_logs WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'banco_horas_eventos',
          'category_key', 'operacional',
          'delete_priority', 50,
          'descricao', 'Eventos do banco de horas',
          'count_sql', 'SELECT COUNT(*) FROM public.banco_horas_eventos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.banco_horas_eventos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'banco_horas_saldos',
          'category_key', 'operacional',
          'delete_priority', 60,
          'descricao', 'Saldos acumulados do banco de horas',
          'count_sql', 'SELECT COUNT(*) FROM public.banco_horas_saldos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.banco_horas_saldos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'fechamento_mensal',
          'category_key', 'operacional',
          'delete_priority', 70,
          'descricao', 'Fechamentos mensais de RH',
          'count_sql', 'SELECT COUNT(*) FROM public.fechamento_mensal WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.fechamento_mensal WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'ciclos_operacionais',
          'category_key', 'operacional',
          'delete_priority', 80,
          'descricao', 'Ciclos operacionais e workflow transitorio',
          'count_sql', 'SELECT COUNT(*) FROM public.ciclos_operacionais WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.ciclos_operacionais WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'ciclos_diaristas',
          'category_key', 'operacional',
          'delete_priority', 90,
          'descricao', 'Ciclos operacionais de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.ciclos_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.ciclos_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'production_entry_collaborators',
          'category_key', 'operacional',
          'delete_priority', 100,
          'descricao', 'Colaboradores vinculados nas entradas de producao',
          'count_sql', 'SELECT COUNT(*) FROM public.production_entry_collaborators pec WHERE EXISTS (SELECT 1 FROM public.operacoes_producao op WHERE op.id = pec.production_entry_id AND op.tenant_id = $1)',
          'delete_sql', 'DELETE FROM public.production_entry_collaborators pec WHERE EXISTS (SELECT 1 FROM public.operacoes_producao op WHERE op.id = pec.production_entry_id AND op.tenant_id = $1)'
        ),
        jsonb_build_object(
          'table_name', 'operacoes_producao',
          'category_key', 'operacional',
          'delete_priority', 110,
          'descricao', 'Lancamentos de producao',
          'count_sql', 'SELECT COUNT(*) FROM public.operacoes_producao WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.operacoes_producao WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lancamentos_diaristas',
          'category_key', 'operacional',
          'delete_priority', 120,
          'descricao', 'Lancamentos diarios de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.lancamentos_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lancamentos_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'diaristas_lotes_fechamento',
          'category_key', 'operacional',
          'delete_priority', 130,
          'descricao', 'Lotes de fechamento de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.diaristas_lotes_fechamento WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.diaristas_lotes_fechamento WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'operacoes',
          'category_key', 'operacional',
          'delete_priority', 140,
          'descricao', 'Operacoes recebidas legadas',
          'count_sql', 'SELECT COUNT(*) FROM public.operacoes WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.operacoes WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'custos_extras_operacionais',
          'category_key', 'operacional',
          'delete_priority', 150,
          'descricao', 'Custos extras operacionais',
          'count_sql', 'SELECT COUNT(*) FROM public.custos_extras_operacionais WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.custos_extras_operacionais WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'registros_ponto',
          'category_key', 'operacional',
          'delete_priority', 160,
          'descricao', 'Registros de ponto recebidos',
          'count_sql', 'SELECT COUNT(*) FROM public.registros_ponto WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.registros_ponto WHERE tenant_id = $1'
        )
      );
    WHEN 'FINANCEIRO' THEN
      v_plan := jsonb_build_array(
        jsonb_build_object(
          'table_name', 'financeiro_conciliacoes',
          'category_key', 'financeiro',
          'delete_priority', 210,
          'descricao', 'Conciliacoes financeiras',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_conciliacoes WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_conciliacoes WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_retorno_itens',
          'category_key', 'financeiro',
          'delete_priority', 220,
          'descricao', 'Itens de retorno CNAB',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_retorno_itens WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_retorno_itens WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_retorno_arquivos',
          'category_key', 'financeiro',
          'delete_priority', 230,
          'descricao', 'Arquivos de retorno CNAB',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_retorno_arquivos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_retorno_arquivos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_remessas_arquivos',
          'category_key', 'financeiro',
          'delete_priority', 240,
          'descricao', 'Arquivos de remessa CNAB',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_remessas_arquivos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_remessas_arquivos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lote_pagamento_itens',
          'category_key', 'financeiro',
          'delete_priority', 250,
          'descricao', 'Itens de lote de pagamento',
          'count_sql', 'SELECT COUNT(*) FROM public.lote_pagamento_itens WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lote_pagamento_itens WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lote_pagamento_diaristas',
          'category_key', 'financeiro',
          'delete_priority', 260,
          'descricao', 'Lotes de pagamento de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.lote_pagamento_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lote_pagamento_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lotes_remessa',
          'category_key', 'financeiro',
          'delete_priority', 270,
          'descricao', 'Lotes de remessa',
          'count_sql', 'SELECT COUNT(*) FROM public.lotes_remessa WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lotes_remessa WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'faturas',
          'category_key', 'financeiro',
          'delete_priority', 280,
          'descricao', 'Faturas geradas pelo motor financeiro',
          'count_sql', 'SELECT COUNT(*) FROM public.faturas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.faturas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_calculos_memoria',
          'category_key', 'financeiro',
          'delete_priority', 290,
          'descricao', 'Memoria de calculo financeiro',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_calculos_memoria WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_calculos_memoria WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_consolidados_cliente',
          'category_key', 'financeiro',
          'delete_priority', 300,
          'descricao', 'Consolidados financeiros por cliente',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_consolidados_cliente WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_consolidados_cliente WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_consolidados_colaborador',
          'category_key', 'financeiro',
          'delete_priority', 310,
          'descricao', 'Consolidados financeiros por colaborador',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_consolidados_colaborador WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_consolidados_colaborador WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lancamentos_financeiros',
          'category_key', 'financeiro',
          'delete_priority', 320,
          'descricao', 'Lancamentos financeiros transacionais',
          'count_sql', 'SELECT COUNT(*) FROM public.lancamentos_financeiros WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lancamentos_financeiros WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lancamentos_adicionais_diaristas',
          'category_key', 'financeiro',
          'delete_priority', 330,
          'descricao', 'Ajustes financeiros adicionais de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.lancamentos_adicionais_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lancamentos_adicionais_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_competencias',
          'category_key', 'financeiro',
          'delete_priority', 340,
          'descricao', 'Competencias financeiras transitorias',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_competencias WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_competencias WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_sequencial_controle',
          'category_key', 'financeiro',
          'delete_priority', 350,
          'descricao', 'Memoria de sequencial CNAB por tenant',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_sequencial_controle WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_sequencial_controle WHERE tenant_id = $1'
        )
      );
    WHEN 'COMPLETO' THEN
      v_plan := public.build_reset_plan('OPERACIONAL') || public.build_reset_plan('FINANCEIRO');
    WHEN 'DEMO' THEN
      v_plan :=
        public.build_reset_plan('OPERACIONAL')
        || public.build_reset_plan('FINANCEIRO')
        || jsonb_build_array(
          jsonb_build_object(
            'table_name', 'cnab_auditoria_bancaria',
            'category_key', 'financeiro',
            'delete_priority', 205,
            'descricao', 'Auditoria bancaria operacional de CNAB',
            'count_sql', 'SELECT COUNT(*) FROM public.cnab_auditoria_bancaria WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.cnab_auditoria_bancaria WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'logs_sincronizacao',
            'category_key', 'operacional',
            'delete_priority', 165,
            'descricao', 'Logs transitorios de sincronizacao',
            'count_sql', 'SELECT COUNT(*) FROM public.logs_sincronizacao WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.logs_sincronizacao WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'operation_audit',
            'category_key', 'operacional',
            'delete_priority', 166,
            'descricao', 'Auditoria residual de operacoes',
            'count_sql', 'SELECT COUNT(*) FROM public.operation_audit WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.operation_audit WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'ponto_audit',
            'category_key', 'operacional',
            'delete_priority', 167,
            'descricao', 'Auditoria residual de ponto',
            'count_sql', 'SELECT COUNT(*) FROM public.ponto_audit WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.ponto_audit WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'ponto',
            'category_key', 'operacional',
            'delete_priority', 168,
            'descricao', 'Base legada de ponto',
            'count_sql', 'SELECT COUNT(*) FROM public.ponto WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.ponto WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'fornecedor_valores_servico',
            'category_key', 'cadastros',
            'delete_priority', 410,
            'descricao', 'Regras operacionais por fornecedor e servico',
            'count_sql', 'SELECT COUNT(*) FROM public.fornecedor_valores_servico WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.fornecedor_valores_servico WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'regras_dados',
            'category_key', 'cadastros',
            'delete_priority', 420,
            'descricao', 'Parametros dinamicos operacionais',
            'count_sql', 'SELECT COUNT(*) FROM public.regras_dados WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.regras_dados WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'regras_campos',
            'category_key', 'cadastros',
            'delete_priority', 430,
            'descricao', 'Campos configuraveis dos modulos',
            'count_sql', 'SELECT COUNT(*) FROM public.regras_campos WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.regras_campos WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'regras_modulos',
            'category_key', 'cadastros',
            'delete_priority', 440,
            'descricao', 'Modulos configuraveis por tenant',
            'count_sql', 'SELECT COUNT(*) FROM public.regras_modulos WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.regras_modulos WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'banco_horas_regras',
            'category_key', 'cadastros',
            'delete_priority', 450,
            'descricao', 'Regras de banco de horas',
            'count_sql', 'SELECT COUNT(*) FROM public.banco_horas_regras WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.banco_horas_regras WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'regras_marcacao_diaristas',
            'category_key', 'cadastros',
            'delete_priority', 460,
            'descricao', 'Regras de marcacao de diaristas',
            'count_sql', 'SELECT COUNT(*) FROM public.regras_marcacao_diaristas WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.regras_marcacao_diaristas WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'regras_fechamento',
            'category_key', 'cadastros',
            'delete_priority', 470,
            'descricao', 'Parametros de ciclos e fechamento de diaristas',
            'count_sql', 'SELECT COUNT(*) FROM public.regras_fechamento WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.regras_fechamento WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'contas_bancarias_empresa',
            'category_key', 'cadastros',
            'delete_priority', 480,
            'descricao', 'Contas bancarias operacionais da empresa',
            'count_sql', 'SELECT COUNT(*) FROM public.contas_bancarias_empresa WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.contas_bancarias_empresa WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'coletores',
            'category_key', 'cadastros',
            'delete_priority', 490,
            'descricao', 'Coletores cadastrados',
            'count_sql', 'SELECT COUNT(*) FROM public.coletores WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.coletores WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'produtos_carga',
            'category_key', 'cadastros',
            'delete_priority', 500,
            'descricao', 'Produtos de carga vinculados a fornecedores',
            'count_sql', 'SELECT COUNT(*) FROM public.produtos_carga WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.produtos_carga WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'fornecedores',
            'category_key', 'cadastros',
            'delete_priority', 510,
            'descricao', 'Fornecedores operacionais',
            'count_sql', 'SELECT COUNT(*) FROM public.fornecedores WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.fornecedores WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'transportadoras_clientes',
            'category_key', 'cadastros',
            'delete_priority', 520,
            'descricao', 'Transportadoras operacionais',
            'count_sql', 'SELECT COUNT(*) FROM public.transportadoras_clientes WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.transportadoras_clientes WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'tipos_servico_operacional',
            'category_key', 'cadastros',
            'delete_priority', 530,
            'descricao', 'Catalogo de servicos operacionais',
            'count_sql', 'SELECT COUNT(*) FROM public.tipos_servico_operacional WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.tipos_servico_operacional WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'formas_pagamento_operacional',
            'category_key', 'cadastros',
            'delete_priority', 540,
            'descricao', 'Formas de pagamento operacionais',
            'count_sql', 'SELECT COUNT(*) FROM public.formas_pagamento_operacional WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.formas_pagamento_operacional WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'tipos_regra_operacional',
            'category_key', 'cadastros',
            'delete_priority', 550,
            'descricao', 'Tipos de regra operacional',
            'count_sql', 'SELECT COUNT(*) FROM public.tipos_regra_operacional WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.tipos_regra_operacional WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'unidades',
            'category_key', 'cadastros',
            'delete_priority', 560,
            'descricao', 'Unidades operacionais por empresa',
            'count_sql', 'SELECT COUNT(*) FROM public.unidades WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.unidades WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'colaboradores',
            'category_key', 'cadastros',
            'delete_priority', 570,
            'descricao', 'Colaboradores e diaristas do tenant',
            'count_sql', 'SELECT COUNT(*) FROM public.colaboradores WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.colaboradores WHERE tenant_id = $1'
          ),
          jsonb_build_object(
            'table_name', 'empresas',
            'category_key', 'cadastros',
            'delete_priority', 580,
            'descricao', 'Empresas operacionais do tenant',
            'count_sql', 'SELECT COUNT(*) FROM public.empresas WHERE tenant_id = $1',
            'delete_sql', 'DELETE FROM public.empresas WHERE tenant_id = $1'
          )
        );
    ELSE
      RAISE EXCEPTION 'Modo de reset invalido: %', p_mode;
  END CASE;

  RETURN v_plan;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.run_tenant_reset(
  p_mode TEXT,
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_mode_key TEXT;
  v_mode_audit_label TEXT;
  v_expected_confirmation TEXT;
  v_workflow_stage TEXT;
  v_human_label TEXT;
  v_corporate_event TEXT;
  v_actor_user_id UUID := auth.uid();
  v_actor_tenant_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_plan JSONB;
  v_step JSONB;
  v_count BIGINT;
  v_deleted BIGINT;
  v_total BIGINT := 0;
  v_items JSONB := '[]'::jsonb;
  v_observacao TEXT;
  v_request_ip TEXT;
  v_audit_reset_id UUID;
  v_competencia_snapshot TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  v_snapshot_requested BOOLEAN := COALESCE((p_request_context ->> 'snapshot_requested')::BOOLEAN, FALSE);
  v_auditoria_detalhes JSONB;
  v_auditoria_sql TEXT;
BEGIN
  SELECT
    mode_key,
    mode_audit_label,
    expected_confirmation,
    workflow_stage,
    human_label,
    corporate_event
  INTO
    v_mode_key,
    v_mode_audit_label,
    v_expected_confirmation,
    v_workflow_stage,
    v_human_label,
    v_corporate_event
  FROM public.get_reset_mode_metadata(p_mode);

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT
    p.tenant_id,
    lower(COALESCE(p.role, '')),
    COALESCE(NULLIF(BTRIM(COALESCE(p.full_name, '')), ''), 'Administrador do Tenant'),
    COALESCE(NULLIF(BTRIM(COALESCE(p_request_context ->> 'user_email', '')), ''), p_request_context ->> 'email')
  INTO
    v_actor_tenant_id,
    v_actor_role,
    v_actor_name,
    v_actor_email
  FROM public.profiles p
  WHERE p.user_id = v_actor_user_id
    AND p.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_actor_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido para o usuario autenticado.';
  END IF;

  IF v_actor_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Apenas admin ou super_admin podem executar este reset.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant informado nao existe.';
  END IF;

  IF NOT p_preview_only THEN
    IF NULLIF(BTRIM(COALESCE(p_justificativa, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Justificativa obrigatoria para executar o reset.';
    END IF;

    IF BTRIM(COALESCE(p_confirmacao, '')) <> v_expected_confirmation THEN
      RAISE EXCEPTION 'Confirmacao textual invalida. Esperado: %', v_expected_confirmation;
    END IF;
  END IF;

  v_plan := public.build_reset_plan(v_mode_key);

  FOR v_step IN
    SELECT value
    FROM jsonb_array_elements(v_plan)
    ORDER BY (value->>'delete_priority')::int ASC
  LOOP
    IF to_regclass(format('public.%I', v_step ->> 'table_name')) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE v_step ->> 'count_sql'
      INTO v_count
      USING p_tenant_id;

    v_total := v_total + COALESCE(v_count, 0);

    IF NOT p_preview_only AND COALESCE(v_count, 0) > 0 THEN
      EXECUTE v_step ->> 'delete_sql'
        USING p_tenant_id;

      GET DIAGNOSTICS v_deleted = ROW_COUNT;
    ELSE
      v_deleted := COALESCE(v_count, 0);
    END IF;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'tabela', v_step ->> 'table_name',
        'descricao', v_step ->> 'descricao',
        'categoria', COALESCE(v_step ->> 'category_key', 'operacional'),
        'registros', COALESCE(v_deleted, 0)
      )
    );
  END LOOP;

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'preview_only', TRUE,
      'mode', v_mode_key,
      'tipo_reset', v_mode_audit_label,
      'confirmation_phrase', v_expected_confirmation,
      'total_registros', v_total,
      'tabelas', v_items
    );
  END IF;

  v_request_ip := public.get_reset_request_ip();
  v_observacao := format(
    '%s executado por %s. %s registro(s) removido(s).',
    v_human_label,
    v_actor_name,
    v_total
  );

  INSERT INTO public.auditoria_reset_operacional (
    tenant_id,
    usuario_id,
    usuario_nome,
    tipo_reset,
    justificativa,
    tabelas_afetadas,
    total_registros_removidos,
    request_ip,
    request_context
  )
  VALUES (
    p_tenant_id,
    v_actor_user_id,
    v_actor_name,
    v_mode_audit_label,
    BTRIM(COALESCE(p_justificativa, '')),
    v_items,
    v_total::INTEGER,
    v_request_ip,
    COALESCE(p_request_context, '{}'::jsonb)
  )
  RETURNING id INTO v_audit_reset_id;

  IF to_regclass('public.auditoria') IS NOT NULL THEN
    v_auditoria_detalhes := jsonb_build_object(
      'modo', CASE WHEN v_mode_key = 'demo' THEN 'reset_demo' ELSE v_mode_key END,
      'tipo_reset', v_mode_audit_label,
      'usuario_id', v_actor_user_id,
      'usuario_nome', v_actor_name,
      'usuario_email', v_actor_email,
      'tenant_id', p_tenant_id,
      'request_ip', v_request_ip,
      'request_context', COALESCE(p_request_context, '{}'::jsonb),
      'justificativa', BTRIM(COALESCE(p_justificativa, '')),
      'snapshot_requested', v_snapshot_requested,
      'total_registros_removidos', v_total,
      'tabelas_afetadas', v_items,
      'referencia_reset_id', v_audit_reset_id
    );

    v_auditoria_sql := 'INSERT INTO public.auditoria (';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'auditoria'
        AND column_name = 'tenant_id'
    ) THEN
      v_auditoria_sql := v_auditoria_sql || 'tenant_id, ';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'auditoria'
        AND column_name = 'user_id'
    ) THEN
      v_auditoria_sql := v_auditoria_sql || 'user_id, ';
    END IF;

    v_auditoria_sql := v_auditoria_sql || 'acao, modulo, impacto, detalhes) VALUES (';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'auditoria'
        AND column_name = 'tenant_id'
    ) THEN
      v_auditoria_sql := v_auditoria_sql || quote_nullable(p_tenant_id) || ', ';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'auditoria'
        AND column_name = 'user_id'
    ) THEN
      v_auditoria_sql := v_auditoria_sql || quote_nullable(v_actor_user_id) || ', ';
    END IF;

    v_auditoria_sql := v_auditoria_sql
      || quote_literal(v_corporate_event) || ', '
      || quote_literal('MANUTENCAO_AMBIENTE') || ', '
      || quote_literal('critico') || ', '
      || quote_literal(v_auditoria_detalhes::TEXT) || '::jsonb)';

    EXECUTE v_auditoria_sql;
  END IF;

  IF to_regclass('public.auditoria_workflow_ciclos') IS NOT NULL THEN
    INSERT INTO public.auditoria_workflow_ciclos (
      tenant_id,
      ciclo_id,
      usuario_id,
      etapa,
      acao,
      observacao,
      user_name,
      user_email,
      competencia_snapshot,
      referencia_reset_id
    )
    VALUES (
      p_tenant_id,
      NULL,
      v_actor_user_id,
      v_workflow_stage,
      'RESET',
      v_observacao
        || ' Evento: ' || v_corporate_event
        || '. Snapshot solicitado: ' || CASE WHEN v_snapshot_requested THEN 'sim' ELSE 'nao' END
        || '. Justificativa: ' || BTRIM(COALESCE(p_justificativa, '')),
      v_actor_name,
      v_actor_email,
      v_competencia_snapshot,
      v_audit_reset_id
    );
  END IF;

  RETURN jsonb_build_object(
    'preview_only', FALSE,
    'mode', v_mode_key,
    'tipo_reset', v_mode_audit_label,
    'confirmation_phrase', v_expected_confirmation,
    'total_registros', v_total,
    'tabelas', v_items,
    'audit_id', v_audit_reset_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_demo_environment_tenant(
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.run_tenant_reset(
    'DEMO',
    p_tenant_id,
    p_justificativa,
    p_confirmacao,
    p_preview_only,
    p_request_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_operacional_tenant(
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.run_tenant_reset(
    'OPERACIONAL',
    p_tenant_id,
    p_justificativa,
    p_confirmacao,
    p_preview_only,
    p_request_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_financeiro_tenant(
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.run_tenant_reset(
    'FINANCEIRO',
    p_tenant_id,
    p_justificativa,
    p_confirmacao,
    p_preview_only,
    p_request_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_completo_tenant(
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.run_tenant_reset(
    'COMPLETO',
    p_tenant_id,
    p_justificativa,
    p_confirmacao,
    p_preview_only,
    p_request_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reset_operacional_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_financeiro_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_completo_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_environment_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

COMMIT;
