import pkg from 'pg';
const { Client } = pkg;
import { gerarRelatorioSimulacaoHomologacao, validarRelatorioSimulacao } from '../src/services/cnab/simulacaoHomologacao.service.js';

async function runTests() {
  const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
  await client.connect();
  console.log('=== TESTES FINAIS DIRECIONADOS — FIX-CNAB-04 (PORTA 54323) ===\n');

  const tenantId = 'e0000000-0000-0000-0000-000000000001';
  const userId = 'a0000000-0000-0000-0000-000000000001';

  const empHmlId = '11111111-1111-1111-1111-111111111111';
  const contaHmlId = '33333333-1111-1111-1111-111111111111';

  const colabHml1 = '44444444-1111-1111-1111-111111111111';
  const colabHml2 = '44444444-2222-2222-2222-222222222222';

  const rhLoteId = '55555555-1111-1111-1111-111111111111';
  const rhItem1 = '66666666-1111-1111-1111-111111111111';

  const intLoteId = '77777777-1111-1111-1111-111111111111';
  const intLanc1 = '88888888-1111-1111-1111-111111111111';
  const intLanc2 = '88888888-2222-2222-2222-222222222222';

  const diaLoteId = '99999999-1111-1111-1111-111111111111';
  const diaLanc1 = 'aaaaaaaa-1111-1111-1111-111111111111';

  // Configura contexto da sessão
  await client.query(`
    SELECT set_config('app.current_user_id', '${userId}', false);
    SELECT set_config('app.current_tenant_id', '${tenantId}', false);
    SELECT set_config('app.current_role', 'authenticated', false);
  `);

  // Limpar tabelas com TRUNCATE CASCADE
  await client.query(`
    TRUNCATE TABLE 
      public.cnab_auditoria_bancaria,
      public.cnab_remessa_itens,
      public.cnab_remessas_arquivos,
      public.rh_financeiro_lote_itens,
      public.rh_financeiro_lotes,
      public.lancamentos_intermitentes,
      public.intermitentes_lotes_fechamento,
      public.lancamentos_diaristas,
      public.diaristas_lotes_fechamento,
      public.lotes_remessa,
      public.contas_bancarias_empresa,
      public.faturas,
      public.colaboradores,
      public.empresas,
      public.cnab_sequencial_controle
    CASCADE;
  `);

  // Inserir Empresas e Contas
  await client.query(`
    INSERT INTO public.empresas (id, tenant_id, nome, is_teste) VALUES
      ('${empHmlId}', '${tenantId}', 'Empresa Teste Homologacao', true);

    INSERT INTO public.contas_bancarias_empresa (id, tenant_id, empresa_id, ativo, banco_codigo, banco_nome) VALUES
      ('${contaHmlId}', '${tenantId}', '${empHmlId}', true, '341', 'BANCO ITAU SA');

    INSERT INTO public.colaboradores (id, tenant_id, nome, is_teste) VALUES
      ('${colabHml1}', '${tenantId}', 'Colaborador Um', true),
      ('${colabHml2}', '${tenantId}', 'Colaborador Dois', true);

    INSERT INTO public.rh_financeiro_lotes (id, tenant_id, empresa_id, status, competencia) VALUES
      ('${rhLoteId}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');

    INSERT INTO public.rh_financeiro_lote_itens (id, tenant_id, lote_id, colaborador_id, status) VALUES
      ('${rhItem1}', '${tenantId}', '${rhLoteId}', '${colabHml1}', 'PENDENTE');

    INSERT INTO public.lotes_remessa (id, tenant_id, empresa_id, status) VALUES
      ('${rhLoteId}', '${tenantId}', '${empHmlId}', 'pronto');

    INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia) VALUES
      ('${intLoteId}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');

    INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline, valor_total) VALUES
      ('${intLanc1}', '${tenantId}', '${empHmlId}', '${intLoteId}', '${colabHml1}', 'ENVIADO_FINANCEIRO', 300.0),
      ('${intLanc2}', '${tenantId}', '${empHmlId}', '${intLoteId}', '${colabHml2}', 'ENVIADO_FINANCEIRO', 300.0);

    INSERT INTO public.diaristas_lotes_fechamento (id, tenant_id, empresa_id, status, status_conciliacao) VALUES
      ('${diaLoteId}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', 'aguardando_conciliacao');

    INSERT INTO public.lancamentos_diaristas (id, tenant_id, empresa_id, lote_fechamento_id, status) VALUES
      ('${diaLanc1}', '${tenantId}', '${empHmlId}', '${diaLoteId}', 'FECHADO_FINANCEIRO');
  `);

  console.log('Ambiente base carregado com sucesso.\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // Geração de relatórios via service canônico TypeScript
  const relIntermitentes = gerarRelatorioSimulacaoHomologacao({
    origem: 'INTERMITENTES',
    empresaNome: 'Empresa Teste Homologacao',
    bancoCodigo: '341',
    bancoNome: 'BANCO ITAÚ (341)',
    sequencial: 1,
    totalRegistros: 2,
    totalValor: 600.0,
    beneficiarios: [
      { nome: 'Colaborador Um', valor: 300.0 },
      { nome: 'Colaborador Dois', valor: 300.0 }
    ]
  });

  const relDiaristas = gerarRelatorioSimulacaoHomologacao({
    origem: 'DIARISTAS',
    empresaNome: 'Empresa Teste Homologacao',
    bancoCodigo: '341',
    bancoNome: 'BANCO ITAÚ (341)',
    sequencial: 2,
    totalRegistros: 1,
    totalValor: 150.0,
    beneficiarios: [
      { nome: 'Diarista Um', valor: 150.0 }
    ]
  });

  const relCLT = gerarRelatorioSimulacaoHomologacao({
    origem: 'CLT',
    empresaNome: 'Empresa Teste Homologacao',
    bancoCodigo: '341',
    bancoNome: 'BANCO ITAÚ (341)',
    sequencial: 3,
    totalRegistros: 1,
    totalValor: 1500.0,
    beneficiarios: [
      { nome: 'Colaborador CLT Um', valor: 1500.0 }
    ]
  });

  // Validar gerador TypeScript contra validador TypeScript
  const valCheck = validarRelatorioSimulacao(relIntermitentes.content, 'INTERMITENTES');
  assert(valCheck.valido === true, '0. TypeScript Validator: Validador confirma fidelidade de ORBE_SIMULACAO_CNAB_V1');

  // ─── 1. Relatório estruturado válido ──────────────────────────────────────
  try {
    const res = await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => '${relIntermitentes.fileName}',
        p_hash_arquivo => 'hash_rel_valido_01',
        p_total_valor => 600.00,
        p_total_registros => 2,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${intLoteId}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([
        { origem_tipo: 'INTERMITENTE', origem_id: intLanc1, valor: 300.00 },
        { origem_tipo: 'INTERMITENTE', origem_id: intLanc2, valor: 300.00 }
      ]),
      relIntermitentes.content
    ]);

    const obj = res.rows[0].res;
    assert(obj.sucesso === true && obj.sequencial === 1, '1. Relatório estruturado válido: aceito com sucesso pela RPC');
  } catch (err) {
    console.error('[FAIL] 1. Relatório válido falhou:', err.message);
    failed++;
  }

  // ─── 2. Relatório com versão inválida ─────────────────────────────────────
  try {
    const loteVersaoInvalida = '77777777-2222-2222-2222-222222222222';
    const lancVersaoInvalida = '88888888-3333-3333-3333-333333333333';
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia)
      VALUES ('${loteVersaoInvalida}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');
      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline, valor_total)
      VALUES ('${lancVersaoInvalida}', '${tenantId}', '${empHmlId}', '${loteVersaoInvalida}', '${colabHml1}', 'ENVIADO_FINANCEIRO', 100.0);
    `);

    const relVersaoInvalida = relIntermitentes.content.replace('VERSAO_FORMATO: 1.0', 'VERSAO_FORMATO: 99.0');

    await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => 'VERSAO_INVALIDA.txt',
        p_hash_arquivo => 'hash_versao_invalida',
        p_total_valor => 100.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${loteVersaoInvalida}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: lancVersaoInvalida, valor: 100.00 }]),
      relVersaoInvalida
    ]);

    console.error('[FAIL] 2. Versão inválida deveria ter sido rejeitada!');
    failed++;
  } catch (err) {
    assert(err.message.includes('Versão de formato do relatório de simulação não suportada'),
      '2. Relatório com versão inválida: rejeitado com erro de conformidade');
  }

  // ─── 3. Relatório com modalidade divergente ───────────────────────────────
  try {
    const loteModalidadeDivergente = '77777777-3333-3333-3333-333333333333';
    const lancModalidadeDivergente = '88888888-4444-4444-4444-444444444444';
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia)
      VALUES ('${loteModalidadeDivergente}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');
      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline, valor_total)
      VALUES ('${lancModalidadeDivergente}', '${tenantId}', '${empHmlId}', '${loteModalidadeDivergente}', '${colabHml1}', 'ENVIADO_FINANCEIRO', 100.0);
    `);

    // Passar relatório com MODALIDADE: DIARISTAS para um lote de INTERMITENTES
    const relModDivergente = relIntermitentes.content.replace('MODALIDADE: INTERMITENTES', 'MODALIDADE: DIARISTAS');

    await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => 'MODALIDADE_DIVERGENTE.txt',
        p_hash_arquivo => 'hash_mod_divergente',
        p_total_valor => 100.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${loteModalidadeDivergente}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: lancModalidadeDivergente, valor: 100.00 }]),
      relModDivergente
    ]);

    console.error('[FAIL] 3. Modalidade divergente deveria ter sido rejeitada!');
    failed++;
  } catch (err) {
    assert(err.message.includes('modalidade divergente para remessa de Intermitentes'),
      '3. Relatório com modalidade divergente: rejeitado com integridade garantida');
  }

  // ─── 4. Conteúdo bancário disfarçado de simulação ─────────────────────────
  try {
    const loteDisfarcado = '77777777-4444-4444-4444-444444444444';
    const lancDisfarcado = '88888888-5555-5555-5555-555555555555';
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia)
      VALUES ('${loteDisfarcado}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');
      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline, valor_total)
      VALUES ('${lancDisfarcado}', '${tenantId}', '${empHmlId}', '${loteDisfarcado}', '${colabHml1}', 'ENVIADO_FINANCEIRO', 100.0);
    `);

    // Injeta linha FEBRABAN posicional de 240 caracteres no meio do relatório
    const rawFebrabanLine = '341' + '0'.repeat(237);
    const relDisfarcado = relIntermitentes.content.replace(
      'FIM_RELATORIO_SIMULACAO',
      `${rawFebrabanLine}\r\nFIM_RELATORIO_SIMULACAO`
    );

    await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => 'DISFARCADO_FEBRABAN.txt',
        p_hash_arquivo => 'hash_disfarcado_01',
        p_total_valor => 100.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${loteDisfarcado}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: lancDisfarcado, valor: 100.00 }]),
      relDisfarcado
    ]);

    console.error('[FAIL] 4. Conteúdo bancário disfarçado de simulação deveria ter sido rejeitado!');
    failed++;
  } catch (err) {
    assert(err.message.includes('registros bancários posicionais FEBRABAN de 240 caracteres'),
      '4. Conteúdo bancário disfarçado de simulação: detectado e rejeitado na varredura');
  }

  // ─── 5. Conteúdo adicional não permitido (fora da estrutura) ──────────────
  try {
    const loteInjecao = '77777777-5555-5555-5555-555555555555';
    const lancInjecao = '88888888-6666-6666-6666-666666666666';
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia)
      VALUES ('${loteInjecao}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');
      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline, valor_total)
      VALUES ('${lancInjecao}', '${tenantId}', '${empHmlId}', '${loteInjecao}', '${colabHml1}', 'ENVIADO_FINANCEIRO', 100.0);
    `);

    // Injeta linha de texto arbitrário/payload não autorizado
    const relInjecao = relIntermitentes.content.replace(
      'FIM_RELATORIO_SIMULACAO',
      `PAYLOAD_EXTRA_NAO_PERMITIDO: EXFILTRACAO_OU_CORRUPCAO\r\nFIM_RELATORIO_SIMULACAO`
    );

    await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => 'INJECAO_EXTRA.txt',
        p_hash_arquivo => 'hash_injecao_01',
        p_total_valor => 100.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${loteInjecao}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: lancInjecao, valor: 100.00 }]),
      relInjecao
    ]);

    console.error('[FAIL] 5. Conteúdo adicional fora da estrutura deveria ter sido rejeitado!');
    failed++;
  } catch (err) {
    assert(err.message.includes('linha inválida fora da estrutura permitida') || err.message.includes('Falha de Segurança Bancária'),
      '5. Conteúdo adicional não permitido: rejeitado pela gramática restritiva');
  }

  // ─── 6. Chamada CLT com conteúdo validado ─────────────────────────────────
  try {
    const res = await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => '${rhLoteId}'::UUID,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => '${relCLT.fileName}',
        p_hash_arquivo => 'hash_clt_validado_01',
        p_total_valor => 1500.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([{ origem_tipo: 'CLT', origem_id: rhItem1, valor: 1500.00 }]),
      relCLT.content
    ]);

    const obj = res.rows[0].res;
    assert(obj.sucesso === true && obj.sequencial === 2, '6. Chamada CLT com conteúdo validado: aceita com sucesso (NSA = 2)');

    const checkCLT = await client.query(`SELECT status FROM public.lotes_remessa WHERE id = '${rhLoteId}'`);
    assert(checkCLT.rows[0].status === 'gerado', '6b. Lote CLT transiciona atomicamente para "gerado"');
  } catch (err) {
    console.error('[FAIL] 6. Chamada CLT com conteúdo validado falhou:', err.message);
    failed++;
  }

  // ─── 7. Intermitentes e Diaristas com persistência atômica ────────────────
  try {
    const resDia = await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => '${relDiaristas.fileName}',
        p_hash_arquivo => 'hash_dia_atomico_01',
        p_total_valor => 150.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_diaristas_lote_id => '${diaLoteId}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([{ origem_tipo: 'DIARISTA', origem_id: diaLanc1, valor: 150.00 }]),
      relDiaristas.content
    ]);

    const objDia = resDia.rows[0].res;
    assert(objDia.sucesso === true && objDia.sequencial === 3, '7. Diaristas com persistência atômica: registrado com sucesso (NSA = 3)');

    const checkDia = await client.query(`SELECT status, status_conciliacao FROM public.diaristas_lotes_fechamento WHERE id = '${diaLoteId}'`);
    assert(checkDia.rows[0].status === 'cnab_gerado' && checkDia.rows[0].status_conciliacao === 'aguardando_conciliacao',
      '7b. Diaristas: Status do lote atualizado atomicamente na mesma transação');
  } catch (err) {
    console.error('[FAIL] 7. Erro na persistência atômica de diaristas:', err.message);
    failed++;
  }

  // ─── 8. Duplicidade de remessa: BLOQUEADA ──────────────────────────────────
  try {
    await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => 'TENTATIVA_DUPLICIDADE.txt',
        p_hash_arquivo => 'hash_dup_tentativa',
        p_total_valor => 600.00,
        p_total_registros => 2,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${intLoteId}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([
        { origem_tipo: 'INTERMITENTE', origem_id: intLanc1, valor: 300.00 },
        { origem_tipo: 'INTERMITENTE', origem_id: intLanc2, valor: 300.00 }
      ]),
      relIntermitentes.content
    ]);

    console.error('[FAIL] 8. Duplicidade de remessa deveria ter sido bloqueada!');
    failed++;
  } catch (err) {
    assert(err.message.includes('BLOQUEIO_DUPLICIDADE_CNAB') || err.message.includes('Geração bloqueada'),
      '8. Duplicidade de remessa: bloqueada com erro explícito');
  }

  // ─── 9. Concorrência: Apenas 1 transação é aceita ─────────────────────────
  try {
    const loteConc = '77777777-6666-6666-6666-666666666666';
    const lancConc = '88888888-7777-7777-7777-777777777777';
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia)
      VALUES ('${loteConc}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');
      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline, valor_total)
      VALUES ('${lancConc}', '${tenantId}', '${empHmlId}', '${loteConc}', '${colabHml1}', 'ENVIADO_FINANCEIRO', 250.0);
    `);

    const relConc1 = gerarRelatorioSimulacaoHomologacao({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste Homologacao',
      bancoCodigo: '341',
      sequencial: 4,
      totalRegistros: 1,
      totalValor: 250.0
    });

    const client2 = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
    await client2.connect();
    await client2.query(`
      SELECT set_config('app.current_user_id', '${userId}', false);
      SELECT set_config('app.current_tenant_id', '${tenantId}', false);
      SELECT set_config('app.current_role', 'authenticated', false);
    `);

    const p1 = client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => 'CONCORRENCIA_1.txt',
        p_hash_arquivo => 'hash_conc_1',
        p_total_valor => 250.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${loteConc}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: lancConc, valor: 250.00 }]), relConc1.content]);

    const p2 = client2.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => 'CONCORRENCIA_2.txt',
        p_hash_arquivo => 'hash_conc_2',
        p_total_valor => 250.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${loteConc}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: lancConc, valor: 250.00 }]), relConc1.content]);

    const results = await Promise.allSettled([p1, p2]);
    await client2.end();

    const succ = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;

    assert(succ === 1 && fail === 1, '9. Concorrência: Exatamente 1 chamada é aceita e a concorrente é bloqueada');
  } catch (err) {
    console.error('[FAIL] 9. Erro no teste de concorrência:', err.message);
    failed++;
  }

  // ─── 10. Falha transacional com rollback do NSA ───────────────────────────
  try {
    const seqBefore = await client.query(`
      SELECT ultimo_sequencial FROM public.cnab_sequencial_controle 
      WHERE tenant_id = '${tenantId}' AND conta_bancaria_id = '${contaHmlId}' AND banco_codigo = '341'
    `);
    const valorAntes = seqBefore.rows[0]?.ultimo_sequencial;

    try {
      await client.query(`
        SELECT public.rpc_registrar_cnab_remessa(
          p_conta_bancaria_id => '${contaHmlId}'::UUID,
          p_lote_id => NULL,
          p_empresa_id => '${empHmlId}'::UUID,
          p_modo => 'homologacao',
          p_nome_arquivo => 'FALHA_ROLLBACK.txt',
          p_hash_arquivo => 'hash_falha_rollback',
          p_total_valor => 99999.00,
          p_total_registros => 1,
          p_itens => $1::JSONB,
          p_intermitentes_lote_id => NULL,
          p_conteudo_arquivo => $2::TEXT
        ) as res;
      `, [JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: intLanc1, valor: 300.00 }]), relIntermitentes.content]);
    } catch (e) {
      // Esperado falhar por divergência de valor
    }

    const seqAfter = await client.query(`
      SELECT ultimo_sequencial FROM public.cnab_sequencial_controle 
      WHERE tenant_id = '${tenantId}' AND conta_bancaria_id = '${contaHmlId}' AND banco_codigo = '341'
    `);
    const valorDepois = seqAfter.rows[0]?.ultimo_sequencial;

    assert(valorAntes === valorDepois, '10. Falha transacional com rollback do NSA: sequencial bancário não consumido');
  } catch (err) {
    console.error('[FAIL] 10. Erro no teste de rollback do NSA:', err.message);
    failed++;
  }

  // ─── 11. Compatibilidade da assinatura da RPC ─────────────────────────────
  try {
    // Chamada com parâmetros nomeados sem especificar parâmetros opcionais com default
    const resAssinatura = await client.query(`
      SELECT specific_name, parameter_name, ordinal_position, parameter_default
      FROM information_schema.parameters
      WHERE specific_schema = 'public' AND specific_name LIKE 'rpc_registrar_cnab_remessa%'
      ORDER BY ordinal_position;
    `);

    const paramNames = resAssinatura.rows.map(r => r.parameter_name);
    const hasAllParams = [
      'p_conta_bancaria_id', 'p_lote_id', 'p_empresa_id', 'p_modo', 'p_nome_arquivo',
      'p_hash_arquivo', 'p_total_valor', 'p_total_registros', 'p_itens',
      'p_diaristas_lote_id', 'p_intermitentes_lote_id', 'p_conteudo_arquivo',
      'p_competencia', 'p_observacoes'
    ].every(p => paramNames.includes(p));

    assert(hasAllParams && resAssinatura.rows.length === 14,
      '11. Compatibilidade da assinatura da RPC: 14 parâmetros canônicos declarados sem sobrecargas ambíguas');
  } catch (err) {
    console.error('[FAIL] 11. Erro ao verificar assinatura da RPC:', err.message);
    failed++;
  }

  // ─── 12. Preservação dos registros históricos NSA 8 e NSA 9 ────────────────
  try {
    const nsa8LoteId = 'a242f36f-e300-47e2-8b64-1da55a9328a9';
    const nsa8RemessaId = '6201f810-746b-4e00-84a1-872f2dc593e9';
    const nsa9LoteId = '67b0d4c0-7878-43ab-8cd2-06d67f58909f';
    const nsa9RemessaId = '8aebd6bc-d9d5-4a42-8ffa-1e2f4ef42543';

    await client.query(`
      INSERT INTO public.lotes_remessa (id, tenant_id, empresa_id, status)
      VALUES ('${nsa8LoteId}', '${tenantId}', '${empHmlId}', 'gerado')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia)
      VALUES ('${nsa9LoteId}', '${tenantId}', '${empHmlId}', 'CNAB_GERADO', '2026-10')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.cnab_remessas_arquivos (
        id, tenant_id, empresa_id, lote_id, conta_bancaria_id,
        nome_arquivo, sequencial_arquivo, hash_arquivo, total_registros, total_valor,
        modo, status, usuario_geracao, banco_codigo, banco_nome
      ) VALUES (
        '${nsa8RemessaId}', '${tenantId}', '${empHmlId}', '${nsa8LoteId}', '${contaHmlId}',
        'CB341_CLT_NSA8.txt', 8, 'hash_historico_nsa8', 8, 2400.00,
        'homologacao', 'gerado', '${userId}', '341', 'BANCO ITAU SA'
      );

      INSERT INTO public.cnab_remessas_arquivos (
        id, tenant_id, empresa_id, intermitentes_lote_id, conta_bancaria_id,
        nome_arquivo, sequencial_arquivo, hash_arquivo, total_registros, total_valor,
        modo, status, usuario_geracao, banco_codigo, banco_nome, competencia
      ) VALUES (
        '${nsa9RemessaId}', '${tenantId}', '${empHmlId}', '${nsa9LoteId}', '${contaHmlId}',
        'CB341_INT_NSA9.txt', 9, 'hash_historico_nsa9', 2, 600.00,
        'homologacao', 'gerado', '${userId}', '341', 'BANCO ITAU SA', '2026-10'
      );

      UPDATE public.cnab_sequencial_controle 
      SET ultimo_sequencial = 9
      WHERE tenant_id = '${tenantId}' AND conta_bancaria_id = '${contaHmlId}' AND banco_codigo = '341';
    `);

    // Validar próximo sequencial bancário
    const nextSeq = await client.query(`
      SELECT public.get_next_cnab_sequencial('${tenantId}'::UUID, '${contaHmlId}'::UUID, '341') as seq;
    `);
    assert(nextSeq.rows[0].seq === 10, '12. Preservação Histórica: NSA 8 e 9 coexistindo e próximo NSA é 10');

    // Validar que os índices parciais cobrem NSA 8 e 9
    const idxCheck = await client.query(`
      SELECT count(*) FROM public.cnab_remessas_arquivos WHERE id IN ('${nsa8RemessaId}', '${nsa9RemessaId}')
    `);
    assert(Number(idxCheck.rows[0].count) === 2, '12b. Remessas históricas NSA 8 e NSA 9 indexadas sem conflito');
  } catch (err) {
    console.error('[FAIL] 12. Erro no teste de remessas históricas:', err.message);
    failed++;
  }

  // ─── 13. Sincronização Estrita de NSA e Prevenção de Divergência Concorrente ─
  try {
    const loteSync = '77777777-feed-cafe-babe-111111111111';
    const lancSync = '88888888-feed-cafe-babe-222222222222';
    await client.query(`
      INSERT INTO public.intermitentes_lotes_fechamento (id, tenant_id, empresa_id, status, competencia)
      VALUES ('${loteSync}', '${tenantId}', '${empHmlId}', 'FECHADO_FINANCEIRO', '2026-10');
      INSERT INTO public.lancamentos_intermitentes (id, tenant_id, empresa_id, lote_fechamento_id, colaborador_id, status_pipeline, valor_total)
      VALUES ('${lancSync}', '${tenantId}', '${empHmlId}', '${loteSync}', '${colabHml1}', 'ENVIADO_FINANCEIRO', 100.0);
    `);

    // Criar relatório com sequencial simulado antigo (ex: 000001), embora o banco esteja no NSA 10
    const relComDivergencia = gerarRelatorioSimulacaoHomologacao({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste Homologacao',
      bancoCodigo: '341',
      bancoNome: 'BANCO ITAÚ (341)',
      sequencial: 1, // Divergente do próximo NSA real (11)
      totalRegistros: 1,
      totalValor: 100.0,
      beneficiarios: [{ nome: 'Colaborador Um', valor: 100.0 }]
    });

    const resSync = await client.query(`
      SELECT public.rpc_registrar_cnab_remessa(
        p_conta_bancaria_id => '${contaHmlId}'::UUID,
        p_lote_id => NULL,
        p_empresa_id => '${empHmlId}'::UUID,
        p_modo => 'homologacao',
        p_nome_arquivo => '${relComDivergencia.fileName}',
        p_hash_arquivo => 'hash_desatualizado_pelo_cliente',
        p_total_valor => 100.00,
        p_total_registros => 1,
        p_itens => $1::JSONB,
        p_intermitentes_lote_id => '${loteSync}'::UUID,
        p_conteudo_arquivo => $2::TEXT
      ) as res;
    `, [
      JSON.stringify([{ origem_tipo: 'INTERMITENTE', origem_id: lancSync, valor: 100.00 }]),
      relComDivergencia.content
    ]);

    const objSync = resSync.rows[0].res;
    const nsaAlocado = objSync.sequencial; // Deve ser 11

    const checkDb = await client.query(`
      SELECT sequencial_arquivo, hash_arquivo, conteudo_arquivo, nome_arquivo 
      FROM public.cnab_remessas_arquivos 
      WHERE id = '${objSync.remessa_id}';
    `);
    const dbRow = checkDb.rows[0];

    const matchSeq = dbRow.conteudo_arquivo.includes(`SEQUENCIAL_SIMULADO: ${String(nsaAlocado).padStart(6, '0')}`);
    const matchNome = dbRow.nome_arquivo.includes(`_SEQ${String(nsaAlocado).padStart(6, '0')}.txt`);

    assert(
      nsaAlocado === 11 && dbRow.sequencial_arquivo === 11 && matchSeq && matchNome,
      '13. Sincronização Estrita de NSA: conteúdo e nome_arquivo sincronizados atomicamente com sequencial_arquivo'
    );
  } catch (err) {
    console.error('[FAIL] 13. Erro no teste de sincronização de NSA:', err.message);
    failed++;
  }

  // ─── 14. Integridade Criptográfica do Hash ─────────────────────────────────
  try {
    const checkHashRow = await client.query(`
      SELECT hash_arquivo, encode(sha256(convert_to(conteudo_arquivo, 'UTF8')), 'hex') as hash_real
      FROM public.cnab_remessas_arquivos 
      WHERE intermitentes_lote_id = '77777777-feed-cafe-babe-111111111111';
    `);
    const r = checkHashRow.rows[0];

    assert(
      r.hash_arquivo === r.hash_real && r.hash_arquivo.length === 64,
      '14. Integridade do Hash: hash_arquivo gravado corresponde com exatidão ao SHA-256 do conteúdo persistido'
    );
  } catch (err) {
    console.error('[FAIL] 14. Erro no teste de integridade do hash:', err.message);
    failed++;
  }

  // ─── 15. Gramática Estrutural no TypeScript ────────────────────────────────
  try {
    const relValido = gerarRelatorioSimulacaoHomologacao({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste',
      bancoCodigo: '341',
      sequencial: 1,
      totalRegistros: 1,
      totalValor: 100.0,
      beneficiarios: [{ nome: 'Favorecido', valor: 100.0 }]
    });

    // Injeção de linha após encerramento
    const relComLixo = relValido.content + 'LINHA_EXTRA_PROIBIDA\r\n';
    const valLixo = validarRelatorioSimulacao(relComLixo);

    // Linha fora de ordem
    const relForaDeOrdem = relValido.content.replace('ORBE_SIMULACAO_CNAB_V1\r\n', '');
    const valOrdem = validarRelatorioSimulacao(relForaDeOrdem);

    assert(
      valLixo.valido === false && valOrdem.valido === false,
      '15. Validador TypeScript: Rejeita conteúdo adicional e linhas fora de ordem'
    );
  } catch (err) {
    console.error('[FAIL] 15. Erro no teste de gramática TypeScript:', err.message);
    failed++;
  }

  console.log(`\n==================================================`);
  console.log(`TOTAL DE TESTES DIRECIONADOS EXECUTADOS: ${passed + failed}`);
  console.log(`APROVADOS: ${passed}`);
  console.log(`FALHAS: ${failed}`);
  console.log(`==================================================\n`);

  await client.end();
}

runTests().catch(console.error);

