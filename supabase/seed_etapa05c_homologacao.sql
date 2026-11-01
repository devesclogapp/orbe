-- ==============================================================================
-- SEED SINTÉTICO: HOMOLOGAÇÃO CONTROLADA DA ETAPA 05C (INTERMITENTES RH)
-- Base 100% sintética sem dados reais, PII ou dados financeiros de produção.
-- ==============================================================================

-- 1. Tenants Isolados de Teste
INSERT INTO public.tenants (id, nome, slug, ativo) VALUES
('a0000000-0000-0000-0000-000000000001', 'Tenant HML Alpha', 'tenant-hml-alpha', true),
('b0000000-0000-0000-0000-000000000002', 'Tenant HML Beta (Isolado)', 'tenant-hml-beta', true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 2. Empresas Sintéticas de Homologação
INSERT INTO public.empresas (id, tenant_id, nome, cnpj, is_teste, ativo) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Empresa Origem HML A', '00.000.000/0001-91', true, true),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Empresa Destino HML B', '00.000.000/0002-72', true, true),
('e0000000-0000-0000-0000-000000000099', 'b0000000-0000-0000-0000-000000000002', 'Empresa Tenant Diferente C', '99.999.999/0001-99', true, true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 3. Colaboradores Intermitentes Sintéticos
INSERT INTO public.colaboradores (id, tenant_id, empresa_id, nome, cpf, tipo_colaborador, ativo) VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Colaborador Intermitente Sintético 1', '11111111111', 'INTERMITENTE', true),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Colaborador Intermitente Sintético 2', '22222222222', 'INTERMITENTE', true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- 4. Lotes Operacionais de Fechamento Sintéticos
INSERT INTO public.intermitentes_lotes_fechamento (
    id, tenant_id, empresa_id, competencia, periodo_inicio, periodo_fim,
    quantidade_registros, valor_total, status, observacoes
) VALUES
-- Lote 1: Devolvido pelo RH (2 lançamentos, R$ 570,00) -> para testes T01, T02, T04, T08, T09, T10, T11, T12
('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-01', '2026-10-07', 2, 570.00, 'DEVOLVIDO', 'Devolvido pelo RH para saneamento de empresa'),
-- Lote 2: Aprovado pelo RH -> para teste T06
('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-01', '2026-10-07', 1, 200.00, 'APROVADO_RH', 'Lote já aprovado'),
-- Lote 3: Com CNAB gerado -> para teste T07 (anti-retificação pós-CNAB)
('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-01', '2026-10-07', 1, 150.00, 'FECHADO_FINANCEIRO', 'Lote com remessa CNAB emitida'),
-- Lote 4: Aberto (Aguardando Validação RH) -> para teste T13 (Fechamento Operacional)
('40000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-08', '2026-10-14', 0, 0.00, 'AGUARDANDO_VALIDACAO_RH', 'Lote aberto pronto para receber lançamentos'),
-- Lote 5: Devolvido para teste de revalidação integral -> para teste T14
('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-01', '2026-10-07', 1, 100.00, 'DEVOLVIDO', 'Lote devolvido para teste de revalidação'),
-- Lote 6: Cancelado sem vínculos -> para teste de exclusão física permitida de lote
('60000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-01', '2026-10-07', 0, 0.00, 'CANCELADO', 'Lote cancelado sem lançamentos'),
-- Lote 7: Fechado Financeiro com lançamento em ENVIADO_FINANCEIRO
('70000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-01', '2026-10-07', 1, 220.00, 'FECHADO_FINANCEIRO', 'Lote já transmitido ao financeiro'),
-- Lote 8: Pago com lançamento em PAGO
('80000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2026-10', '2026-10-01', '2026-10-07', 1, 250.00, 'PAGO', 'Lote quitado e conciliado')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, valor_total = EXCLUDED.valor_total;

-- 5. Vínculo Bancário CNAB Sintético (para Lote 3)
INSERT INTO public.cnab_remessas_arquivos (
    id, tenant_id, empresa_id, intermitentes_lote_id, nome_arquivo, total_registros, valor_total, status
) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'REM_TESTE_001.REM', 1, 150.00, 'GERADO')
ON CONFLICT (id) DO NOTHING;

-- 6. Lançamentos Intermitentes Sintéticos
INSERT INTO public.lancamentos_intermitentes (
    id, tenant_id, empresa_id, colaborador_id, nome_colaborador, cpf_colaborador,
    data_referencia, horas_trabalhadas, horas_normais, he_50, he_100, hora_noturna,
    total, status_pipeline, lote_fechamento_id
) VALUES
-- Item 1 (Lote 1): R$ 240,00, 8 horas
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Colaborador Intermitente Sintético 1', '11111111111', '2026-10-02', 8.0, 8.0, 0, 0, 0, 240.00, 'DEVOLVIDO', '10000000-0000-0000-0000-000000000001'),
-- Item 2 (Lote 1): R$ 330,00, 10 horas (Alvo principal de retificação T01, T08, T09, T10, T11, T12)
('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Colaborador Intermitente Sintético 2', '22222222222', '2026-10-03', 10.0, 8.0, 2.0, 0, 0, 330.00, 'DEVOLVIDO', '10000000-0000-0000-0000-000000000001'),
-- Item 3: Aberto e Desvinculado (RECEBIDO) para Fechamento Operacional T13
('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Colaborador Intermitente Sintético 1', '11111111111', '2026-10-09', 6.0, 6.0, 0, 0, 0, 180.00, 'RECEBIDO', NULL),
-- Item 4 (Lote 2): Lote Aprovado T06
('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Colaborador Intermitente Sintético 2', '22222222222', '2026-10-04', 8.0, 8.0, 0, 0, 0, 200.00, 'APROVADO_RH', '20000000-0000-0000-0000-000000000002'),
-- Item 5 (Lote 3): Lote com CNAB gerado T07
('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Colaborador Intermitente Sintético 1', '11111111111', '2026-10-05', 6.0, 6.0, 0, 0, 0, 150.00, 'CNAB_GERADO', '30000000-0000-0000-0000-000000000003'),
-- Item 6 (Lote 5): Lote devolvido para revalidação T14
('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Colaborador Intermitente Sintético 2', '22222222222', '2026-10-06', 4.0, 4.0, 0, 0, 0, 100.00, 'DEVOLVIDO', '50000000-0000-0000-0000-000000000005'),
-- Item 7 (Lote 7): Em ENVIADO_FINANCEIRO (para teste de bloqueio de mutação direta e deleção)
('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Colaborador Intermitente Sintético 1', '11111111111', '2026-10-07', 8.0, 8.0, 0, 0, 0, 220.00, 'ENVIADO_FINANCEIRO', '70000000-0000-0000-0000-000000000007'),
-- Item 8 (Lote 8): Em PAGO (para teste de bloqueio absoluto de mutação direta e deleção)
('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Colaborador Intermitente Sintético 2', '22222222222', '2026-10-08', 8.0, 8.0, 0, 0, 0, 250.00, 'PAGO', '80000000-0000-0000-0000-000000000008'),
-- Item 9: Avulso RECEBIDO sem lote (para teste de exclusão permitida)
('f0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Colaborador Intermitente Sintético 1', '11111111111', '2026-10-10', 4.0, 4.0, 0, 0, 0, 120.00, 'RECEBIDO', NULL)
ON CONFLICT (id) DO UPDATE SET status_pipeline = EXCLUDED.status_pipeline, total = EXCLUDED.total;

-- ==============================================================================
-- MATRIZ DE TESTES SINTÉTICOS DE SEGURANÇA E RETIFICAÇÃO (READ/RUN LOCAL)
-- ==============================================================================
-- T01: Tentativa de alteração direta em ENVIADO_FINANCEIRO -> DEVE FALHAR (55000)
-- UPDATE public.lancamentos_intermitentes SET status_pipeline = 'RECEBIDO' WHERE id = 'f0000000-0000-0000-0000-000000000007';

-- T02: Tentativa de alteração de horas/valor via client -> DEVE FALHAR (42501)
-- UPDATE public.lancamentos_intermitentes SET total = 999.00 WHERE id = 'f0000000-0000-0000-0000-000000000002';

-- T03: Tentativa de exclusão de lançamento vinculado a lote -> DEVE FALHAR (42501)
-- DELETE FROM public.lancamentos_intermitentes WHERE id = 'f0000000-0000-0000-0000-000000000001';

-- T04: Tentativa de exclusão de lançamento PAGO -> DEVE FALHAR (42501)
-- DELETE FROM public.lancamentos_intermitentes WHERE id = 'f0000000-0000-0000-0000-000000000008';

-- T05: Tentativa de exclusão de lote com lançamentos vinculados -> DEVE FALHAR (42501)
-- DELETE FROM public.intermitentes_lotes_fechamento WHERE id = '10000000-0000-0000-0000-000000000001';

-- T06: Tentativa de exclusão de lote com CNAB vinculado -> DEVE FALHAR (42501)
-- DELETE FROM public.intermitentes_lotes_fechamento WHERE id = '30000000-0000-0000-0000-000000000003';

-- T07: Tentativa de exclusão de lote não cancelado -> DEVE FALHAR (42501)
-- DELETE FROM public.intermitentes_lotes_fechamento WHERE id = '40000000-0000-0000-0000-000000000004';

-- T08: Exclusão permitida de lote CANCELADO sem vínculos -> DEVE SUCEDER
-- DELETE FROM public.intermitentes_lotes_fechamento WHERE id = '60000000-0000-0000-0000-000000000006';

-- T09: Exclusão permitida de lançamento avulso RECEBIDO sem lote -> DEVE SUCEDER
-- DELETE FROM public.lancamentos_intermitentes WHERE id = 'f0000000-0000-0000-0000-000000000009';

-- T10: Retificação válida pelo RH via RPC -> DEVE SUCEDER (muda empresa, desvincula do lote 1, lote 1 vai de 2 para 1 registro)
-- SELECT public.rpc_rh_retificar_intermitente('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', NULL, 'Correção formal de empresa de alocação pelo RH');

-- T11: Tentativa de bypass direto via UPDATE com flag forjada -> DEVE FALHAR (42501)
-- SET LOCAL orbe.in_rpc_retificacao = 'true';
-- UPDATE public.lancamentos_intermitentes SET empresa_id = 'e0000000-0000-0000-0000-000000000002' WHERE id = 'f0000000-0000-0000-0000-000000000001';

-- T12: Preservação de valores, horas e integridade do audit_log
-- SELECT total, horas_trabalhadas FROM public.lancamentos_intermitentes WHERE id = 'f0000000-0000-0000-0000-000000000002';
-- SELECT count(*) FROM public.audit_log WHERE acao = 'RETIFICAR_INTERMITENTE_RH';
