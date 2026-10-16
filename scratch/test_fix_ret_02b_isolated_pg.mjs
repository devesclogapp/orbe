import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('================================================================================');
  console.log('ERP ORBE — FIX-RET-02B: VALIDAÇÃO REAL EM POSTGRESQL 17 ISOLADO (PORTA 54323)');
  console.log('================================================================================\n');

  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54323/postgres'
  });

  await client.connect();
  console.log('✅ Conexão estabelecida com sucesso com PostgreSQL 17 (127.0.0.1:54323)\n');

  // 1. SETUP DE SCHEMA CANÔNICO E FUNÇÕES DE CONTEXTO
  console.log('--- 1. Preparação do Schema Canônico Base ---');
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    BEGIN
      RETURN COALESCE(
        NULLIF(current_setting('app.current_user_id', true), '')::UUID,
        'a0000000-0000-0000-0000-000000000001'::UUID
      );
    END;
    $$ LANGUAGE plpgsql STABLE;

    CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS UUID AS $$
    BEGIN
      RETURN COALESCE(
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
        'e0000000-0000-0000-0000-000000000001'::UUID
      );
    END;
    $$ LANGUAGE plpgsql STABLE;

    -- Tabelas de Autenticação e Domínio
    CREATE TABLE IF NOT EXISTS public.tenants (
      id UUID PRIMARY KEY,
      nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.empresas (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      nome TEXT NOT NULL,
      is_teste BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.contas_bancarias_empresa (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      banco_codigo TEXT NOT NULL,
      banco_nome TEXT NOT NULL,
      ativo BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS public.colaboradores (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      nome TEXT NOT NULL,
      cpf TEXT,
      is_teste BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.intermitentes_lotes_fechamento (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      competencia VARCHAR(7),
      status TEXT NOT NULL DEFAULT 'FECHADO_FINANCEIRO',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lancamentos_intermitentes (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      lote_fechamento_id UUID REFERENCES public.intermitentes_lotes_fechamento(id),
      colaborador_id UUID REFERENCES public.colaboradores(id),
      status_pipeline TEXT NOT NULL DEFAULT 'RECEBIDO',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.diaristas_lotes_fechamento (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      status TEXT NOT NULL DEFAULT 'FECHADO_FINANCEIRO',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lancamentos_diaristas (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      lote_fechamento_id UUID REFERENCES public.diaristas_lotes_fechamento(id),
      status TEXT NOT NULL DEFAULT 'FECHADO_FINANCEIRO',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.rh_financeiro_lotes (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      status TEXT NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.lotes_remessa (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      status TEXT NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.rh_financeiro_lote_itens (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      lote_id UUID REFERENCES public.rh_financeiro_lotes(id),
      colaborador_id UUID REFERENCES public.colaboradores(id),
      status TEXT NOT NULL DEFAULT 'AGUARDANDO_RETORNO'
    );

    CREATE TABLE IF NOT EXISTS public.faturas (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      status TEXT NOT NULL DEFAULT 'remetida_ao_banco',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.cnab_remessas_arquivos (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias_empresa(id),
      nome_arquivo TEXT NOT NULL,
      sequencial_arquivo INT NOT NULL,
      hash_arquivo TEXT NOT NULL,
      conteudo_arquivo TEXT,
      total_registros INT NOT NULL DEFAULT 0,
      total_valor NUMERIC(15,2) NOT NULL DEFAULT 0,
      banco_codigo TEXT NOT NULL,
      banco_nome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'gerado'
        CHECK (status IN ('gerado', 'baixado', 'enviado_manual', 'homologado', 'erro_homologacao', 'cancelado', 'erro')),
      modo TEXT NOT NULL DEFAULT 'producao'
        CHECK (modo IN ('homologacao', 'producao')),
      intermitentes_lote_id UUID REFERENCES public.intermitentes_lotes_fechamento(id),
      diaristas_lote_id UUID REFERENCES public.diaristas_lotes_fechamento(id),
      lote_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.cnab_remessa_itens (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      remessa_id UUID NOT NULL REFERENCES public.cnab_remessas_arquivos(id),
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      origem_tipo TEXT NOT NULL,
      origem_id UUID NOT NULL,
      lote_item_id UUID,
      fatura_id UUID,
      valor NUMERIC(15,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'remetido'
        CHECK (status IN ('remetido', 'conciliado', 'rejeitado', 'divergente', 'cancelado', 'invalidado')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.cnab_retorno_arquivos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      remessa_arquivo_id UUID REFERENCES public.cnab_remessas_arquivos(id),
      nome_arquivo TEXT NOT NULL,
      hash_arquivo TEXT NOT NULL,
      banco_codigo TEXT NOT NULL,
      data_processamento TIMESTAMPTZ DEFAULT NOW(),
      usuario_processamento UUID,
      total_linhas INT DEFAULT 0,
      total_processados INT DEFAULT 0,
      total_sucesso INT DEFAULT 0,
      total_rejeitado INT DEFAULT 0,
      total_divergente INT DEFAULT 0,
      total_pendente INT DEFAULT 0,
      status TEXT DEFAULT 'processado',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.cnab_retorno_itens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      retorno_arquivo_id UUID NOT NULL REFERENCES public.cnab_retorno_arquivos(id),
      remessa_arquivo_id UUID REFERENCES public.cnab_remessas_arquivos(id),
      remessa_item_id UUID REFERENCES public.cnab_remessa_itens(id),
      lote_id UUID,
      diaristas_lote_id UUID,
      intermitentes_lote_id UUID,
      fatura_id UUID,
      colaborador_id UUID,
      nome_favorecido TEXT,
      documento_favorecido TEXT,
      valor_esperado NUMERIC(15,2),
      valor_retornado NUMERIC(15,2),
      data_ocorrencia DATE,
      codigo_ocorrencia TEXT,
      descricao_ocorrencia TEXT,
      status TEXT DEFAULT 'pendente',
      status_conciliacao TEXT,
      linha_original TEXT,
      parsed_json JSONB DEFAULT '{}'::jsonb,
      origem_tipo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.cnab_auditoria_bancaria (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      arquivo_id UUID,
      lote_id UUID,
      acao TEXT NOT NULL,
      usuario_id UUID,
      usuario_nome TEXT,
      detalhes JSONB,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Trigger de Imutabilidade estrita da remessa
    CREATE OR REPLACE FUNCTION public.check_cnab_remessa_imutabilidade()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('gerado', 'baixado', 'enviado', 'enviado_manual', 'homologado') THEN
          IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Tenants.';
          END IF;
          IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
            RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Empresas.';
          END IF;
          IF NEW.conta_bancaria_id IS DISTINCT FROM OLD.conta_bancaria_id THEN
            RAISE EXCEPTION 'Imutabilidade violada: Conta Bancária não pode ser alterada em arquivo já gerado.';
          END IF;
          IF NEW.hash_arquivo IS DISTINCT FROM OLD.hash_arquivo THEN
            RAISE EXCEPTION 'Imutabilidade violada: Hash do Arquivo corrompido ou alterado.';
          END IF;
          IF NEW.total_valor IS DISTINCT FROM OLD.total_valor THEN
            RAISE EXCEPTION 'Imutabilidade violada: O Valor Total é imutável.';
          END IF;
          IF NEW.total_registros IS DISTINCT FROM OLD.total_registros THEN
            RAISE EXCEPTION 'Imutabilidade violada: O Volume de Registros é imutável.';
          END IF;
          IF NEW.sequencial_arquivo IS DISTINCT FROM OLD.sequencial_arquivo THEN
            RAISE EXCEPTION 'Imutabilidade violada: O Sequencial Bancário é fixo.';
          END IF;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS enforce_cnab_remessa_imutabilidade ON public.cnab_remessas_arquivos;
    CREATE TRIGGER enforce_cnab_remessa_imutabilidade
      BEFORE UPDATE ON public.cnab_remessas_arquivos
      FOR EACH ROW EXECUTE FUNCTION public.check_cnab_remessa_imutabilidade();
  `);
  console.log('✅ Schema base, tabelas e triggers de imutabilidade configurados.\n');

  // 2. APLICAÇÃO DA MIGRATION FIX-RET-02B
  console.log('--- 2. Aplicação da Migration 20261015180000_fix_ret_02_blindagem_retorno_simulado.sql ---');
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261015180000_fix_ret_02_blindagem_retorno_simulado.sql'),
    'utf8'
  );
  await client.query(migrationSql);
  console.log('✅ Migration FIX-RET-02B aplicada com sucesso no PostgreSQL isolado.\n');

  // CONSTANTES DE TESTE
  const tenantOficial = 'e0000000-0000-0000-0000-000000000001';
  const tenantOutro = 'e0000000-0000-0000-0000-000000000002';
  const userOficial = 'a0000000-0000-0000-0000-000000000001';

  const empHmlId = '11111111-1111-1111-1111-111111111111';
  const empProdId = '22222222-2222-2222-2222-222222222222';
  const empOutroTenantId = '33333333-3333-3333-3333-333333333333';

  const contaHmlItau = '44444444-1111-1111-1111-111111111111';
  const contaProdItau = '44444444-2222-2222-2222-222222222222';
  const contaInativa = '44444444-3333-3333-3333-333333333333';

  const loteIntHmlId = '55555555-1111-1111-1111-111111111111';
  const lancIntHml1 = '66666666-1111-1111-1111-111111111111';
  const lancIntHml2 = '66666666-2222-2222-2222-222222222222';

  const remHmlNsa10 = '77777777-1111-1111-1111-111111111111';
  const itemRemHml1 = '88888888-1111-1111-1111-111111111111';
  const itemRemHml2 = '88888888-2222-2222-2222-222222222222';

  const remProdNsa9 = '77777777-2222-2222-2222-222222222222';
  const itemRemProd1 = '88888888-3333-3333-3333-333333333333';

  const remProdNsa8 = '77777777-3333-3333-3333-333333333333';
  const itemRemProdNsa8 = '88888888-4444-4444-4444-444444444444';

  async function resetTestData() {
    await client.query(`
      SELECT set_config('app.current_user_id', '${userOficial}', false);
      SELECT set_config('app.current_tenant_id', '${tenantOficial}', false);

      TRUNCATE TABLE 
        public.cnab_auditoria_bancaria,
        public.cnab_retorno_itens,
        public.cnab_retorno_arquivos,
        public.cnab_remessa_itens,
        public.cnab_remessas_arquivos,
        public.lancamentos_intermitentes,
        public.intermitentes_lotes_fechamento,
        public.lancamentos_diaristas,
        public.diaristas_lotes_fechamento,
        public.rh_financeiro_lote_itens,
        public.rh_financeiro_lotes,
        public.faturas,
        public.contas_bancarias_empresa,
        public.colaboradores,
        public.empresas,
        public.tenants
      CASCADE;

      INSERT INTO public.tenants (id, nome) VALUES 
        ('${tenantOficial}', 'Tenant Principal'),
        ('${tenantOutro}', 'Tenant Secundário');

      INSERT INTO public.empresas (id, tenant_id, nome, is_teste) VALUES
        ('${empHmlId}', '${tenantOficial}', 'Empresa Teste - Homologacao', true),
        ('${empProdId}', '${tenantOficial}', 'Empresa Real Producao', false),
        ('${empOutroTenantId}', '${tenantOutro}', 'Empresa de Outro Tenant', false);

      INSERT INTO public.contas_bancarias_empresa (id, tenant_id, empresa_id, banco_codigo, banco_nome, ativo) VALUES
        ('${contaHmlItau}', '${tenantOficial}', '${empHmlId}', '341', 'Itaú Unibanco', true),
        ('${contaProdItau}', '${tenantOficial}', '${empProdId}', '341', 'Itaú Unibanco', true),
        ('${contaInativa}', '${tenantOficial}', '${empHmlId}', '341', 'Itaú Inativo', false);

      INSERT INTO public.colaboradores (id, tenant_id, nome, is_teste) VALUES
        ('99999999-0001-1111-1111-111111111111', '${tenantOficial}', 'Homologação Itaú 001', true),
        ('99999999-0002-1111-1111-111111111111', '${tenantOficial}', 'Homologação Itaú 002', true);

      -- Lote Intermitente de Homologação (Cenário NSA 10 - 2 colaboradores, R$ 350,00)
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, competencia, status) VALUES
        ('${loteIntHmlId}', '${tenantOficial}', '${empHmlId}', '2026-11', 'FECHADO_FINANCEIRO');

      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline) VALUES
        ('${lancIntHml1}', '${tenantOficial}', '${empHmlId}', '${loteIntHmlId}', '99999999-0001-1111-1111-111111111111', 'RECEBIDO_FINANCEIRO'),
        ('${lancIntHml2}', '${tenantOficial}', '${empHmlId}', '${loteIntHmlId}', '99999999-0002-1111-1111-111111111111', 'RECEBIDO_FINANCEIRO');

      -- Remessa NSA 10 (Homologação)
      INSERT INTO public.cnab_remessas_arquivos (
        id, tenant_id, empresa_id, conta_bancaria_id, nome_arquivo, sequencial_arquivo, hash_arquivo,
        total_registros, total_valor, banco_codigo, banco_nome, status, modo, intermitentes_lote_id
      ) VALUES (
        '${remHmlNsa10}', '${tenantOficial}', '${empHmlId}', '${contaHmlItau}', 'SIMULACAO_HOMOLOGACAO_ITAU_SEQ000010.txt',
        10, 'hash_nsa10_original', 2, 350.00, '341', 'Itaú Unibanco', 'baixado', 'homologacao', '${loteIntHmlId}'
      );

      INSERT INTO public.cnab_remessa_itens (id, tenant_id, remessa_id, empresa_id, origem_tipo, origem_id, valor, status) VALUES
        ('${itemRemHml1}', '${tenantOficial}', '${remHmlNsa10}', '${empHmlId}', 'INTERMITENTE', '${lancIntHml1}', 150.00, 'remetido'),
        ('${itemRemHml2}', '${tenantOficial}', '${remHmlNsa10}', '${empHmlId}', 'INTERMITENTE', '${lancIntHml2}', 200.00, 'remetido');

      -- Remessa NSA 9 (Produção)
      INSERT INTO public.cnab_remessas_arquivos (
        id, tenant_id, empresa_id, conta_bancaria_id, nome_arquivo, sequencial_arquivo, hash_arquivo,
        total_registros, total_valor, banco_codigo, banco_nome, status, modo
      ) VALUES (
        '${remProdNsa9}', '${tenantOficial}', '${empProdId}', '${contaProdItau}', 'REMESSA_PRODUCAO_SEQ000009.rem',
        9, 'hash_nsa9_original', 1, 1000.00, '341', 'Itaú Unibanco', 'enviado_manual', 'producao'
      );

      INSERT INTO public.cnab_remessa_itens (id, tenant_id, remessa_id, empresa_id, origem_tipo, origem_id, valor, status) VALUES
        ('${itemRemProd1}', '${tenantOficial}', '${remProdNsa9}', '${empProdId}', 'FATURA', '99999999-1111-1111-1111-111111111111', 1000.00, 'remetido');

      -- Remessa NSA 8 (Produção)
      INSERT INTO public.cnab_remessas_arquivos (
        id, tenant_id, empresa_id, conta_bancaria_id, nome_arquivo, sequencial_arquivo, hash_arquivo,
        total_registros, total_valor, banco_codigo, banco_nome, status, modo
      ) VALUES (
        '${remProdNsa8}', '${tenantOficial}', '${empProdId}', '${contaProdItau}', 'REMESSA_PRODUCAO_SEQ000008.rem',
        8, 'hash_nsa8_original', 1, 500.00, '341', 'Itaú Unibanco', 'enviado_manual', 'producao'
      );

      INSERT INTO public.cnab_remessa_itens (id, tenant_id, remessa_id, empresa_id, origem_tipo, origem_id, valor, status) VALUES
        ('${itemRemProdNsa8}', '${tenantOficial}', '${remProdNsa8}', '${empProdId}', 'CLT', '99999999-2222-2222-2222-222222222222', 500.00, 'remetido');
    `);
  }

  // =========================================================================
  // BATERIA DE TESTES OBRIGATÓRIOS DO FIX-RET-02B
  // =========================================================================

  // TESTE 1: Retorno válido de homologação (Quitação integral NSA 10)
  console.log('--- TESTE 1: Retorno válido de homologação (Quitação Integral NSA 10) ---');
  await resetTestData();
  const payloadHmlValido = [
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml1,
      valor_pago: 150.00,
      status: 'liquidado',
      codigo_ocorrencia: '00',
      linha_original: 'TEST_LINE_1'
    },
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml2,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml2,
      valor_pago: 200.00,
      status: 'liquidado',
      codigo_ocorrencia: '00',
      linha_original: 'TEST_LINE_2'
    }
  ];

  const res1 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_HML_NSA10_OK.RET',
      'hash_ret_1',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify(payloadHmlValido)]);

  const r1 = res1.rows[0].resultado;
  if (r1.sucesso && r1.modo === 'homologacao' && r1.simulado === true && r1.quitacao_integral === true) {
    console.log('✅ TESTE 1 APROVADO: Retorno homologação processado com modo=homologacao, simulado=true e quitacao_integral=true');
  } else {
    throw new Error(`TESTE 1 FALHOU: ${JSON.stringify(r1)}`);
  }

  // Verifica que o lote intermitente foi para PAGO
  const loteCheck1 = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${loteIntHmlId}'`);
  if (loteCheck1.rows[0].status === 'PAGO') {
    console.log('✅ TESTE 1 (Lote): Lote intermitente INT-2026-11 transitou corretamente para status=PAGO');
  } else {
    throw new Error(`TESTE 1 (Lote) FALHOU: status é ${loteCheck1.rows[0].status}`);
  }

  // Verifica auditoria bancária com modo e simulação
  const auditCheck1 = await client.query(`SELECT acao, detalhes FROM public.cnab_auditoria_bancaria WHERE arquivo_id = '${remHmlNsa10}'`);
  if (auditCheck1.rows[0].acao === 'RETORNO_PROCESSADO_SIMULADO' && auditCheck1.rows[0].detalhes.simulacao === true) {
    console.log('✅ TESTE 1 (Auditoria): Auditoria gravou RETORNO_PROCESSADO_SIMULADO e simulacao=true');
  } else {
    throw new Error(`TESTE 1 (Auditoria) FALHOU: ${JSON.stringify(auditCheck1.rows[0])}`);
  }

  // TESTE 2: Retorno válido de produção
  console.log('\n--- TESTE 2: Retorno válido de produção ---');
  await resetTestData();
  const payloadProdValido = [
    {
      remessa_id: remProdNsa9,
      remessa_item_id: itemRemProd1,
      origem_tipo: 'FATURA',
      origem_id: '99999999-1111-1111-1111-111111111111',
      valor_pago: 1000.00,
      status: 'liquidado',
      codigo_ocorrencia: '00',
      linha_original: 'TEST_PROD_1'
    }
  ];

  const res2 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empProdId}',
      '${contaProdItau}',
      '341',
      'RETORNO_PROD_NSA9_OK.RET',
      'hash_ret_2',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify(payloadProdValido)]);

  const r2 = res2.rows[0].resultado;
  if (r2.sucesso && r2.modo === 'producao' && r2.simulado === false && r2.quitacao_integral === true) {
    console.log('✅ TESTE 2 APROVADO: Retorno de produção processado com modo=producao e simulado=false');
  } else {
    throw new Error(`TESTE 2 FALHOU: ${JSON.stringify(r2)}`);
  }

  // TESTE 3: Remessa ausente ou nula (Eliminação de fallback)
  console.log('\n--- TESTE 3: Remessa ausente ou sem remessa_id (Eliminação de Fallback) ---');
  await resetTestData();
  const payloadSemRemessa = [
    {
      remessa_id: null,
      remessa_item_id: itemRemHml1,
      valor_pago: 150.00,
      status: 'liquidado'
    }
  ];

  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'RETORNO_SEM_REMESSA.RET',
        'hash_ret_3',
        $1::JSONB
      );
    `, [JSON.stringify(payloadSemRemessa)]);
    throw new Error('TESTE 3 FALHOU: Deveria ter rejeitado retorno sem remessa_id');
  } catch (err) {
    if (err.message.includes('É obrigatório que o retorno bancário esteja vinculado a uma remessa')) {
      console.log('✅ TESTE 3 APROVADO: Rejeitou retorno sem remessa com erro esperado:', err.message);
    } else {
      throw err;
    }
  }

  // TESTE 4: Item pertencente a outra remessa
  console.log('\n--- TESTE 4: Item pertencente a outra remessa ---');
  await resetTestData();
  const payloadItemOutraRemessa = [
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemProd1, // pertence à remessa NSA 9 de produção!
      valor_pago: 150.00,
      status: 'liquidado'
    }
  ];

  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'RETORNO_ITEM_INVASOR.RET',
        'hash_ret_4',
        $1::JSONB
      );
    `, [JSON.stringify(payloadItemOutraRemessa)]);
    throw new Error('TESTE 4 FALHOU: Deveria ter rejeitado item pertencente a outra remessa');
  } catch (err) {
    if (err.message.includes('divergente da remessa')) {
      console.log('✅ TESTE 4 APROVADO: Bloqueou item de outra remessa com sucesso:', err.message);
    } else {
      throw err;
    }
  }

  // TESTE 5: Item pertencente a outro tenant ou empresa
  console.log('\n--- TESTE 5: Item pertencente a outro tenant ou empresa ---');
  await resetTestData();
  // Cria remessa invasora em outro tenant
  await client.query(`
    INSERT INTO public.cnab_remessas_arquivos (
      id, tenant_id, empresa_id, conta_bancaria_id, nome_arquivo, sequencial_arquivo, hash_arquivo,
      total_registros, total_valor, banco_codigo, banco_nome, status, modo
    ) VALUES (
      '77777777-9999-9999-9999-999999999999', '${tenantOutro}', '${empOutroTenantId}', '${contaProdItau}', 'REM_OUTRO_TENANT.rem',
      99, 'hash_outro_tenant', 1, 100.00, '341', 'Itaú Unibanco', 'enviado_manual', 'producao'
    );
  `);

  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'RETORNO_OUTRO_TENANT.RET',
        'hash_ret_5',
        $1::JSONB
      );
    `, [JSON.stringify([{ remessa_id: '77777777-9999-9999-9999-999999999999', remessa_item_id: itemRemHml1, valor_pago: 100, status: 'liquidado' }])]);
    throw new Error('TESTE 5 FALHOU: Deveria ter bloqueado acesso a remessa de outro tenant');
  } catch (err) {
    if (err.message.includes('não encontrada no tenant')) {
      console.log('✅ TESTE 5 APROVADO: Bloqueou tentativa de acesso a remessa de outro tenant:', err.message);
    } else {
      throw err;
    }
  }

  // TESTE 6: Tentativa de quitação com apenas um dos dois favorecidos (Quitação parcial)
  console.log('\n--- TESTE 6: Tentativa de quitação com apenas 1 dos 2 favorecidos ---');
  await resetTestData();
  const payloadParcial1Item = [
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1, // Apenas 1 de 2 colaboradores
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml1,
      valor_pago: 150.00,
      status: 'liquidado',
      codigo_ocorrencia: '00',
      linha_original: 'TEST_PARTIAL_1'
    }
  ];

  const res6 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_PARCIAL_1ITEM.RET',
      'hash_ret_6',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify(payloadParcial1Item)]);

  const r6 = res6.rows[0].resultado;
  if (r6.quitacao_integral === false) {
    console.log('✅ TESTE 6 APROVADO: quitacao_integral=false quando apenas 1 favorecido foi retornado');
  } else {
    throw new Error(`TESTE 6 FALHOU: quitacao_integral não deveria ser true: ${JSON.stringify(r6)}`);
  }

  // Verifica que o lote intermitente NÃO foi para PAGO
  const loteCheck6 = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${loteIntHmlId}'`);
  if (loteCheck6.rows[0].status === 'FECHADO_FINANCEIRO') {
    console.log('✅ TESTE 6 (Lote Preservado): Lote intermitente permaneceu FECHADO_FINANCEIRO (NÃO virou PAGO)');
  } else {
    throw new Error(`TESTE 6 (Lote) FALHOU: status virou ${loteCheck6.rows[0].status}`);
  }

  // TESTE 7: Valor divergente
  console.log('\n--- TESTE 7: Valor pago divergente do esperado ---');
  await resetTestData();
  const payloadDivergente = [
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml1,
      valor_pago: 140.00, // Esperado era 150.00!
      status: 'liquidado',
      codigo_ocorrencia: '00',
      linha_original: 'TEST_DIV_1'
    },
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml2,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml2,
      valor_pago: 200.00,
      status: 'liquidado',
      codigo_ocorrencia: '00',
      linha_original: 'TEST_DIV_2'
    }
  ];

  const res7 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_DIVERGENTE.RET',
      'hash_ret_7',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify(payloadDivergente)]);

  const r7 = res7.rows[0].resultado;
  if (r7.total_divergentes === 1 && r7.quitacao_integral === false) {
    console.log('✅ TESTE 7 APROVADO: Item com valor divergente classificado como divergente e lote não liquidado');
  } else {
    throw new Error(`TESTE 7 FALHOU: ${JSON.stringify(r7)}`);
  }

  // TESTE 8: Retorno duplicado e idempotência
  console.log('\n--- TESTE 8: Retorno duplicado (Idempotência por Hash) ---');
  await resetTestData();
  // Primeiro envio OK
  await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_HASH_TEST.RET',
      'hash_duplicado_123',
      $1::JSONB
    );
  `, [JSON.stringify(payloadHmlValido)]);

  // Segundo envio com o mesmo hash
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'RETORNO_HASH_TEST_2.RET',
        'hash_duplicado_123',
        $1::JSONB
      );
    `, [JSON.stringify(payloadHmlValido)]);
    throw new Error('TESTE 8 FALHOU: Deveria ter bloqueado hash duplicado');
  } catch (err) {
    if (err.message.includes('Arquivo de retorno duplicado')) {
      console.log('✅ TESTE 8 APROVADO: Bloqueou reprocessamento de hash duplicado:', err.message);
    } else {
      throw err;
    }
  }

  // TESTE 9: Rejeição parcial
  console.log('\n--- TESTE 9: Retorno com item rejeitado pelo banco ---');
  await resetTestData();
  const payloadComRejeicao = [
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml1,
      valor_pago: 0,
      status: 'rejeitado',
      codigo_ocorrencia: 'RJ',
      motivo_ocorrencia: 'Conta de destino inexistente'
    },
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml2,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml2,
      valor_pago: 200.00,
      status: 'liquidado',
      codigo_ocorrencia: '00'
    }
  ];

  const res9 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_REJEICAO_PARCIAL.RET',
      'hash_ret_9',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify(payloadComRejeicao)]);

  const r9 = res9.rows[0].resultado;
  if (r9.total_rejeitados === 1 && r9.quitacao_integral === false) {
    console.log('✅ TESTE 9 APROVADO: Rejeição parcial identificada e quitação integral bloqueada');
  } else {
    throw new Error(`TESTE 9 FALHOU: ${JSON.stringify(r9)}`);
  }

  // TESTE 10: Preservação das remessas históricas NSA 8, 9 e 10
  console.log('\n--- TESTE 10: Preservação das Remessas NSA 8, 9 e 10 ---');
  const remessasCheck = await client.query(`
    SELECT sequencial_arquivo, hash_arquivo, total_valor, total_registros, modo, status 
    FROM public.cnab_remessas_arquivos 
    ORDER BY sequencial_arquivo ASC;
  `);
  console.table(remessasCheck.rows);
  const nsa8 = remessasCheck.rows.find(r => r.sequencial_arquivo === 8);
  const nsa9 = remessasCheck.rows.find(r => r.sequencial_arquivo === 9);
  if (nsa8.total_valor === '500.00' && nsa8.modo === 'producao' && nsa9.total_valor === '1000.00' && nsa9.modo === 'producao') {
    console.log('✅ TESTE 10 APROVADO: Remessas NSA 8 e NSA 9 100% preservadas e intactas.');
  } else {
    throw new Error('TESTE 10 FALHOU na integridade das remessas históricas');
  }

  // TESTE 11: Tentativa de conciliação cruzada (Empresa de Produção conciliando remessa de Homologação)
  console.log('\n--- TESTE 11: Bloqueio de Cruzamento de Ambientes ---');
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empProdId}',
        '${contaProdItau}',
        '341',
        'CROSS_ENV_ATTEMPT.RET',
        'hash_cross_1',
        $1::JSONB
      );
    `, [JSON.stringify([{ remessa_id: remHmlNsa10, remessa_item_id: itemRemHml1, valor_pago: 150, status: 'liquidado' }])]);
    throw new Error('TESTE 11 FALHOU: Deveria ter bloqueado cruzamento de ambientes');
  } catch (err) {
    if (err.message.includes('A remessa de origem pertence à empresa') || err.message.includes('Bloqueio de Segurança')) {
      console.log('✅ TESTE 11 APROVADO: Bloqueou tentativa de cruzamento entre produção e homologação:', err.message);
    } else {
      throw err;
    }
  }

  // TESTE 12: Aplicação e Teste do Rollback
  console.log('\n--- TESTE 12: Aplicação e Validação do Rollback ---');
  const rollbackSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/rollback_20261015180000_fix_ret_02_blindagem_retorno_simulado.sql'),
    'utf8'
  );
  await client.query(rollbackSql);
  console.log('✅ Script de rollback executado com sucesso no PostgreSQL.');

  // Verifica que as colunas adicionadas foram removidas no rollback
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'cnab_retorno_arquivos' AND column_name IN ('modo', 'empresa_id', 'conta_bancaria_id');
  `);
  if (colCheck.rows.length === 0) {
    console.log('✅ TESTE 12 (Colunas Removidas): Colunas temporárias removidas perfeitamente.');
  } else {
    throw new Error(`TESTE 12 FALHOU: Colunas ainda presentes: ${JSON.stringify(colCheck.rows)}`);
  }

  // Re-aplica a migration para manter o ambiente de homologação pronto
  console.log('\n--- Reaplicação da Migration FIX-RET-02B pós-rollback (Idempotência) ---');
  await client.query(migrationSql);
  console.log('✅ Reaplicação da migration executada com 100% de sucesso.');

  console.log('\n================================================================================');
  console.log('TODOS OS 12 CENÁRIOS OBRIGATÓRIOS DO POSTGRESQL FORAM APROVADOS COM 100% DE ÊXITO!');
  console.log('================================================================================');

  await client.end();
}

run().catch(err => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES ISOLADOS:', err);
  process.exit(1);
});
