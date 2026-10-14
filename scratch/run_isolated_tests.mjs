import pkg from 'pg';
const { Client } = pkg;

async function runTests() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54323,
    user: 'postgres',
    database: 'postgres'
  });

  await client.connect();
  console.log('=== CONECTADO AO POSTGRESQL 17.5 ISOLADO (PORTA 54323) ===\n');

  // IDs Fixos Sintéticos
  const tenantId = 'e0000000-0000-0000-0000-000000000001';
  const tenantAltId = 'e0000000-0000-0000-0000-000000000002';
  const userIdAdmin = 'a0000000-0000-0000-0000-000000000001';
  const userIdOp = 'a0000000-0000-0000-0000-000000000002';

  const empProdId = '11111111-1111-1111-1111-111111111111';
  const empHmlId = '22222222-2222-2222-2222-222222222222';
  const empAltTenantId = '33333333-3333-3333-3333-333333333333';

  const colabProdId = '44444444-1111-1111-1111-111111111111';
  const colabHmlId = '44444444-2222-2222-2222-222222222222';

  const ctaProdId = '55555555-1111-1111-1111-111111111111';
  const ctaHmlId = '55555555-2222-2222-2222-222222222222';

  const opProdId = '66666666-1111-1111-1111-111111111111';
  const opHmlId = '66666666-2222-2222-2222-222222222222';

  const seProdId = '77777777-1111-1111-1111-111111111111';
  const seHmlId = '77777777-2222-2222-2222-222222222222';

  const recProdId = '88888888-1111-1111-1111-111111111111';
  const recHmlId = '88888888-2222-2222-2222-222222222222';

  const fatProdId = '99999999-1111-1111-1111-111111111111';
  const fatHmlId = '99999999-2222-2222-2222-222222222222';

  const rliProdId = 'aaaaaaaa-1111-1111-1111-111111111111';
  const rliHmlId = 'aaaaaaaa-2222-2222-2222-222222222222';

  // Limpeza e Carga de Dados Sintéticos Isolados
  await client.query(`
    DELETE FROM public.cnab_auditoria_bancaria;
    DELETE FROM public.cnab_remessa_itens;
    DELETE FROM public.cnab_remessas_arquivos;
    DELETE FROM public.rh_financeiro_lote_itens;
    DELETE FROM public.contas_bancarias_empresa;
    DELETE FROM public.faturas;
    DELETE FROM public.receitas_operacionais_itens;
    DELETE FROM public.receitas_operacionais;
    DELETE FROM public.custos_extras_operacionais;
    DELETE FROM public.servicos_extras_operacionais;
    DELETE FROM public.operacoes_producao;
    DELETE FROM public.colaboradores;
    DELETE FROM public.empresas;
    DELETE FROM public.profiles;

    -- Profiles
    INSERT INTO public.profiles (id, user_id, role) VALUES 
      ('${userIdAdmin}', '${userIdAdmin}', 'admin'),
      ('${userIdOp}', '${userIdOp}', 'operador');

    -- Empresas
    INSERT INTO public.empresas (id, tenant_id, nome, is_teste) VALUES
      ('${empProdId}', '${tenantId}', 'EMPRESA REAL PRODUÇÃO S/A', false),
      ('${empHmlId}', '${tenantId}', 'EMPRESA TESTE HOMOLOGAÇÃO LTDA', true),
      ('${empAltTenantId}', '${tenantAltId}', 'EMPRESA OUTRO TENANT', false);

    -- Contas Bancárias
    INSERT INTO public.contas_bancarias_empresa (id, tenant_id, empresa_id, ativo, banco_codigo, banco_nome) VALUES
      ('${ctaProdId}', '${tenantId}', '${empProdId}', true, '001', 'BANCO DO BRASIL PROD'),
      ('${ctaHmlId}', '${tenantId}', '${empHmlId}', true, '001', 'BANCO DO BRASIL HML');

    -- Colaboradores
    INSERT INTO public.colaboradores (id, tenant_id, nome, is_teste) VALUES
      ('${colabProdId}', '${tenantId}', 'Colaborador Real de Produção', false),
      ('${colabHmlId}', '${tenantId}', 'Colaborador Sintético HML', true);

    -- Operações Produção
    INSERT INTO public.operacoes_producao (id, tenant_id, empresa_id, data_operacao, status, status_rh, atualizado_em) VALUES
      ('${opProdId}', '${tenantId}', '${empProdId}', '2026-10-13', 'RECEBIDO', 'PENDENTE', now()),
      ('${opHmlId}', '${tenantId}', '${empHmlId}', '2026-10-13', 'RECEBIDO', 'PENDENTE', now());

    -- Serviços Extras
    INSERT INTO public.servicos_extras_operacionais (id, tenant_id, empresa_id, data, pipeline_status, status_pagamento, atualizado_em) VALUES
      ('${seProdId}', '${tenantId}', '${empProdId}', '2026-10-13', 'PENDENTE', 'PENDENTE', now()),
      ('${seHmlId}', '${tenantId}', '${empHmlId}', '2026-10-13', 'PENDENTE', 'PENDENTE', now());

    -- Receitas Operacionais
    INSERT INTO public.receitas_operacionais (id, tenant_id, empresa_id, status, competencia, updated_at) VALUES
      ('${recProdId}', '${tenantId}', '${empProdId}', 'aguardando_fechamento', '2026-10', now()),
      ('${recHmlId}', '${tenantId}', '${empHmlId}', 'aguardando_fechamento', '2026-10', now());

    -- Faturas Base
    INSERT INTO public.faturas (id, tenant_id, empresa_id, colaborador_id, status, competencia, updated_at) VALUES
      ('${fatProdId}', '${tenantId}', '${empProdId}', '${colabProdId}', 'pendente', '2026-10', now()),
      ('${fatHmlId}', '${tenantId}', '${empHmlId}', '${colabHmlId}', 'pendente', '2026-10', now());

    -- Itens CLT
    INSERT INTO public.rh_financeiro_lote_itens (id, tenant_id, colaborador_id, status) VALUES
      ('${rliProdId}', '${tenantId}', '${colabProdId}', 'PENDENTE'),
      ('${rliHmlId}', '${tenantId}', '${colabHmlId}', 'PENDENTE');
  `);

  console.log('Carga sintética isolada concluída com sucesso.\n');

  const testResults = [];

  async function executeTest(code, title, category, testFn) {
    try {
      const result = await testFn();
      testResults.push({
        code,
        title,
        category,
        status: 'PASS',
        observed: result.observed,
        evidence: result.evidence
      });
      console.log(`[PASS] ${code}: ${title}`);
      console.log(`       Obs: ${result.observed}\n`);
    } catch (err) {
      testResults.push({
        code,
        title,
        category,
        status: 'FAIL',
        observed: `Falha com erro: ${err.message}`,
        evidence: err.stack
      });
      console.error(`[FAIL] ${code}: ${title}`);
      console.error(`       Erro: ${err.message}\n`);
    }
  }

  // Set Session context
  await client.query(`SET app.current_user_id = '${userIdAdmin}';`);
  await client.query(`SET app.current_tenant_id = '${tenantId}';`);

  // =========================================================================
  // BLOCO 1: fn_anti_mistura_receitas_operacionais_itens
  // =========================================================================

  // T01: Bloqueio de Operação HML vinculada a Receita de Produção
  await executeTest(
    'T01_REC_OP_HML_EM_PROD',
    'Bloqueio de Operação de Homologação vinculada a Receita de Produção',
    'fn_anti_mistura_receitas_operacionais_itens',
    async () => {
      try {
        await client.query(`
          INSERT INTO public.receitas_operacionais_itens (tenant_id, receita_id, operacao_id)
          VALUES ('${tenantId}', '${recProdId}', '${opHmlId}');
        `);
        throw new Error('Permitiu vincular operação de HML em receita de produção!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_ANTI_MISTURA')) {
          return {
            observed: 'Operação de Homologação rejeitada ao tentar vincular em Receita de Produção.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T02: Bloqueio de Operação PROD vinculada a Receita de Homologação
  await executeTest(
    'T02_REC_OP_PROD_EM_HML',
    'Bloqueio de Operação de Produção vinculada a Receita de Homologação',
    'fn_anti_mistura_receitas_operacionais_itens',
    async () => {
      try {
        await client.query(`
          INSERT INTO public.receitas_operacionais_itens (tenant_id, receita_id, operacao_id)
          VALUES ('${tenantId}', '${recHmlId}', '${opProdId}');
        `);
        throw new Error('Permitiu vincular operação de produção em receita de homologação!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_ANTI_MISTURA')) {
          return {
            observed: 'Operação de Produção rejeitada ao tentar vincular em Receita de Homologação.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T03: Bloqueio de Serviço Extra HML vinculado a Receita de Produção
  await executeTest(
    'T03_REC_SE_HML_EM_PROD',
    'Bloqueio de Serviço Extra de Homologação vinculado a Receita de Produção',
    'fn_anti_mistura_receitas_operacionais_itens',
    async () => {
      try {
        await client.query(`
          INSERT INTO public.receitas_operacionais_itens (tenant_id, receita_id, servico_extra_id)
          VALUES ('${tenantId}', '${recProdId}', '${seHmlId}');
        `);
        throw new Error('Permitiu vincular serviço extra de HML em receita de produção!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_ANTI_MISTURA')) {
          return {
            observed: 'Serviço Extra de Homologação rejeitado ao tentar vincular em Receita de Produção.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T04: Bloqueio de Serviço Extra PROD vinculado a Receita de Homologação
  await executeTest(
    'T04_REC_SE_PROD_EM_HML',
    'Bloqueio de Serviço Extra de Produção vinculado a Receita de Homologação',
    'fn_anti_mistura_receitas_operacionais_itens',
    async () => {
      try {
        await client.query(`
          INSERT INTO public.receitas_operacionais_itens (tenant_id, receita_id, servico_extra_id)
          VALUES ('${tenantId}', '${recHmlId}', '${seProdId}');
        `);
        throw new Error('Permitiu vincular serviço extra de produção em receita de homologação!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_ANTI_MISTURA')) {
          return {
            observed: 'Serviço Extra de Produção rejeitado ao tentar vincular em Receita de Homologação.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T05: Registros do mesmo ambiente em receitas operacionais (PROD em PROD, HML em HML)
  await executeTest(
    'T05_REC_ISOLAMENTO_HOMOLOGO',
    'Sucesso ao vincular itens de mesmo ambiente em Receitas Operacionais',
    'fn_anti_mistura_receitas_operacionais_itens',
    async () => {
      const res1 = await client.query(`
        INSERT INTO public.receitas_operacionais_itens (tenant_id, receita_id, operacao_id)
        VALUES ('${tenantId}', '${recProdId}', '${opProdId}') RETURNING id;
      `);
      const res2 = await client.query(`
        INSERT INTO public.receitas_operacionais_itens (tenant_id, receita_id, operacao_id)
        VALUES ('${tenantId}', '${recHmlId}', '${opHmlId}') RETURNING id;
      `);
      return {
        observed: 'Itens inseridos com sucesso quando os ambientes são estritamente correspondentes.',
        evidence: `Item Prod ID: ${res1.rows[0].id}, Item Hml ID: ${res2.rows[0].id}`
      };
    }
  );

  // =========================================================================
  // BLOCO 2: fn_anti_mistura_faturas
  // =========================================================================

  // T06: Bloqueio de Fatura Empresa PROD com Colaborador HML
  await executeTest(
    'T06_FAT_COLAB_HML_EM_EMP_PROD',
    'Bloqueio de Fatura para Empresa de Produção com Colaborador de Homologação',
    'fn_anti_mistura_faturas',
    async () => {
      try {
        await client.query(`
          INSERT INTO public.faturas (id, tenant_id, empresa_id, colaborador_id, status)
          VALUES (gen_random_uuid(), '${tenantId}', '${empProdId}', '${colabHmlId}', 'pendente');
        `);
        throw new Error('Permitiu gerar fatura para empresa de produção com colaborador de homologação!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_ANTI_MISTURA')) {
          return {
            observed: 'Fatura bloqueada com sucesso ao tentar vincular colaborador de Homologação a empresa de Produção.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T07: Bloqueio de Fatura Empresa HML com Colaborador PROD
  await executeTest(
    'T07_FAT_COLAB_PROD_EM_EMP_HML',
    'Bloqueio de Fatura para Empresa de Homologação com Colaborador de Produção',
    'fn_anti_mistura_faturas',
    async () => {
      try {
        await client.query(`
          INSERT INTO public.faturas (id, tenant_id, empresa_id, colaborador_id, status)
          VALUES (gen_random_uuid(), '${tenantId}', '${empHmlId}', '${colabProdId}', 'pendente');
        `);
        throw new Error('Permitiu gerar fatura para empresa de homologação com colaborador de produção!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_ANTI_MISTURA')) {
          return {
            observed: 'Fatura bloqueada com sucesso ao tentar vincular colaborador de Produção a empresa de Homologação.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T08: Faturas do mesmo ambiente e fatura sem colaborador
  await executeTest(
    'T08_FAT_ISOLAMENTO_HOMOLOGO',
    'Sucesso em Faturas com Colaboradores de mesmo ambiente e sem Colaborador',
    'fn_anti_mistura_faturas',
    async () => {
      const res1 = await client.query(`
        INSERT INTO public.faturas (id, tenant_id, empresa_id, colaborador_id, status)
        VALUES (gen_random_uuid(), '${tenantId}', '${empProdId}', '${colabProdId}', 'pendente') RETURNING id;
      `);
      const res2 = await client.query(`
        INSERT INTO public.faturas (id, tenant_id, empresa_id, colaborador_id, status)
        VALUES (gen_random_uuid(), '${tenantId}', '${empHmlId}', '${colabHmlId}', 'pendente') RETURNING id;
      `);
      const res3 = await client.query(`
        INSERT INTO public.faturas (id, tenant_id, empresa_id, colaborador_id, status)
        VALUES (gen_random_uuid(), '${tenantId}', '${empProdId}', null, 'pendente') RETURNING id;
      `);
      return {
        observed: 'Faturas de ambientes correspondentes e fatura sem colaborador persistidas com sucesso.',
        evidence: `Faturas criadas: Prod=${res1.rows[0].id}, Hml=${res2.rows[0].id}, SemColab=${res3.rows[0].id}`
      };
    }
  );

  // =========================================================================
  // BLOCO 3: rpc_registrar_cnab_remessa
  // =========================================================================

  // T09: Bloqueio de Remessa CNAB PROD contendo Fatura de Homologação
  await executeTest(
    'T09_CNAB_PROD_FATURA_HML',
    'Bloqueio de Remessa CNAB de Produção contendo Fatura de Homologação',
    'rpc_registrar_cnab_remessa',
    async () => {
      try {
        const payloadItens = JSON.stringify([
          {
            origem_tipo: 'FATURA',
            origem_id: fatHmlId,
            valor: 150.00
          }
        ]);
        await client.query(`
          SELECT public.rpc_registrar_cnab_remessa(
            '${ctaProdId}'::UUID,
            null::UUID,
            '${empProdId}'::UUID,
            'producao',
            'REMESSA_CONTAMINADA.REM',
            'HASH_TESTE_123',
            150.00,
            1,
            '${payloadItens}'::JSONB
          );
        `);
        throw new Error('Permitiu gerar remessa de produção com fatura de homologação!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_SEGURANCA_CNAB')) {
          return {
            observed: 'Remessa de produção abortada com BLOQUEIO_SEGURANCA_CNAB devido a item de fatura HML.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T10: Bloqueio de Remessa CNAB HML contendo Fatura de Produção
  await executeTest(
    'T10_CNAB_HML_FATURA_PROD',
    'Bloqueio de Remessa CNAB de Homologação contendo Fatura de Produção',
    'rpc_registrar_cnab_remessa',
    async () => {
      try {
        const payloadItens = JSON.stringify([
          {
            origem_tipo: 'FATURA',
            origem_id: fatProdId,
            valor: 200.00
          }
        ]);
        await client.query(`
          SELECT public.rpc_registrar_cnab_remessa(
            '${ctaHmlId}'::UUID,
            null::UUID,
            '${empHmlId}'::UUID,
            'homologacao',
            'REMESSA_CONTAMINADA_HML.REM',
            'HASH_TESTE_456',
            200.00,
            1,
            '${payloadItens}'::JSONB
          );
        `);
        throw new Error('Permitiu gerar remessa de homologação com fatura de produção!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_SEGURANCA_CNAB')) {
          return {
            observed: 'Remessa de homologação abortada com BLOQUEIO_SEGURANCA_CNAB devido a item de fatura Produção.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T11: Bloqueio de Remessa CNAB PROD contendo Item CLT com Colaborador de Homologação
  await executeTest(
    'T11_CNAB_PROD_CLT_HML',
    'Bloqueio de Remessa CNAB de Produção contendo Item CLT de Colaborador HML',
    'rpc_registrar_cnab_remessa',
    async () => {
      try {
        const payloadItens = JSON.stringify([
          {
            origem_tipo: 'CLT',
            origem_id: rliHmlId,
            valor: 350.00
          }
        ]);
        await client.query(`
          SELECT public.rpc_registrar_cnab_remessa(
            '${ctaProdId}'::UUID,
            null::UUID,
            '${empProdId}'::UUID,
            'producao',
            'REMESSA_CLT_CONTAMINADA.REM',
            'HASH_TESTE_789',
            350.00,
            1,
            '${payloadItens}'::JSONB
          );
        `);
        throw new Error('Permitiu gerar remessa de produção com item CLT de homologação!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_SEGURANCA_CNAB')) {
          return {
            observed: 'Remessa de produção abortada com BLOQUEIO_SEGURANCA_CNAB devido a colaborador CLT de HML.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T12: Bloqueio de Remessa CNAB HML contendo Item CLT com Colaborador de Produção
  await executeTest(
    'T12_CNAB_HML_CLT_PROD',
    'Bloqueio de Remessa CNAB de Homologação contendo Item CLT de Colaborador PROD',
    'rpc_registrar_cnab_remessa',
    async () => {
      try {
        const payloadItens = JSON.stringify([
          {
            origem_tipo: 'CLT',
            origem_id: rliProdId,
            valor: 350.00
          }
        ]);
        await client.query(`
          SELECT public.rpc_registrar_cnab_remessa(
            '${ctaHmlId}'::UUID,
            null::UUID,
            '${empHmlId}'::UUID,
            'homologacao',
            'REMESSA_CLT_CONTAMINADA_HML.REM',
            'HASH_TESTE_999',
            350.00,
            1,
            '${payloadItens}'::JSONB
          );
        `);
        throw new Error('Permitiu gerar remessa de homologação com item CLT de produção!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_SEGURANCA_CNAB')) {
          return {
            observed: 'Remessa de homologação abortada com BLOQUEIO_SEGURANCA_CNAB devido a colaborador CLT de Produção.',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T13: Remessa CNAB 100% Produção Executada com Sucesso
  await executeTest(
    'T13_CNAB_PROD_SUCESSO',
    'Sucesso na geração de Remessa CNAB 100% Produção',
    'rpc_registrar_cnab_remessa',
    async () => {
      const payloadItens = JSON.stringify([
        {
          origem_tipo: 'FATURA',
          origem_id: fatProdId,
          valor: 100.00
        },
        {
          origem_tipo: 'CLT',
          origem_id: rliProdId,
          valor: 200.00
        }
      ]);
      const res = await client.query(`
        SELECT public.rpc_registrar_cnab_remessa(
          '${ctaProdId}'::UUID,
          null::UUID,
          '${empProdId}'::UUID,
          'producao',
          'REMESSA_PROD_OK.REM',
          'HASH_PROD_100',
          300.00,
          2,
          '${payloadItens}'::JSONB
        ) as result;
      `);
      const data = res.rows[0].result;
      if (data.sucesso && data.modo === 'producao' && data.linhas_afetadas === 2) {
        return {
          observed: 'Remessa de produção gerada perfeitamente com status modo="producao" e 2 itens auditados.',
          evidence: JSON.stringify(data)
        };
      }
      throw new Error(`Retorno inesperado da remessa: ${JSON.stringify(data)}`);
    }
  );

  // T14: Remessa CNAB 100% Homologação Executada com Sucesso
  await executeTest(
    'T14_CNAB_HML_SUCESSO',
    'Sucesso na geração de Remessa CNAB 100% Homologação',
    'rpc_registrar_cnab_remessa',
    async () => {
      const payloadItens = JSON.stringify([
        {
          origem_tipo: 'FATURA',
          origem_id: fatHmlId,
          valor: 115.20
        },
        {
          origem_tipo: 'CLT',
          origem_id: rliHmlId,
          valor: 84.80
        }
      ]);
      const res = await client.query(`
        SELECT public.rpc_registrar_cnab_remessa(
          '${ctaHmlId}'::UUID,
          null::UUID,
          '${empHmlId}'::UUID,
          'homologacao',
          'REMESSA_HML_OK.REM',
          'HASH_HML_100',
          200.00,
          2,
          '${payloadItens}'::JSONB
        ) as result;
      `);
      const data = res.rows[0].result;
      if (data.sucesso && data.modo === 'homologacao' && data.linhas_afetadas === 2) {
        return {
          observed: 'Remessa de homologação gerada perfeitamente com status modo="homologacao" e 2 itens auditados.',
          evidence: JSON.stringify(data)
        };
      }
      throw new Error(`Retorno inesperado da remessa: ${JSON.stringify(data)}`);
    }
  );

  // T15: Blindagem contra spoofing de modo pelo cliente (p_modo='producao' em empresa de homologação)
  await executeTest(
    'T15_CNAB_SPOOFING_MODO_PROTEGIDO',
    'Blindagem contra manipulação do parâmetro p_modo pelo cliente',
    'rpc_registrar_cnab_remessa',
    async () => {
      const payloadItens = JSON.stringify([
        {
          origem_tipo: 'FATURA',
          origem_id: fatHmlId,
          valor: 115.20
        }
      ]);
      const res = await client.query(`
        SELECT public.rpc_registrar_cnab_remessa(
          '${ctaHmlId}'::UUID,
          null::UUID,
          '${empHmlId}'::UUID,
          'producao', -- Tentativa de spoofing pelo cliente
          'REMESSA_SPOOF_TEST.REM',
          'HASH_SPOOF',
          115.20,
          1,
          '${payloadItens}'::JSONB
        ) as result;
      `);
      const data = res.rows[0].result;
      if (data.sucesso && data.modo === 'homologacao') {
        return {
          observed: 'O backend ignorou p_modo="producao" do cliente e forçou autoritariamente modo="homologacao" com base em empresas.is_teste.',
          evidence: JSON.stringify(data)
        };
      }
      throw new Error(`Falha na contenção de spoofing de modo: ${JSON.stringify(data)}`);
    }
  );

  // =========================================================================
  // BLOCO 4: rpc_encerrar_homologacao_empresa
  // =========================================================================

  // T16: Bloqueio de encerramento em Empresa de Produção
  await executeTest(
    'T16_ENCERRAMENTO_BLOQUEIO_PRODUCAO',
    'Bloqueio estrito de encerramento seguro em Empresa de Produção real',
    'rpc_encerrar_homologacao_empresa',
    async () => {
      try {
        await client.query(`
          SELECT public.rpc_encerrar_homologacao_empresa(
            '${empProdId}'::UUID,
            'Tentativa de encerramento indevido de empresa real'
          );
        `);
        throw new Error('Permitiu invocar encerramento seguro em empresa de produção!');
      } catch (err) {
        if (err.message.includes('BLOQUEIO_SEGURANCA')) {
          return {
            observed: 'Encerramento bloqueado: função recusou execução sobre empresa real (is_teste = false).',
            evidence: err.message
          };
        }
        throw err;
      }
    }
  );

  // T17: Encerramento Seguro de Empresa de Homologação
  await executeTest(
    'T17_ENCERRAMENTO_SUCESSO_HOMOLOGACAO',
    'Execução com sucesso do encerramento lógico sobre Empresa de Homologação',
    'rpc_encerrar_homologacao_empresa',
    async () => {
      const res = await client.query(`
        SELECT public.rpc_encerrar_homologacao_empresa(
          '${empHmlId}'::UUID,
          'Homologacao técnica dos bloqueios financeiros concluída com sucesso'
        ) as result;
      `);
      const data = res.rows[0].result;
      if (data.success && data.empresaId === empHmlId) {
        return {
          observed: 'Encerramento executado com sucesso e auditado em cnab_auditoria_bancaria.',
          evidence: JSON.stringify(data)
        };
      }
      throw new Error(`Falha no encerramento de homologação: ${JSON.stringify(data)}`);
    }
  );

  await client.end();

  console.log('\n=== RESUMO FINAL DOS TESTES EXECUTADOS NO POSTGRESQL 17.5 ISOLADO ===');
  const passCount = testResults.filter(t => t.status === 'PASS').length;
  const failCount = testResults.filter(t => t.status === 'FAIL').length;
  console.log(`Total: ${testResults.length} | Aprovados: ${passCount} | Falhas: ${failCount}`);

  return testResults;
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
