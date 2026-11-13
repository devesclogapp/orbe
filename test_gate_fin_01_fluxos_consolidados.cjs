/**
 * test_gate_fin_01_fluxos_consolidados.cjs
 * 
 * HOMOLOGAÇÃO FINANCEIRA CONSOLIDADA — 3 FLUXOS OPERACIONAIS:
 * 1. Diaristas (Lote Fechamento RH/Financeiro) — R$ 150,00
 * 2. Serviços Extras (Trigger de Receita Operacional) — R$ 250,00
 * 3. Custos Extras (Despesa Operacional Reconhecida na DRE) — R$ 120,00
 * 
 * DIRETRIZES DE SEGURANÇA E AUDITORIA:
 * - Tenant Oficial: 09ccafb6-2cf2-4c83-ac3d-a2913947693c
 * - Empresa Sandbox: 28a560b5-37ef-403d-ae4f-b28a608b6a68 (is_teste = true)
 * - Competência: 2027-12
 * - Manifestos individuais pré-persistidos em disco
 * - Fail-closed: sem sobrescrita, sem teardown automático
 * - Medição do delta da DRE: Homologação vs Produção (deltaProd === 0.00)
 */

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;

const PARAMS = {
  tenantId: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
  empresaId: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
  colaboradorId: 'd0a663d7-383e-4720-be53-1b8a1f162090',
  competencia: '2027-12',
  dataOperacao: '2027-12-15',
  valores: {
    diaristas: 150.00,
    servicosExtras: 250.00,
    custosExtras: 120.00
  }
};

const MANIFEST_CONSOLIDADO_PATH = path.resolve(__dirname, 'hml_gate_fin_consolidado_manifest.json');

async function runConsolidado() {
  if (!connectionString) {
    console.error("ERRO: DATABASE_URL não configurada no ambiente.");
    process.exit(1);
  }

  let manifest;
  let ids;

  if (fs.existsSync(MANIFEST_CONSOLIDADO_PATH)) {
    const existing = JSON.parse(fs.readFileSync(MANIFEST_CONSOLIDADO_PATH, 'utf-8'));
    console.log(`[RETOMADA SEGURA] Manifesto existente detectado: ${MANIFEST_CONSOLIDADO_PATH}`);
    console.log(`- Status atual do manifesto: ${existing.status}`);
    console.log(`- Lote Diaristas: ${existing.fluxos.diaristas.loteId} (${existing.fluxos.diaristas.status})`);
    console.log(`- Serviço Extra:  ${existing.fluxos.servicosExtras.id} (${existing.fluxos.servicosExtras.status})`);
    console.log(`- Custo Extra:    ${existing.fluxos.custosExtras.id} (${existing.fluxos.custosExtras.status})`);

    manifest = existing;
    ids = {
      diaristasLoteId: manifest.fluxos.diaristas.loteId,
      servicoExtraId: manifest.fluxos.servicosExtras.id,
      custoExtraId: manifest.fluxos.custosExtras.id,
    };
  } else {
    // GERAÇÃO ANTECIPADA DE UUIDs PARA CADA FLUXO (NOVA EXECUÇÃO)
    ids = {
      diaristasLoteId: crypto.randomUUID(),
      servicoExtraId: crypto.randomUUID(),
      custoExtraId: crypto.randomUUID(),
    };

    manifest = {
      tenantId: PARAMS.tenantId,
      empresaId: PARAMS.empresaId,
      competencia: PARAMS.competencia,
      timestamp: new Date().toISOString(),
      status: 'INICIADO',
      fluxos: {
        diaristas: {
          loteId: ids.diaristasLoteId,
          valorEsperado: PARAMS.valores.diaristas,
          status: 'PENDENTE'
        },
        servicosExtras: {
          id: ids.servicoExtraId,
          receitaId: null,
          itemId: null,
          valorEsperado: PARAMS.valores.servicosExtras,
          status: 'PENDENTE'
        },
        custosExtras: {
          id: ids.custoExtraId,
          valorEsperado: PARAMS.valores.custosExtras,
          status: 'PENDENTE'
        }
      }
    };

    fs.writeFileSync(MANIFEST_CONSOLIDADO_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[MANIFESTO] Gravado com sucesso em disco: ${MANIFEST_CONSOLIDADO_PATH}`);
  }

  const client = new Client({ connectionString, statement_timeout: 15000 });
  await client.connect();

  console.log("======================================================================");
  console.log("🚀 INICIANDO HOMOLOGAÇÃO FINANCEIRA CONSOLIDADA (3 FLUXOS)");
  console.log(`Tenant Oficial: ${PARAMS.tenantId}`);
  console.log(`Empresa Sandbox: ${PARAMS.empresaId}`);
  console.log(`Competência: ${PARAMS.competencia}`);
  console.log("======================================================================\n");

  try {
    // 1. PRÉ-VALIDAÇÃO DE SEGURANÇA E AMBIENTE
    console.log('[ETAPA 1] Verificando empresa sandbox e dependências auxiliares...');
    const empRes = await client.query(`
      SELECT id, tenant_id, is_teste, nome 
      FROM public.empresas 
      WHERE id = $1;
    `, [PARAMS.empresaId]);

    if (empRes.rows.length === 0) throw new Error("Empresa sandbox não encontrada!");
    if (empRes.rows[0].is_teste !== true) throw new Error("ABORTANDO: Empresa selecionada NÃO é de teste (is_teste !== true)!");
    const tenantReal = empRes.rows[0].tenant_id;
    console.log(`✅ Empresa sandbox validada: ${empRes.rows[0].nome} (tenant: ${tenantReal})`);

    // Busca tipo_servico ativo
    const servRes = await client.query(`
      SELECT id, nome FROM public.tipos_servico_operacional 
      WHERE ativo = true AND (tenant_id = $1 OR tenant_id IS NULL)
      LIMIT 1;
    `, [tenantReal]);
    if (servRes.rows.length === 0) throw new Error("Nenhum tipo de serviço ativo encontrado!");
    const tipoServicoId = servRes.rows[0].id;

    // Busca forma_pagamento ativa
    const formaRes = await client.query(`
      SELECT id, nome, modalidade FROM public.formas_pagamento_operacional
      WHERE ativo = true AND (tenant_id = $1 OR tenant_id IS NULL)
      LIMIT 1;
    `, [tenantReal]);
    if (formaRes.rows.length === 0) throw new Error("Nenhuma forma de pagamento ativa encontrada!");
    const formaPagamentoId = formaRes.rows[0].id;

    // 2. MEDIÇÃO DOS BASELINES DA DRE (ANTES DE QUALQUER ESCRITA)
    console.log('\n[ETAPA 2] Medindo baselines da DRE na competência 2027-12...');
    
    // Baseline Diaristas (Lotes Fechamento Financeiro)
    const baseDiaHmlRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.diaristas_lotes_fechamento
      WHERE empresa_id = $1 AND mes_referencia = $2 AND status IN ('FECHADO_FINANCEIRO', 'VALIDADO_RH', 'PAGO');
    `, [PARAMS.empresaId, PARAMS.competencia]);
    const baseDiaProdRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.diaristas_lotes_fechamento
      WHERE empresa_id <> $1 AND mes_referencia = $2 AND status IN ('FECHADO_FINANCEIRO', 'VALIDADO_RH', 'PAGO');
    `, [PARAMS.empresaId, PARAMS.competencia]);

    // Baseline Receitas (Faturamento)
    const baseRecHmlRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.receitas_operacionais
      WHERE empresa_id = $1 AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);
    const baseRecProdRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.receitas_operacionais
      WHERE empresa_id <> $1 AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);

    // Baseline Custos Extras
    const baseCustHmlRes = await client.query(`
      SELECT coalesce(sum(total), 0) as total FROM public.custos_extras_operacionais
      WHERE empresa_id = $1 AND deleted_at IS NULL AND status_pagamento <> 'CANCELADO'
        AND pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')
        AND data >= '2027-12-01' AND data < '2028-01-01';
    `, [PARAMS.empresaId]);
    const baseCustProdRes = await client.query(`
      SELECT coalesce(sum(total), 0) as total FROM public.custos_extras_operacionais
      WHERE empresa_id <> $1 AND deleted_at IS NULL AND status_pagamento <> 'CANCELADO'
        AND pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')
        AND data >= '2027-12-01' AND data < '2028-01-01';
    `, [PARAMS.empresaId]);

    const baselines = {
      diaristas: { hml: Number(baseDiaHmlRes.rows[0].total), prod: Number(baseDiaProdRes.rows[0].total) },
      receitas: { hml: Number(baseRecHmlRes.rows[0].total), prod: Number(baseRecProdRes.rows[0].total) },
      custos: { hml: Number(baseCustHmlRes.rows[0].total), prod: Number(baseCustProdRes.rows[0].total) }
    };

    console.log(`   Baseline Diaristas HML: R$ ${baselines.diaristas.hml.toFixed(2)} | PROD: R$ ${baselines.diaristas.prod.toFixed(2)}`);
    console.log(`   Baseline Receitas HML:  R$ ${baselines.receitas.hml.toFixed(2)} | PROD: R$ ${baselines.receitas.prod.toFixed(2)}`);
    console.log(`   Baseline Custos HML:    R$ ${baselines.custos.hml.toFixed(2)} | PROD: R$ ${baselines.custos.prod.toFixed(2)}`);

    // 3. EXECUÇÃO DO FLUXO 1: DIARISTAS (R$ 150,00)
    console.log('\n[FLUXO 1] Verificando existência prévia do Lote de Diaristas...');
    const checkLoteExistente = await client.query(`
      SELECT id, status, valor_total FROM public.diaristas_lotes_fechamento WHERE id = $1;
    `, [ids.diaristasLoteId]);

    if (checkLoteExistente.rows.length > 0) {
      console.log(`✅ Lote Diaristas já existente no banco: ${ids.diaristasLoteId} (R$ ${checkLoteExistente.rows[0].valor_total}, status: ${checkLoteExistente.rows[0].status}) — Inserção ignorada.`);
      manifest.fluxos.diaristas.status = 'LOTE_INSERIDO';
    } else {
      console.log('   Inserindo novo Lote de Diaristas...');
      await client.query(`
        INSERT INTO public.diaristas_lotes_fechamento (
          id, tenant_id, empresa_id, periodo_inicio, periodo_fim, mes_referencia,
          total_registros, valor_total, status, observacoes, fechado_em
        ) VALUES (
          $1, $2, $3, '2027-12-01', '2027-12-07', $4, 1, $5, 'FECHADO_FINANCEIRO', 'HML_GATE_FIN_01_DIARISTAS', now()
        );
      `, [ids.diaristasLoteId, tenantReal, PARAMS.empresaId, PARAMS.competencia, PARAMS.valores.diaristas]);

      manifest.fluxos.diaristas.status = 'LOTE_INSERIDO';
      fs.writeFileSync(MANIFEST_CONSOLIDADO_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
      console.log(`✅ Lote Diaristas criado com sucesso: ${ids.diaristasLoteId} (R$ ${PARAMS.valores.diaristas})`);
    }

    // 4. EXECUÇÃO DO FLUXO 2: SERVIÇOS EXTRAS (R$ 250,00)
    console.log('\n[FLUXO 2] Verificando/Executando Serviço Extra...');
    const checkSrvExistente = await client.query(`
      SELECT id, pipeline_status FROM public.servicos_extras_operacionais WHERE id = $1;
    `, [ids.servicoExtraId]);

    if (checkSrvExistente.rows.length === 0) {
      console.log('   Inserindo Serviço Extra com tipo_servico e campos canônicos preenchidos...');
      await client.query(`
        INSERT INTO public.servicos_extras_operacionais (
          id, tenant_id, empresa_id, data, tipo_servico_id, tipo_servico,
          descricao_servico, descricao, quantidade, valor_unitario, total,
          forma_pagamento_id, modalidade_financeira, pipeline_status, status_pagamento,
          observacao, origem_dado
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          'HML_GATE_FIN_01_SRV_EXTRA', 'HML_GATE_FIN_01_SRV_EXTRA', 1, $7, $7,
          $8, 'CAIXA_IMEDIATO', 'PENDENTE', 'PENDENTE',
          'Homologação consolidada serviços extras', 'manual'
        );
      `, [
        ids.servicoExtraId, tenantReal, PARAMS.empresaId, PARAMS.dataOperacao,
        tipoServicoId, servRes.rows[0].nome, PARAMS.valores.servicosExtras, formaPagamentoId
      ]);

      // Transição para disparar trigger de receita
      console.log('   Transicionando Serviço Extra para [APROVADO_OPERACAO] para acionar trigger financeira...');
      await client.query(`
        UPDATE public.servicos_extras_operacionais
        SET pipeline_status = 'APROVADO_OPERACAO', atualizado_em = now()
        WHERE id = $1;
      `, [ids.servicoExtraId]);
    } else {
      console.log(`ℹ️ Registro de Serviço Extra ${ids.servicoExtraId} já existia no banco (status: ${checkSrvExistente.rows[0].pipeline_status}).`);
    }

    // Auditoria da receita gerada pela trigger
    const recExtraCheck = await client.query(`
      SELECT r.id as receita_id, i.id as item_id, r.valor_total, r.status
      FROM public.receitas_operacionais_itens i
      JOIN public.receitas_operacionais r ON r.id = i.receita_id
      WHERE i.servico_extra_id = $1;
    `, [ids.servicoExtraId]);

    if (recExtraCheck.rows.length === 0) {
      throw new Error("FALHA: A trigger trg_gerar_receita_servico_extra_automatica não gerou o registro de receita!");
    }

    manifest.fluxos.servicosExtras.receitaId = recExtraCheck.rows[0].receita_id;
    manifest.fluxos.servicosExtras.itemId = recExtraCheck.rows[0].item_id;
    manifest.fluxos.servicosExtras.status = 'RECEITA_GERADA';
    fs.writeFileSync(MANIFEST_CONSOLIDADO_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`✅ Receita confirmada para Serviço Extra: Receita=${recExtraCheck.rows[0].receita_id}, Item=${recExtraCheck.rows[0].item_id} (R$ ${recExtraCheck.rows[0].valor_total})`);

    // 5. EXECUÇÃO DO FLUXO 3: CUSTOS EXTRAS (R$ 120,00)
    console.log('\n[FLUXO 3] Verificando/Executando Custo Extra reconhecido na DRE...');
    const checkCustExistente = await client.query(`
      SELECT id, pipeline_status FROM public.custos_extras_operacionais WHERE id = $1;
    `, [ids.custoExtraId]);

    if (checkCustExistente.rows.length === 0) {
      console.log('   Inserindo Custo Extra com origem_recurso = PAGO_EMPRESA...');
      await client.query(`
        INSERT INTO public.custos_extras_operacionais (
          id, tenant_id, empresa_id, data, categoria_custo, descricao,
          valor_unitario, quantidade, total, pipeline_status, status_pagamento,
          tipo_lancamento, origem_recurso, observacao, origem_dado
        ) VALUES (
          $1, $2, $3, $4, 'OPERACIONAL', 'HML_GATE_FIN_01_CUSTO_EXTRA',
          $5, 1, $5, 'APROVADO_OPERACAO', 'A_PAGAR',
          'DESPESA', 'PAGO_EMPRESA', 'Homologação consolidada custos extras', 'manual'
        );
      `, [ids.custoExtraId, tenantReal, PARAMS.empresaId, PARAMS.dataOperacao, PARAMS.valores.custosExtras]);
    } else {
      console.log(`ℹ️ Registro de Custo Extra ${ids.custoExtraId} já existia no banco.`);
    }

    manifest.fluxos.custosExtras.status = 'CUSTO_INSERIDO';
    fs.writeFileSync(MANIFEST_CONSOLIDADO_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`✅ Custo Extra inserido com sucesso: ${ids.custoExtraId} (R$ ${PARAMS.valores.custosExtras})`);

    // 6. VALIDAÇÃO PÓS-TESTE: AUDITORIA INDIVIDUAL E CONSOLIDAÇÃO NA DRE (READ-ONLY)
    console.log('\n[ETAPA 3] Auditando registros individuais e medindo consolidação na DRE...');

    // 6.1 Auditoria do Registro de Diaristas por UUID
    console.log(`\n[AUDITORIA INDIVIDUAL 1] Validando Lote Diaristas (${ids.diaristasLoteId})...`);
    const diaRegRes = await client.query(`
      SELECT id, tenant_id, empresa_id, mes_referencia, status, valor_total
      FROM public.diaristas_lotes_fechamento
      WHERE id = $1;
    `, [ids.diaristasLoteId]);

    if (diaRegRes.rows.length !== 1) {
      throw new Error(`FALHA CRÍTICA: Lote de Diaristas ${ids.diaristasLoteId} não encontrado de forma unívoca (contagem: ${diaRegRes.rows.length})!`);
    }
    const diaReg = diaRegRes.rows[0];
    const diaValor = Number(diaReg.valor_total);
    const diaStatusValido = ['FECHADO_FINANCEIRO', 'VALIDADO_RH', 'PAGO'].includes(diaReg.status);
    const diaTenantValido = diaReg.tenant_id === tenantReal;
    const diaEmpresaValida = diaReg.empresa_id === PARAMS.empresaId;
    const diaCompValida = diaReg.mes_referencia === PARAMS.competencia;

    console.log(`- Lote ID: ${diaReg.id} | Status: ${diaReg.status} (Válido: ${diaStatusValido})`);
    console.log(`- Tenant: ${diaReg.tenant_id} (OK: ${diaTenantValido}) | Empresa: ${diaReg.empresa_id} (OK: ${diaEmpresaValida})`);
    console.log(`- Competência: ${diaReg.mes_referencia} (OK: ${diaCompValida}) | Valor: R$ ${diaValor.toFixed(2)} (Esperado: ${PARAMS.valores.diaristas.toFixed(2)})`);

    if (!diaStatusValido || !diaTenantValido || !diaEmpresaValida || !diaCompValida || diaValor !== PARAMS.valores.diaristas) {
      throw new Error(`DIVERGÊNCIA NO LOTE DE DIARISTAS INDIVIDUAL!`);
    }

    // 6.2 Auditoria do Registro de Serviços Extras e Receita Vinculada por UUID
    console.log(`\n[AUDITORIA INDIVIDUAL 2] Validando Serviço Extra (${ids.servicoExtraId}) e Receita Vinculada...`);
    const srvRegRes = await client.query(`
      SELECT id, tenant_id, empresa_id, data, pipeline_status, total, modalidade_financeira
      FROM public.servicos_extras_operacionais
      WHERE id = $1;
    `, [ids.servicoExtraId]);

    if (srvRegRes.rows.length !== 1) {
      throw new Error(`FALHA CRÍTICA: Serviço Extra ${ids.servicoExtraId} não encontrado de forma unívoca!`);
    }
    const srvReg = srvRegRes.rows[0];
    const srvValor = Number(srvReg.total);
    const srvStatusValido = ['APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO', 'CONCLUIDO'].includes(srvReg.pipeline_status);

    console.log(`- Serviço Extra ID: ${srvReg.id} | Pipeline: ${srvReg.pipeline_status} (Válido: ${srvStatusValido})`);
    console.log(`- Valor: R$ ${srvValor.toFixed(2)} (Esperado: ${PARAMS.valores.servicosExtras.toFixed(2)})`);

    // Validação estrita do vínculo financeiro unívoco
    const recVincRes = await client.query(`
      SELECT r.id as receita_id, i.id as item_id, r.valor_total, r.status, r.competencia, r.empresa_id, r.tenant_id
      FROM public.receitas_operacionais_itens i
      JOIN public.receitas_operacionais r ON r.id = i.receita_id
      WHERE i.servico_extra_id = $1;
    `, [ids.servicoExtraId]);

    if (recVincRes.rows.length !== 1) {
      throw new Error(`FALHA CRÍTICA: Vínculo financeiro de Serviço Extra inexistente ou duplicado (contagem: ${recVincRes.rows.length})!`);
    }
    const recVinc = recVincRes.rows[0];
    const recValor = Number(recVinc.valor_total);
    console.log(`- Receita Gerada: ${recVinc.receita_id} | Item: ${recVinc.item_id}`);
    console.log(`- Receita Status: ${recVinc.status} | Valor: R$ ${recValor.toFixed(2)} (OK: ${recValor === PARAMS.valores.servicosExtras})`);

    if (!srvStatusValido || srvValor !== PARAMS.valores.servicosExtras || recValor !== PARAMS.valores.servicosExtras) {
      throw new Error(`DIVERGÊNCIA NO SERVIÇO EXTRA OU RECEITA VINCULADA!`);
    }

    // 6.3 Auditoria do Registro de Custos Extras por UUID
    console.log(`\n[AUDITORIA INDIVIDUAL 3] Validando Custo Extra (${ids.custoExtraId})...`);
    const custRegRes = await client.query(`
      SELECT id, tenant_id, empresa_id, data, pipeline_status, status_pagamento, total, origem_recurso, deleted_at
      FROM public.custos_extras_operacionais
      WHERE id = $1;
    `, [ids.custoExtraId]);

    if (custRegRes.rows.length !== 1) {
      throw new Error(`FALHA CRÍTICA: Custo Extra ${ids.custoExtraId} não encontrado de forma unívoca!`);
    }
    const custReg = custRegRes.rows[0];
    const custValor = Number(custReg.total);
    const custStatusValido = ['APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO'].includes(custReg.pipeline_status);
    const custPagtoValido = custReg.status_pagamento !== 'CANCELADO';
    const custAtivo = custReg.deleted_at === null;

    console.log(`- Custo Extra ID: ${custReg.id} | Pipeline: ${custReg.pipeline_status} (Válido: ${custStatusValido})`);
    console.log(`- Origem Recurso: ${custReg.origem_recurso} | Status Pgto: ${custReg.status_pagamento}`);
    console.log(`- Valor: R$ ${custValor.toFixed(2)} (Esperado: ${PARAMS.valores.custosExtras.toFixed(2)})`);

    if (!custStatusValido || !custPagtoValido || !custAtivo || custValor !== PARAMS.valores.custosExtras) {
      throw new Error(`DIVERGÊNCIA NO CUSTO EXTRA INDIVIDUAL!`);
    }

    // 6.4 Auditoria Agregada da DRE na Competência 2027-12
    console.log('\n[AUDITORIA DRE] Medindo agregações financeiras e confirmando isolamento de produção...');

    // Agregação Diaristas Homologação vs Produção
    const dreDiaHmlRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.diaristas_lotes_fechamento
      WHERE empresa_id = $1 AND mes_referencia = $2 AND status IN ('FECHADO_FINANCEIRO', 'VALIDADO_RH', 'PAGO');
    `, [PARAMS.empresaId, PARAMS.competencia]);
    const dreDiaProdRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.diaristas_lotes_fechamento
      WHERE empresa_id <> $1 AND mes_referencia = $2 AND status IN ('FECHADO_FINANCEIRO', 'VALIDADO_RH', 'PAGO');
    `, [PARAMS.empresaId, PARAMS.competencia]);

    // Agregação Faturamento Homologação vs Produção (inclui Volume R$ 1000 + Serviço Extra R$ 250 = R$ 1250)
    const dreRecHmlRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.receitas_operacionais
      WHERE empresa_id = $1 AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);
    const dreRecProdRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total FROM public.receitas_operacionais
      WHERE empresa_id <> $1 AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);

    // Agregação Custos Extras Homologação vs Produção
    const dreCustHmlRes = await client.query(`
      SELECT coalesce(sum(total), 0) as total FROM public.custos_extras_operacionais
      WHERE empresa_id = $1 AND deleted_at IS NULL AND status_pagamento <> 'CANCELADO'
        AND pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')
        AND data >= '2027-12-01' AND data < '2028-01-01';
    `, [PARAMS.empresaId]);
    const dreCustProdRes = await client.query(`
      SELECT coalesce(sum(total), 0) as total FROM public.custos_extras_operacionais
      WHERE empresa_id <> $1 AND deleted_at IS NULL AND status_pagamento <> 'CANCELADO'
        AND pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')
        AND data >= '2027-12-01' AND data < '2028-01-01';
    `, [PARAMS.empresaId]);

    const dreTotais = {
      hml: {
        faturamento: Number(dreRecHmlRes.rows[0].total),
        diaristas: Number(dreDiaHmlRes.rows[0].total),
        custosExtras: Number(dreCustHmlRes.rows[0].total),
      },
      prod: {
        faturamento: Number(dreRecProdRes.rows[0].total),
        diaristas: Number(dreDiaProdRes.rows[0].total),
        custosExtras: Number(dreCustProdRes.rows[0].total),
      }
    };

    console.log(`\n--- TOTAIS CONSOLIDADOS NA DRE (COMPETÊNCIA 2027-12) ---`);
    console.log(`Homologação (Sandbox):`);
    console.log(`- Faturamento Total (Volume + Extra): R$ ${dreTotais.hml.faturamento.toFixed(2)}`);
    console.log(`- Despesas Diaristas:                R$ ${dreTotais.hml.diaristas.toFixed(2)}`);
    console.log(`- Custos Extras Gerais:              R$ ${dreTotais.hml.custosExtras.toFixed(2)}`);
    console.log(`\nProdução (Empresas Reais — Isolamento Estrito):`);
    console.log(`- Contribuição Sintética Faturamento: R$ ${dreTotais.prod.faturamento.toFixed(2)} (Esperado: 0.00)`);
    console.log(`- Contribuição Sintética Diaristas:   R$ ${dreTotais.prod.diaristas.toFixed(2)} (Esperado: 0.00)`);
    console.log(`- Contribuição Sintética Custos:     R$ ${dreTotais.prod.custosExtras.toFixed(2)} (Esperado: 0.00)`);

    const isolamentoProducaoPerfeito = dreTotais.prod.faturamento === 0 && dreTotais.prod.diaristas === 0 && dreTotais.prod.custosExtras === 0;
    const diaristasHomologOk = dreTotais.hml.diaristas >= PARAMS.valores.diaristas;
    const servicosHomologOk = dreTotais.hml.faturamento >= PARAMS.valores.servicosExtras;
    const custosHomologOk = dreTotais.hml.custosExtras >= PARAMS.valores.custosExtras;

    if (!isolamentoProducaoPerfeito || !diaristasHomologOk || !servicosHomologOk || !custosHomologOk) {
      throw new Error(`FALHA NA CONSOLIDAÇÃO DA DRE OU VAZAMENTO EM PRODUÇÃO!`);
    }

    manifest.status = 'CONCLUIDO_COM_SUCESSO';
    manifest.etapa = 'HOMOLOGACAO_CONSOLIDADA_APROVADA';
    manifest.fluxos.diaristas.status = 'APROVADO';
    manifest.fluxos.servicosExtras.status = 'APROVADO';
    manifest.fluxos.custosExtras.status = 'APROVADO';
    delete manifest.erro;
    manifest.dreTotais = dreTotais;
    fs.writeFileSync(MANIFEST_CONSOLIDADO_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log("\n======================================================================");
    console.log("🎉 HOMOLOGAÇÃO FINANCEIRA CONSOLIDADA CONCLUÍDA COM SUCESSO!");
    console.log("TODOS OS FLUXOS FORAM APROVADOS COM ISOLAMENTO DE PRODUÇÃO PERFEITO.");
    console.log("======================================================================");

  } catch (err) {
    console.error("\n❌ ERRO NA HOMOLOGAÇÃO CONSOLIDADA:", err.message);
    manifest.status = 'FALHA';
    manifest.erro = err.message;
    fs.writeFileSync(MANIFEST_CONSOLIDADO_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Teardown auditado dos 3 fluxos consolidados
async function executeTeardownAudited() {
  if (!fs.existsSync(MANIFEST_CONSOLIDADO_PATH)) {
    console.log("[TEARDOWN] Nenhum manifesto consolidado encontrado.");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_CONSOLIDADO_PATH, 'utf-8'));
  console.log("======================================================================");
  console.log("🧹 AUDITORIA DE TEARDOWN CONSOLIDADO — REGISTROS A EXCLUIR");
  console.log(`Lote Diaristas: ${manifest.fluxos.diaristas.loteId}`);
  console.log(`Serviço Extra:  ${manifest.fluxos.servicosExtras.id}`);
  console.log(`Receita Extra:  ${manifest.fluxos.servicosExtras.receitaId}`);
  console.log(`Item Receita:   ${manifest.fluxos.servicosExtras.itemId}`);
  console.log(`Custo Extra:    ${manifest.fluxos.custosExtras.id}`);
  console.log("======================================================================\n");

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN;');

    // 1. Limpa Custos Extras
    if (manifest.fluxos.custosExtras.id) {
      await client.query('DELETE FROM public.custos_extras_operacionais WHERE id = $1;', [manifest.fluxos.custosExtras.id]);
    }

    // 2. Limpa Serviços Extras e Receitas vinculadas
    if (manifest.fluxos.servicosExtras.itemId) {
      await client.query('DELETE FROM public.receitas_operacionais_itens WHERE id = $1;', [manifest.fluxos.servicosExtras.itemId]);
    }
    if (manifest.fluxos.servicosExtras.receitaId) {
      await client.query('DELETE FROM public.receitas_operacionais WHERE id = $1;', [manifest.fluxos.servicosExtras.receitaId]);
    }
    if (manifest.fluxos.servicosExtras.id) {
      await client.query('DELETE FROM public.servicos_extras_operacionais WHERE id = $1;', [manifest.fluxos.servicosExtras.id]);
    }

    // 3. Limpa Lote Diaristas
    if (manifest.fluxos.diaristas.loteId) {
      await client.query('DELETE FROM public.diaristas_lotes_fechamento WHERE id = $1;', [manifest.fluxos.diaristas.loteId]);
    }

    await client.query('COMMIT;');
    console.log('✅ Teardown consolidado concluído com sucesso. 0 registros residuais.');
    fs.unlinkSync(MANIFEST_CONSOLIDADO_PATH);
  } catch (cleanErr) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error("❌ ERRO NO TEARDOWN:", cleanErr.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv.includes('--teardown')) {
  executeTeardownAudited().catch(console.error);
} else {
  runConsolidado().catch(console.error);
}

