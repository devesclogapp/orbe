-- Fix: Remove tables without tenant_id from reset plan
CREATE OR REPLACE FUNCTION public.build_reset_plan(p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
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
            'count_sql', 'SELECT COUNT(*) FROM public.fornecedor_valores_servico fvs WHERE fvs.tenant_id = $1 OR fvs.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = $1) OR fvs.unidade_id IN (SELECT id FROM public.unidades WHERE tenant_id = $1) OR fvs.fornecedor_id IN (SELECT id FROM public.fornecedores WHERE tenant_id = $1) OR fvs.transportadora_id IN (SELECT id FROM public.transportadoras_clientes WHERE tenant_id = $1) OR fvs.produto_carga_id IN (SELECT id FROM public.produtos_carga WHERE tenant_id = $1) OR fvs.tipo_servico_id IN (SELECT id FROM public.tipos_servico_operacional WHERE tenant_id = $1) OR fvs.tipo_regra_id IN (SELECT id FROM public.tipos_regra_operacional WHERE tenant_id = $1) OR fvs.forma_pagamento_id IN (SELECT id FROM public.formas_pagamento_operacional WHERE tenant_id = $1)',
            'delete_sql', 'DELETE FROM public.fornecedor_valores_servico fvs WHERE fvs.tenant_id = $1 OR fvs.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = $1) OR fvs.unidade_id IN (SELECT id FROM public.unidades WHERE tenant_id = $1) OR fvs.fornecedor_id IN (SELECT id FROM public.fornecedores WHERE tenant_id = $1) OR fvs.transportadora_id IN (SELECT id FROM public.transportadoras_clientes WHERE tenant_id = $1) OR fvs.produto_carga_id IN (SELECT id FROM public.produtos_carga WHERE tenant_id = $1) OR fvs.tipo_servico_id IN (SELECT id FROM public.tipos_servico_operacional WHERE tenant_id = $1) OR fvs.tipo_regra_id IN (SELECT id FROM public.tipos_regra_operacional WHERE tenant_id = $1) OR fvs.forma_pagamento_id IN (SELECT id FROM public.formas_pagamento_operacional WHERE tenant_id = $1)'
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
$function$
