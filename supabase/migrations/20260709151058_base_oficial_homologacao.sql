-- =========================================================================================
-- BASE OFICIAL DE HOMOLOGAÇÃO CLT
-- Migration para criar ambiente de testes E2E seguro (isolado da produção)
-- Data: 2026-07-09
-- =========================================================================================

-- 1. ADICIONAR COLUNA IS_TESTE NAS TABELAS PRINCIPAIS ======================================
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS is_teste BOOLEAN DEFAULT false;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS is_teste BOOLEAN DEFAULT false;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS is_teste BOOLEAN DEFAULT false;
ALTER TABLE public.banco_horas_eventos ADD COLUMN IF NOT EXISTS is_teste BOOLEAN DEFAULT false;
ALTER TABLE public.banco_horas_saldos ADD COLUMN IF NOT EXISTS is_teste BOOLEAN DEFAULT false;
ALTER TABLE public.resultados_processamento ADD COLUMN IF NOT EXISTS is_teste BOOLEAN DEFAULT false;

-- Índices para melhorar a performance de consultas com filtro is_teste
CREATE INDEX IF NOT EXISTS idx_empresas_is_teste ON public.empresas(is_teste);
CREATE INDEX IF NOT EXISTS idx_colaboradores_is_teste ON public.colaboradores(is_teste);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_is_teste ON public.registros_ponto(is_teste);

-- 2. POPULAR MASSA DE DADOS FICÍTIA DE HOMOLOGAÇÃO =========================================
DO $$
DECLARE
  v_tenant_id UUID;
  v_empresa_id UUID;
  v_c1 UUID := gen_random_uuid(); -- Normal
  v_c2 UUID := gen_random_uuid(); -- Extra
  v_c3 UUID := gen_random_uuid(); -- Atraso
  v_c4 UUID := gen_random_uuid(); -- Incompleto
  v_c5 UUID := gen_random_uuid(); -- Especial
  v_dt DATE := CURRENT_DATE - INTERVAL '1 day'; -- Ontem (dia útil para fluxo normal)
  v_data_str TEXT := to_char(v_dt, 'YYYY-MM-DD');
BEGIN
  -- 2.1 RECUPERAR TENANT (Padrão ou criar um default)
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  IF v_tenant_id IS NULL THEN
    v_tenant_id := gen_random_uuid();
    INSERT INTO public.tenants (id, name, created_at) VALUES (v_tenant_id, 'Default Tenant', NOW());
  END IF;

  -- 2.2 CRIAR EMPRESA
  v_empresa_id := gen_random_uuid();
  INSERT INTO public.empresas (
    id, tenant_id, nome, cnpj, status, is_teste, created_at, updated_at
  ) VALUES (
    v_empresa_id, v_tenant_id, 'Empresa Teste - Homologação', '00000000000100', 'ativa', true, NOW(), NOW()
  );

  -- 2.3 CRIAR OS 5 COLABORADORES (Completude = 100%)
  INSERT INTO public.colaboradores (
    id, tenant_id, empresa_id, nome, matricula, cpf, 
    tipo_colaborador, tipo_contrato, status, is_teste,
    cargo, valor_base,
    telefone, nome_completo,
    banco_codigo, agencia, conta, tipo_conta, data_admissao
  ) VALUES 
  (v_c1, v_tenant_id, v_empresa_id, 'Colaborador Homologação - Normal', 'HOM-001', '11111111111', 'CLT', 'Mensal', 'ativo', true, 'Operador Logístico', 2000.00, '11999999991', 'Colab Norm', '341', '0001', '11111-1', 'corrente', '2026-01-01'),
  (v_c2, v_tenant_id, v_empresa_id, 'Colaborador Homologação - Hora Extra', 'HOM-002', '22222222222', 'CLT', 'Mensal', 'ativo', true, 'Operador Logístico', 2000.00, '11999999992', 'Colab Extra', '341', '0002', '22222-2', 'corrente', '2026-01-01'),
  (v_c3, v_tenant_id, v_empresa_id, 'Colaborador Homologação - Atraso', 'HOM-003', '33333333333', 'CLT', 'Mensal', 'ativo', true, 'Operador Logístico', 2000.00, '11999999993', 'Colab Atraso', '341', '0003', '33333-3', 'corrente', '2026-01-01'),
  (v_c4, v_tenant_id, v_empresa_id, 'Colaborador Homologação - Incompleto', 'HOM-004', '44444444444', 'CLT', 'Mensal', 'ativo', true, 'Operador Logístico', 2000.00, '11999999994', 'Colab Incomp', '341', '0004', '44444-4', 'corrente', '2026-01-01'),
  (v_c5, v_tenant_id, v_empresa_id, 'Colaborador Homologação - Especial', 'HOM-005', '55555555555', 'CLT', 'Mensal', 'ativo', true, 'Operador Logístico', 2000.00, '11999999995', 'Colab Esp', '341', '0005', '55555-5', 'corrente', '2026-01-01');

  -- 2.4 CRIAR PONTOS (Refletindo cenários)
  -- NOTA: Como a arquitetura depende de um processamento RH que lê de registros_ponto e processa, 
  -- inserimos os pontos espelhando os tempos previstos (presumindo 08:00 às 17:00 com 1h de almoço = 8h padrão).
  
  INSERT INTO public.registros_ponto (id, tenant_id, colaborador_id, data, entrada, saida_almoco, retorno_almoco, saida, status, origem, is_teste, created_at, updated_at)
  VALUES 
  -- C1: Normal (08:00 as 12:00, 13:00 as 17:00) => 8 horas exatas
  (gen_random_uuid(), v_tenant_id, v_c1, v_dt, '08:00:00', '12:00:00', '13:00:00', '17:00:00', 'ok', 'importacao', true, NOW(), NOW()),
  
  -- C2: Hora Extra (08:00 as 12:00, 13:00 as 19:00) => 10 horas (+2 horas)
  (gen_random_uuid(), v_tenant_id, v_c2, v_dt, '08:00:00', '12:00:00', '13:00:00', '19:00:00', 'ok', 'importacao', true, NOW(), NOW()),
  
  -- C3: Atraso (09:00 as 12:00, 13:00 as 17:00) => 7 horas (-1 hora)
  (gen_random_uuid(), v_tenant_id, v_c3, v_dt, '09:00:00', '12:00:00', '13:00:00', '17:00:00', 'ok', 'importacao', true, NOW(), NOW()),
  
  -- C4: Incompleto (08:00 as 12:00, só bateu a entrada tarde, sem bater a saida final etc)
  (gen_random_uuid(), v_tenant_id, v_c4, v_dt, '08:00:00', '12:00:00', '13:00:00', NULL, 'pendente', 'importacao', true, NOW(), NOW()),
  
  -- C5: Especial / Noturno (Ex: 14:00 às 23:00 para não quebrar a constraint de dia/horário)
  (gen_random_uuid(), v_tenant_id, v_c5, v_dt, '14:00:00', '18:00:00', '19:00:00', '23:00:00', 'ok', 'importacao', true, NOW(), NOW());

END $$;
