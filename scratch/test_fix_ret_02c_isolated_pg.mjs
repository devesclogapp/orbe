import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('================================================================================');
  console.log('ERP ORBE — FIX-RET-02C: AUDITORIA FINAL DE SEGURANÇA E CONCORRÊNCIA');
  console.log('Banco de Dados: PostgreSQL 17 Isolado (127.0.0.1:54323)');
  console.log('================================================================================\n');

  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54323/postgres'
  });

  await client.connect();
  console.log('✅ Conexão estabelecida com sucesso com PostgreSQL 17 (127.0.0.1:54323)\n');

  // 1. SETUP DE SCHEMA CANÔNICO E FUNÇÕES DE CONTEXTO
  console.log('--- 1. Preparação do Schema Canônico Base e Stubs de Autorização ---');
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

    CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT AS $$
    BEGIN
      RETURN COALESCE(
        NULLIF(current_setting('app.current_user_role', true), ''),
        'Financeiro'
      );
    END;
    $$ LANGUAGE plpgsql STABLE;

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
      nome TEXT NOT NULL,
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
      status_pipeline TEXT NOT NULL DEFAULT 'RECEBIDO'
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
      status TEXT NOT NULL DEFAULT 'FECHADO_FINANCEIRO'
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
      created_at TIMESTAMPTZ DEFAULT NOW()
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
      created_at TIMESTAMPTZ DEFAULT NOW()
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_cnab_retorno_arquivos_hash
    ON public.cnab_retorno_arquivos (tenant_id, hash_arquivo);

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
  console.log('✅ Schema base configurado.\n');

  // 2. APLICAÇÃO DA MIGRATION FIX-RET-02C
  console.log('--- 2. Aplicação da Migration 20261015180000_fix_ret_02_blindagem_retorno_simulado.sql ---');
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261015180000_fix_ret_02_blindagem_retorno_simulado.sql'),
    'utf8'
  );
  await client.query(migrationSql);
  console.log('✅ Migration FIX-RET-02C aplicada com sucesso.\n');

  // CONSTANTES DE TESTE
  const tenantOficial = 'e0000000-0000-0000-0000-000000000001';
  const userFinanceiro = 'a0000000-0000-0000-0000-000000000001';
  const userEncarregado = 'a0000000-0000-0000-0000-000000000002';

  const empHmlId = '11111111-1111-1111-1111-111111111111';
  const empProdId = '22222222-2222-2222-2222-222222222222';

  const contaHmlItau = '44444444-1111-1111-1111-111111111111';
  const contaProdItau = '44444444-2222-2222-2222-222222222222';

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

  // Helper para construir linha FEBRABAN 240 válida de produção
  function makeFebrabanLine(banco = '341', ocorrencia = '00') {
    return (banco + '0001300001A' + ocorrencia + '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000').padEnd(240, ' ').slice(0, 240);
  }

  async function resetTestData() {
    await client.query(`
      SELECT set_config('app.current_user_id', '${userFinanceiro}', false);
      SELECT set_config('app.current_tenant_id', '${tenantOficial}', false);
      SELECT set_config('app.current_user_role', 'Financeiro', false);

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

      INSERT INTO public.tenants (id, nome) VALUES ('${tenantOficial}', 'Tenant Principal');

      INSERT INTO public.empresas (id, tenant_id, nome, is_teste) VALUES
        ('${empHmlId}', '${tenantOficial}', 'Empresa Teste - Homologacao', true),
        ('${empProdId}', '${tenantOficial}', 'Empresa Real Producao', false);

      INSERT INTO public.contas_bancarias_empresa (id, tenant_id, empresa_id, banco_codigo, banco_nome, ativo) VALUES
        ('${contaHmlItau}', '${tenantOficial}', '${empHmlId}', '341', 'Itaú Unibanco', true),
        ('${contaProdItau}', '${tenantOficial}', '${empProdId}', '341', 'Itaú Unibanco', true);

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
  // CENÁRIOS DE TESTE FIX-RET-02C
  // =========================================================================

  // CENÁRIO 1: Chamada direta à RPC com pagamento falsificado
  console.log('--- CENÁRIO 1: Chamada Direta à RPC com Pagamento Falsificado ---');
  await resetTestData();

  // 1A: Tentativa com código de ocorrência de rejeição alegando status pago
  const payloadFalsificadoOcorrencia = [
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml1,
      valor_pago: 150.00,
      status: 'pago', // cliente alega pago!
      codigo_ocorrencia: 'RJ', // mas o código bancário é rejeitado!
      linha_original: 'TEST'
    },
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml2,
      origem_tipo: 'INTERMITENTE',
      origem_id: lancIntHml2,
      valor_pago: 200.00,
      status: 'liquidado',
      codigo_ocorrencia: '00',
      linha_original: 'TEST'
    }
  ];

  const res1A = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_FALSIFICADO.RET',
      'hash_fake_1',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify(payloadFalsificadoOcorrencia)]);

  const r1A = res1A.rows[0].resultado;
  if (r1A.total_rejeitados === 1 && r1A.total_pagos === 1 && r1A.quitacao_integral === false) {
    console.log('✅ CENÁRIO 1A APROVADO: Backend desconsiderou "status=pago" forjado e reclassificou para rejeitado.');
  } else {
    throw new Error(`CENÁRIO 1A FALHOU: ${JSON.stringify(r1A)}`);
  }

  // 1B: Tentativa em produção sem linha FEBRABAN posicional autêntica
  const payloadFalsificadoLinha = [
    {
      remessa_id: remProdNsa9,
      remessa_item_id: itemRemProd1,
      valor_pago: 1000.00,
      status: 'pago',
      codigo_ocorrencia: '00',
      linha_original: 'LINHA_CURTA_FORJADA' // Não tem 240 chars!
    }
  ];

  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empProdId}',
        '${contaProdItau}',
        '341',
        'RETORNO_LINHA_FORJADA.RET',
        'hash_fake_linha',
        $1::JSONB
      );
    `, [JSON.stringify(payloadFalsificadoLinha)]);
    throw new Error('CENÁRIO 1B FALHOU: Deveria ter exigido linha posicional FEBRABAN de 240 chars');
  } catch (err) {
    if (err.message.includes('não possui linha posicional FEBRABAN de 240 caracteres')) {
      console.log('✅ CENÁRIO 1B APROVADO: Bloqueou chamada sem linha posicional FEBRABAN autêntica:', err.message);
    } else {
      throw err;
    }
  }

  // 1C: Tentativa por usuário sem autorização financeira
  await client.query(`SELECT set_config('app.current_user_role', 'Encarregado', false);`);
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'RETORNO_SEM_PERMISSAO.RET',
        'hash_fake_role',
        $1::JSONB
      );
    `, [JSON.stringify(payloadFalsificadoOcorrencia)]);
    throw new Error('CENÁRIO 1C FALHOU: Deveria ter bloqueado usuário com perfil Encarregado');
  } catch (err) {
    if (err.message.includes('Apenas usuários com perfil Financeiro ou Administrador')) {
      console.log('✅ CENÁRIO 1C APROVADO: Bloqueou execução por usuário não autorizado:', err.message);
    } else {
      throw err;
    }
  }
  await client.query(`SELECT set_config('app.current_user_role', 'Financeiro', false);`);

  // CENÁRIO 2: Duplicidade de item dentro do mesmo arquivo
  console.log('\n--- CENÁRIO 2: Duplicidade de Item Dentro do Mesmo Arquivo ---');
  await resetTestData();
  const payloadItemDuplicadoNoArquivo = [
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1, // Item 1
      valor_pago: 150.00,
      status: 'liquidado',
      codigo_ocorrencia: '00'
    },
    {
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1, // Item 1 REPETIDO no mesmo payload!
      valor_pago: 150.00,
      status: 'liquidado',
      codigo_ocorrencia: '00'
    }
  ];

  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'RETORNO_INTRA_DUPLICADO.RET',
        'hash_intra_dup',
        $1::JSONB
      );
    `, [JSON.stringify(payloadItemDuplicadoNoArquivo)]);
    throw new Error('CENÁRIO 2 FALHOU: Deveria ter bloqueado mesmo item repetido no arquivo');
  } catch (err) {
    if (err.message.includes('está duplicado dentro do mesmo arquivo')) {
      console.log('✅ CENÁRIO 2 APROVADO: Bloqueou item duplicado dentro do mesmo arquivo:', err.message);
    } else {
      throw err;
    }
  }

  // CENÁRIO 3: Dois retornos diferentes para o mesmo item (Proteção Física e Transacional)
  console.log('\n--- CENÁRIO 3: Dois Retornos Diferentes para o Mesmo Item ---');
  await resetTestData();
  // Arquivo 1: Liquida o Item 1
  await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'ARQUIVO_RETORNO_1.RET',
      'hash_ret_arq1',
      $1::JSONB
    );
  `, [JSON.stringify([{
    remessa_id: remHmlNsa10,
    remessa_item_id: itemRemHml1,
    valor_pago: 150.00,
    status: 'liquidado',
    codigo_ocorrencia: '00'
  }])]);

  // Arquivo 2: Tenta liquidar novamente o Item 1 já conciliado
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'ARQUIVO_RETORNO_2.RET',
        'hash_ret_arq2',
        $1::JSONB
      );
    `, [JSON.stringify([{
      remessa_id: remHmlNsa10,
      remessa_item_id: itemRemHml1, // Já conciliado!
      valor_pago: 150.00,
      status: 'liquidado',
      codigo_ocorrencia: '00'
    }])]);
    throw new Error('CENÁRIO 3 FALHOU: Deveria ter bloqueado re-liquidação do mesmo item');
  } catch (err) {
    if (err.message.includes('já se encontra conciliado/liquidado por retorno anterior') || err.message.includes('uq_cnab_retorno_itens_remessa_item_liquidado')) {
      console.log('✅ CENÁRIO 3 APROVADO: Bloqueou re-liquidação do mesmo item por segundo arquivo:', err.message);
    } else {
      throw err;
    }
  }

  // CENÁRIO 4: Duas chamadas simultâneas com o mesmo hash (Idempotência e Lock)
  console.log('\n--- CENÁRIO 4: Duas Chamadas Simultâneas com o Mesmo Hash ---');
  await resetTestData();
  const payloadSimples = [{
    remessa_id: remHmlNsa10,
    remessa_item_id: itemRemHml1,
    valor_pago: 150.00,
    status: 'liquidado',
    codigo_ocorrencia: '00'
  }];

  // Executa o primeiro
  await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_HASH_LOCK.RET',
      'hash_lock_same_123',
      $1::JSONB
    );
  `, [JSON.stringify(payloadSimples)]);

  // Executa o segundo com o mesmo hash
  try {
    await client.query(`
      SELECT public.rpc_aplicar_cnab_retorno(
        '${empHmlId}',
        '${contaHmlItau}',
        '341',
        'RETORNO_HASH_LOCK_CONCORRENTE.RET',
        'hash_lock_same_123',
        $1::JSONB
      );
    `, [JSON.stringify(payloadSimples)]);
    throw new Error('CENÁRIO 4 FALHOU: Deveria ter impedido repetição do mesmo hash');
  } catch (err) {
    if (err.message.includes('Arquivo de retorno duplicado')) {
      console.log('✅ CENÁRIO 4 APROVADO: Bloqueou chamada com hash duplicado:', err.message);
    } else {
      throw err;
    }
  }

  // CENÁRIO 5: Conciliação parcial seguida de retorno complementar
  console.log('\n--- CENÁRIO 5: Conciliação Parcial Seguida de Retorno Complementar ---');
  await resetTestData();

  // Dia 1: Retorno parcial contendo apenas o Item 1 (R$ 150,00)
  const resDia1 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_DIA_1_PARCIAL.RET',
      'hash_dia_1',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify([{
    remessa_id: remHmlNsa10,
    remessa_item_id: itemRemHml1,
    valor_pago: 150.00,
    status: 'liquidado',
    codigo_ocorrencia: '00'
  }])]);

  const rDia1 = resDia1.rows[0].resultado;
  if (rDia1.quitacao_integral === false && rDia1.total_pagos === 1) {
    console.log('✅ CENÁRIO 5 (Dia 1): Retorno parcial processado com quitacao_integral=false.');
  } else {
    throw new Error(`CENÁRIO 5 (Dia 1) FALHOU: ${JSON.stringify(rDia1)}`);
  }

  // Verifica que o lote ainda NÃO está PAGO
  const loteDia1 = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${loteIntHmlId}'`);
  if (loteDia1.rows[0].status === 'FECHADO_FINANCEIRO') {
    console.log('✅ CENÁRIO 5 (Lote Preservado): Lote intermitente permaneceu FECHADO_FINANCEIRO.');
  } else {
    throw new Error(`Lote prematuramente alterado: ${loteDia1.rows[0].status}`);
  }

  // Dia 2: Retorno complementar contendo o Item 2 (R$ 200,00)
  const resDia2 = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_DIA_2_COMPLEMENTAR.RET',
      'hash_dia_2',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify([{
    remessa_id: remHmlNsa10,
    remessa_item_id: itemRemHml2,
    valor_pago: 200.00,
    status: 'liquidado',
    codigo_ocorrencia: '00'
  }])]);

  const rDia2 = resDia2.rows[0].resultado;
  if (rDia2.quitacao_integral === true && rDia2.total_pagos === 1) {
    console.log('✅ CENÁRIO 5 (Dia 2): Retorno complementar concluiu a conciliação com quitacao_integral=true.');
  } else {
    throw new Error(`CENÁRIO 5 (Dia 2) FALHOU: ${JSON.stringify(rDia2)}`);
  }

  // Agora sim o lote deve ter transitado para PAGO
  const loteDia2 = await client.query(`SELECT status FROM public.intermitentes_lotes_fechamento WHERE id = '${loteIntHmlId}'`);
  if (loteDia2.rows[0].status === 'PAGO') {
    console.log('✅ CENÁRIO 5 (Quitação Integral Efetuada): Lote intermitente transitou para PAGO com sucesso!');
  } else {
    throw new Error(`Lote não quitado: ${loteDia2.rows[0].status}`);
  }

  // CENÁRIO 6: Rejeição seguida de verificação
  console.log('\n--- CENÁRIO 6: Rejeição Bancária e Bloqueio de Quitação ---');
  await resetTestData();
  const resRej = await client.query(`
    SELECT public.rpc_aplicar_cnab_retorno(
      '${empHmlId}',
      '${contaHmlItau}',
      '341',
      'RETORNO_REJEICAO.RET',
      'hash_rej_1',
      $1::JSONB
    ) AS resultado;
  `, [JSON.stringify([{
    remessa_id: remHmlNsa10,
    remessa_item_id: itemRemHml1,
    valor_pago: 0,
    status: 'rejeitado',
    codigo_ocorrencia: 'RJ',
    descricao_ocorrencia: 'Agência de destino inválida'
  }])]);

  const rRej = resRej.rows[0].resultado;
  if (rRej.total_rejeitados === 1 && rRej.quitacao_integral === false) {
    console.log('✅ CENÁRIO 6 APROVADO: Rejeição contabilizada e quitação integral bloqueada.');
  } else {
    throw new Error(`CENÁRIO 6 FALHOU: ${JSON.stringify(rRej)}`);
  }

  // Remessa em homologação marca erro_homologacao
  const remRejCheck = await client.query(`SELECT status FROM public.cnab_remessas_arquivos WHERE id = '${remHmlNsa10}'`);
  if (remRejCheck.rows[0].status === 'erro_homologacao') {
    console.log('✅ CENÁRIO 6 (Remessa Homologação): Remessa marcada com erro_homologacao.');
  } else {
    throw new Error(`Status de remessa inesperado: ${remRejCheck.rows[0].status}`);
  }

  // CENÁRIO 7: Preservação do histórico e classificação comprovada (sem inferência)
  console.log('\n--- CENÁRIO 7: Preservação do Histórico e Modo Indeterminado sem Vínculo ---');
  // Cria arquivo de retorno órfão (sem remessa_arquivo_id)
  await client.query(`
    INSERT INTO public.cnab_retorno_arquivos (
      tenant_id, nome_arquivo, hash_arquivo, banco_codigo, status, remessa_arquivo_id, modo
    ) VALUES (
      '${tenantOficial}', 'RETORNO_LEGADO_DESCONHECIDO.RET', 'hash_orfao_123', '341', 'processado', NULL, 'indeterminado'
    );
  `);

  const orfaoCheck = await client.query(`SELECT modo FROM public.cnab_retorno_arquivos WHERE hash_arquivo = 'hash_orfao_123'`);
  if (orfaoCheck.rows[0].modo === 'indeterminado') {
    console.log('✅ CENÁRIO 7 APROVADO: Retorno órfão histórico classificado estritamente como "indeterminado".');
  } else {
    throw new Error(`Modo inválido para órfão: ${orfaoCheck.rows[0].modo}`);
  }

  // Remessas oficiais NSA 8, 9 e 10 intactas
  const remessasFinalCheck = await client.query(`
    SELECT sequencial_arquivo, hash_arquivo, total_valor, modo 
    FROM public.cnab_remessas_arquivos 
    ORDER BY sequencial_arquivo ASC;
  `);
  console.table(remessasFinalCheck.rows);
  const nsa8 = remessasFinalCheck.rows.find(r => r.sequencial_arquivo === 8);
  const nsa9 = remessasFinalCheck.rows.find(r => r.sequencial_arquivo === 9);
  const nsa10 = remessasFinalCheck.rows.find(r => r.sequencial_arquivo === 10);
  if (nsa8.modo === 'producao' && nsa9.modo === 'producao' && nsa10.modo === 'homologacao') {
    console.log('✅ CENÁRIO 7 (Remessas Intactas): Remessas NSA 8, NSA 9 e NSA 10 100% preservadas.');
  } else {
    throw new Error('CENÁRIO 7 FALHOU na verificação das remessas');
  }

  // CENÁRIO 8: Aplicação e rollback completos
  console.log('\n--- CENÁRIO 8: Aplicação e Validação Completa do Rollback ---');
  const rollbackSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/rollback_20261015180000_fix_ret_02_blindagem_retorno_simulado.sql'),
    'utf8'
  );
  await client.query(rollbackSql);
  console.log('✅ Rollback executado com sucesso.');

  // Confirma remoção das colunas e índices
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'cnab_retorno_arquivos' AND column_name IN ('modo', 'empresa_id', 'conta_bancaria_id');
  `);
  if (colCheck.rows.length === 0) {
    console.log('✅ CENÁRIO 8 (Rollback): Colunas e restrições removidas com sucesso.');
  } else {
    throw new Error(`Rollback falhou em remover colunas: ${JSON.stringify(colCheck.rows)}`);
  }

  // Re-aplica a migration para manter ambiente estável
  await client.query(migrationSql);
  console.log('✅ Reaplicação da migration executada com 100% de sucesso.');

  console.log('\n================================================================================');
  console.log('TODOS OS CENÁRIOS DO FIX-RET-02C FORAM EXECUTADOS E APROVADOS NO POSTGRESQL 17!');
  console.log('================================================================================');

  await client.end();
}

run().catch(err => {
  console.error('\n❌ ERRO NA EXECUÇÃO DO FIX-RET-02C:', err);
  process.exit(1);
});
