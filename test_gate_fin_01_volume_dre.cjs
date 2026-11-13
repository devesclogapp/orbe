/**
 * test_gate_fin_01_volume_dre.cjs
 * 
 * GATE-FIN-01: Homologação Automatizada do Pipeline:
 * Operações por Volume -> Trigger DB -> Receita Operacional -> Consolidação DRE
 * 
 * Hardening Fase A.1:
 * 1. Validação DRE Produção: Mede a contribuição delta (deltaProd === 0.00), preservando totais legítimos.
 * 2. Diferenciação de Cobertura: Documenta explicitamente a cobertura (Agregação SQL que reproduz o dashboard.service.ts).
 * 3. Manifesto Fortalecido: UUID gerado antes de qualquer escrita; fail-closed se manifesto existir; atualização a cada etapa.
 * 4. Validação de Dependências: Busca dinâmica de tipo_servico, forma_pagamento e produto compatíveis com o tenant.
 * 5. Sem Teardown Automático: Preserva registros e manifesto para auditoria posterior antes da limpeza.
 */

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
const MANIFEST_PATH = path.resolve(__dirname, 'hml_gate_fin_01_manifest.json');

// Parâmetros Canônicos do Teste
const PARAMS = {
  tenantId: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
  empresaId: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
  colaboradorId: 'd0a663d7-383e-4720-be53-1b8a1f162090',
  competencia: '2027-12',
  dataOperacao: '2027-12-15',
  quantidade: 100,
  valorUnitario: 10.00,
  valorTotalEsperado: 1000.00,
  identificador: 'HML_GATE_FIN_01_TESTE_VOLUME',
};

async function executeFaseB() {
  if (!connectionString) {
    console.error("ERRO: DATABASE_URL não configurada no ambiente.");
    process.exit(1);
  }

  // 1. FORTALECIMENTO DO MANIFESTO: Verificação de segurança de execuções anteriores
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const existingManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      if (existingManifest.status === 'FALHA' && !existingManifest.receitaId && !existingManifest.itemId) {
        console.log(`[MANIFESTO] Detectado manifesto de execução anterior com status 'FALHA' (${existingManifest.operacaoId}).`);
        console.log(`[MANIFESTO] Conectando ao banco para verificar estritamente se restou algum resíduo no banco...`);
        const preCheckClient = new Client({ connectionString, statement_timeout: 10000 });
        await preCheckClient.connect();
        const resOp = await preCheckClient.query('SELECT count(*) FROM public.operacoes_producao WHERE id = $1', [existingManifest.operacaoId]);
        const resColab = await preCheckClient.query('SELECT count(*) FROM public.production_entry_collaborators WHERE production_entry_id = $1', [existingManifest.operacaoId]);
        const resRec = await preCheckClient.query('SELECT count(*) FROM public.receitas_operacionais_itens WHERE operacao_id = $1', [existingManifest.operacaoId]);
        await preCheckClient.end();

        if (resOp.rows[0].count === '0' && resColab.rows[0].count === '0' && resRec.rows[0].count === '0') {
          console.log(`✅ [AUDITORIA] Comprovado 0 resíduos do teste falho anterior no banco.`);
          console.log(`   Removendo manifesto anterior inválido para permitir novo ciclo seguro.`);
          fs.unlinkSync(MANIFEST_PATH);
        } else {
          console.error("======================================================================");
          console.error("❌ EXECUÇÃO BLOQUEADA: Resíduos encontrados no banco para o manifesto anterior!");
          console.error(`Arquivo: ${MANIFEST_PATH}`);
          console.error("Execute o teardown auditado com '--teardown' antes de iniciar novo teste.");
          console.error("======================================================================");
          process.exit(1);
        }
      } else {
        console.error("======================================================================");
        console.error("❌ EXECUÇÃO BLOQUEADA: Manifesto de execução anterior já existe!");
        console.error(`Arquivo: ${MANIFEST_PATH}`);
        console.error("Execute o teardown auditado com '--teardown' antes de iniciar novo teste.");
        console.error("======================================================================");
        process.exit(1);
      }
    } catch (parseErr) {
      console.error("======================================================================");
      console.error("❌ EXECUÇÃO BLOQUEADA: Erro ao inspecionar manifesto existente:", parseErr.message);
      console.error("======================================================================");
      process.exit(1);
    }
  }

  // GERAÇÃO DO UUID DA OPERAÇÃO ANTES DE QUALQUER ESCRITA
  const operacaoId = crypto.randomUUID();

  // GRAVAÇÃO IMEDIATA DO MANIFESTO INICIAL COM OS PARÂMETROS DE ISOLAMENTO
  const manifestData = {
    operacaoId,
    receitaId: null,
    itemId: null,
    tenantId: PARAMS.tenantId,
    empresaId: PARAMS.empresaId,
    colaboradorId: PARAMS.colaboradorId,
    competencia: PARAMS.competencia,
    identificador: PARAMS.identificador,
    timestamp: new Date().toISOString(),
    etapa: 'MANIFESTO_INICIAL_GRAVADO',
    status: 'INICIADO'
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');
  console.log(`[MANIFESTO] Gravado com sucesso em disco antes das escritas: ${MANIFEST_PATH}`);

  const client = new Client({ connectionString, statement_timeout: 15000 });
  await client.connect();

  let receitaId = null;
  let itemId = null;
  let testeSucesso = false;

  console.log("======================================================================");
  console.log("🚀 GATE-FIN-01 — INICIANDO EXECUÇÃO AUTOMATIZADA (FASE B)");
  console.log(`Tenant: ${PARAMS.tenantId}`);
  console.log(`Empresa Sandbox: ${PARAMS.empresaId}`);
  console.log(`Competência: ${PARAMS.competencia}`);
  console.log(`Operação UUID gerado: ${operacaoId}`);
  console.log("======================================================================\n");

  try {
    // 2. PRÉ-VALIDAÇÃO E RESOLUÇÃO DE DEPENDÊNCIAS AUXILIARES
    console.log('[ETAPA 1] Validando dependências e entidades auxiliares ativas...');

    // Validação da empresa sandbox
    const empRes = await client.query(`
      SELECT id, tenant_id, is_teste, nome 
      FROM public.empresas 
      WHERE id = $1;
    `, [PARAMS.empresaId]);

    if (empRes.rows.length === 0 || !empRes.rows[0].is_teste) {
      throw new Error(`Empresa sandbox ${PARAMS.empresaId} não encontrada ou não é is_teste=true!`);
    }
    const tenantReal = empRes.rows[0].tenant_id;
    console.log(`✅ Empresa sandbox validada: ${empRes.rows[0].nome} (tenant: ${tenantReal})`);

    // Busca dinâmica de tipo_servico ativo
    const servRes = await client.query(`
      SELECT id, nome 
      FROM public.tipos_servico_operacional 
      WHERE ativo = true AND is_extra_service = false 
        AND (tenant_id = $1 OR tenant_id IS NULL)
      LIMIT 1;
    `, [tenantReal]);

    if (servRes.rows.length === 0) throw new Error("Nenhum tipo_servico_operacional ativo encontrado!");
    const tipoServicoId = servRes.rows[0].id;
    console.log(`✅ Tipo de serviço ativo: ${servRes.rows[0].nome} (${tipoServicoId})`);

    // Busca dinâmica de forma_pagamento ativa (preferência Caixa Imediato / Dinheiro / PIX)
    const formaRes = await client.query(`
      SELECT id, nome, modalidade 
      FROM public.formas_pagamento_operacional 
      WHERE ativo = true 
        AND (tenant_id = $1 OR tenant_id IS NULL)
      ORDER BY CASE WHEN upper(nome) LIKE '%PIX%' OR upper(nome) LIKE '%DINHEIRO%' THEN 1 ELSE 2 END
      LIMIT 1;
    `, [tenantReal]);

    if (formaRes.rows.length === 0) throw new Error("Nenhuma forma_pagamento_operacional ativa encontrada!");
    const formaPagamentoId = formaRes.rows[0].id;
    console.log(`✅ Forma de pagamento ativa: ${formaRes.rows[0].nome} (${formaPagamentoId})`);

    // Busca dinâmica de produto_carga ativo
    const prodRes = await client.query(`
      SELECT id, nome 
      FROM public.produtos_carga 
      WHERE ativo = true 
        AND (tenant_id = $1 OR tenant_id IS NULL)
      LIMIT 1;
    `, [tenantReal]);

    if (prodRes.rows.length === 0) throw new Error("Nenhum produto_carga ativo encontrado!");
    const produtoCargaId = prodRes.rows[0].id;
    console.log(`✅ Produto de carga ativo: ${prodRes.rows[0].nome} (${produtoCargaId})`);

    // Busca dinâmica de fornecedor ativo exigindo estritamente o tenant_id correto E (empresa_id sandbox OU empresa_id IS NULL)
    const fornRes = await client.query(`
      SELECT id, nome, empresa_id, tenant_id 
      FROM public.fornecedores 
      WHERE tenant_id = $1 
        AND (empresa_id = $2 OR empresa_id IS NULL)
        AND (ativo = true OR ativo IS NULL)
      ORDER BY CASE WHEN empresa_id = $2 THEN 1 ELSE 2 END, nome ASC
      LIMIT 1;
    `, [tenantReal, PARAMS.empresaId]);

    if (fornRes.rows.length === 0) {
      throw new Error(`Nenhum fornecedor ativo compatível encontrado para tenant ${tenantReal} e empresa ${PARAMS.empresaId}!`);
    }
    const fornecedorId = fornRes.rows[0].id;
    console.log(`✅ Fornecedor ativo validado: ${fornRes.rows[0].nome} (${fornecedorId}) [tenant: ${fornRes.rows[0].tenant_id}, empresa: ${fornRes.rows[0].empresa_id || 'GLOBAL'}]`);

    // Busca dinâmica de transportadora ativa exigindo tenant_id correto E (empresa_id sandbox OU empresa_id IS NULL)
    const transpRes = await client.query(`
      SELECT id, nome, empresa_id, tenant_id 
      FROM public.transportadoras_clientes 
      WHERE tenant_id = $1 
        AND (empresa_id = $2 OR empresa_id IS NULL)
        AND (ativo = true OR ativo IS NULL)
      ORDER BY CASE WHEN empresa_id = $2 THEN 1 ELSE 2 END, nome ASC
      LIMIT 1;
    `, [tenantReal, PARAMS.empresaId]);

    const transportadoraId = transpRes.rows.length > 0 ? transpRes.rows[0].id : null;
    if (transportadoraId) {
      console.log(`✅ Transportadora ativa validada: ${transpRes.rows[0].nome} (${transportadoraId}) [tenant: ${transpRes.rows[0].tenant_id}, empresa: ${transpRes.rows[0].empresa_id || 'GLOBAL'}]`);
    } else {
      console.log(`ℹ️ Nenhuma transportadora vinculada necessária (campo anulável).`);
    }

    // 3. MEDIÇÃO DO BASELINE INICIAL DA DRE (ANTES DE QUALQUER ESCRITA)
    console.log('\n[ETAPA 2] Medindo baseline da DRE na competência 2027-12 antes do teste...');
    const baselineHomologRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total
      FROM public.receitas_operacionais
      WHERE empresa_id = $1
        AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);

    const baselineProdRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total
      FROM public.receitas_operacionais
      WHERE empresa_id <> $1
        AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);

    const baselineHomolog = Number(baselineHomologRes.rows[0].total);
    const baselineProd = Number(baselineProdRes.rows[0].total);
    console.log(`   Baseline DRE Homologação (Sandbox): R$ ${baselineHomolog.toFixed(2)}`);
    console.log(`   Baseline DRE Produção (Empresas Reais): R$ ${baselineProd.toFixed(2)}`);

    // 4. PERSISTÊNCIA DA OPERAÇÃO DE PRODUÇÃO SINTÉTICA (Status Inicial = 'CONCLUIDO')
    console.log('\n[ETAPA 3] Inserindo operação sintética na tabela public.operacoes_producao...');
    await client.query(`
      INSERT INTO public.operacoes_producao (
        id, tenant_id, empresa_id, data_operacao, tipo_servico_id,
        fornecedor_id, transportadora_id, produto_carga_id, forma_pagamento_id,
        quantidade, valor_unitario_snapshot, tipo_calculo_snapshot, valor_descarga,
        valor_total, status, status_pagamento, observacao, quantidade_colaboradores,
        origem_dado
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, 'volume', $12,
        $13, 'CONCLUIDO', 'PENDENTE', $14, 1,
        'manual'
      );
    `, [
      operacaoId, tenantReal, PARAMS.empresaId, PARAMS.dataOperacao, tipoServicoId,
      fornecedorId, transportadoraId, produtoCargaId, formaPagamentoId,
      PARAMS.quantidade, PARAMS.valorUnitario, PARAMS.valorTotalEsperado,
      PARAMS.valorTotalEsperado, PARAMS.identificador
    ]);

    // Vincula o colaborador de homologação à operação
    await client.query(`
      INSERT INTO public.production_entry_collaborators (
        production_entry_id, collaborator_id, had_infraction
      ) VALUES ($1, $2, false);
    `, [operacaoId, PARAMS.colaboradorId]);

    // Atualiza manifesto após inserção
    manifestData.etapa = 'OPERACAO_INSERIDA';
    manifestData.tenantId = tenantReal;
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');
    console.log('✅ Operação sintética criada e registrada no manifesto.');

    // 5. TRANSIÇÃO DE STATUS PARA DISPARAR A TRIGGER DE RECEITA ('AGUARDANDO_FATURAMENTO')
    console.log('\n[ETAPA 4] Executando transição de status para [AGUARDANDO_FATURAMENTO]...');
    await client.query(`
      UPDATE public.operacoes_producao
      SET status = 'AGUARDANDO_FATURAMENTO',
          atualizado_em = now()
      WHERE id = $1;
    `, [operacaoId]);

    manifestData.etapa = 'STATUS_TRANSICIONADO';
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');
    console.log('✅ Transição concluída.');

    // 6. AUDITORIA DA TRIGGER E RECUPERAÇÃO DOS IDs FINANCEIROS POR VÍNCULO
    console.log('\n[ETAPA 5] Recuperando e auditando receita gerada via vínculo com operacaoId...');
    const recCheck = await client.query(`
      SELECT 
        r.id as receita_id,
        r.valor_total as receita_valor,
        r.modalidade,
        r.status as receita_status,
        i.id as item_id,
        i.valor_item,
        i.operacao_id
      FROM public.receitas_operacionais_itens i
      JOIN public.receitas_operacionais r ON r.id = i.receita_id
      WHERE i.operacao_id = $1;
    `, [operacaoId]);

    if (recCheck.rows.length === 0) {
      throw new Error("FALHA: A trigger trg_gerar_receita_operacional_automatica não gerou o registro financeiro!");
    }

    const recRow = recCheck.rows[0];
    receitaId = recRow.receita_id;
    itemId = recRow.item_id;

    // Atualiza manifesto com os IDs financeiros recuperados
    manifestData.receitaId = receitaId;
    manifestData.itemId = itemId;
    manifestData.etapa = 'RECEITA_ESPELHADA_CONFIRMADA';
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');

    console.log(`✅ Receita gerada: ID=${receitaId}, Item=${itemId}`);
    console.log(`   Valor Receita: R$ ${recRow.receita_valor} (Esperado: ${PARAMS.valorTotalEsperado})`);
    console.log(`   Modalidade: ${recRow.modalidade}, Status: ${recRow.receita_status}`);

    const valorReceitaValido = Number(recRow.receita_valor) === PARAMS.valorTotalEsperado;
    const valorItemValido = Number(recRow.valor_item) === PARAMS.valorTotalEsperado;

    if (!valorReceitaValido || !valorItemValido) {
      throw new Error(`DIVERGÊNCIA DE VALOR: Receita=${recRow.receita_valor}, Item=${recRow.valor_item}`);
    }

    // 7. VALIDAÇÃO DOS TOTAIS DA DRE PÓS-TESTE E MEDIÇÃO DE DELTAS
    console.log('\n[ETAPA 6] Executando agregação analítica da DRE pós-teste e calculando deltas...');

    const posHomologRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total
      FROM public.receitas_operacionais
      WHERE empresa_id = $1
        AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);

    const posProdRes = await client.query(`
      SELECT coalesce(sum(valor_total), 0) as total
      FROM public.receitas_operacionais
      WHERE empresa_id <> $1
        AND status <> 'cancelado'
        AND (competencia = $2 OR (competencia IS NULL AND created_at >= '2027-12-01' AND created_at < '2028-01-01'));
    `, [PARAMS.empresaId, PARAMS.competencia]);

    const posHomolog = Number(posHomologRes.rows[0].total);
    const posProd = Number(posProdRes.rows[0].total);

    const deltaHomolog = posHomolog - baselineHomolog;
    const deltaProd = posProd - baselineProd;

    console.log(`   DRE Homologação: Antes=R$ ${baselineHomolog.toFixed(2)}, Depois=R$ ${posHomolog.toFixed(2)} -> DELTA: R$ ${deltaHomolog.toFixed(2)}`);
    console.log(`   DRE Produção:    Antes=R$ ${baselineProd.toFixed(2)}, Depois=R$ ${posProd.toFixed(2)} -> DELTA: R$ ${deltaProd.toFixed(2)}`);

    // Validação objetiva com base nos deltas:
    // HOMOLOGAÇÃO deve registrar contribuição EXATA de R$ 1.000,00
    // PRODUÇÃO deve registrar contribuição EXATA de R$ 0,00 (preservando quaisquer valores prévios)
    const deltaHomologCorreto = deltaHomolog === PARAMS.valorTotalEsperado;
    const deltaProdIsolado = deltaProd === 0.00;

    console.log(`\n[CRITÉRIOS OBJETIVOS]`);
    console.log(`- Contribuição da operação sintética na DRE de Homologação = R$ 1.000,00? ${deltaHomologCorreto ? 'SIM ✅' : 'NÃO ❌'}`);
    console.log(`- Contribuição da operação sintética na DRE de Produção = R$ 0,00? ${deltaProdIsolado ? 'SIM ✅' : 'NÃO ❌'}`);

    if (deltaHomologCorreto && deltaProdIsolado) {
      testeSucesso = true;
      manifestData.status = 'CONCLUIDO_COM_SUCESSO';
      manifestData.etapa = 'HOMOLOGACAO_APROVADA';
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');

      console.log("\n======================================================================");
      console.log("🎉 TESTE AUTOMATIZADO GATE-FIN-01 APROVADO COM SUCESSO!");
      console.log("1. Operação sintética criada sem afetar dados reais.");
      console.log("2. Trigger do banco gerou espelhamento em receitas_operacionais.");
      console.log("3. Valor integral de R$ 1.000,00 confirmado no espelhamento.");
      console.log("4. Contribuição na DRE de Homologação: R$ 1.000,00 (Reconhecimento comprovado).");
      console.log("5. Contribuição na DRE de Produção: R$ 0,00 (Isolamento comprovado).");
      console.log("======================================================================");
    } else {
      console.error("\n❌ TESTE REPROVADO NOS CRITÉRIOS OBJETIVOS!");
    }

  } catch (err) {
    console.error("\n❌ ERRO DURANTE A EXECUÇÃO:", err.message);
    if (fs.existsSync(MANIFEST_PATH)) {
      manifestData.status = 'FALHA';
      manifestData.erro = err.message;
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');
    }
  } finally {
    await client.end();
    console.log(`\n[AVISO DE GOVERNANÇA] O teardown automático NÃO foi executado.`);
    console.log(`Os registros e o manifesto foram preservados para conferência.`);
    console.log(`Manifesto: ${MANIFEST_PATH}`);
    if (!testeSucesso) {
      process.exit(1);
    }
  }
}

// Procedimento auditado de teardown cirúrgico exclusivo pelos UUIDs capturados no manifesto
async function executeTeardownAudited() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log("[TEARDOWN] Nenhum manifesto de teste encontrado em disco.");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log("======================================================================");
  console.log("🧹 AUDITORIA DE TEARDOWN — REGISTROS CANDIDATOS À EXCLUSÃO");
  console.log(`Manifesto: ${MANIFEST_PATH}`);
  console.log(`Operação ID: ${manifest.operacaoId}`);
  console.log(`Receita ID: ${manifest.receitaId}`);
  console.log(`Item ID: ${manifest.itemId}`);
  console.log("======================================================================\n");

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Auditoria SELECT pré-exclusão
    console.log("[AUDITORIA 1] Verificando existência estrita dos registros...");
    const opCheck = await client.query('SELECT id, status, valor_total FROM public.operacoes_producao WHERE id = $1', [manifest.operacaoId]);
    const recCheck = manifest.receitaId ? await client.query('SELECT id, valor_total FROM public.receitas_operacionais WHERE id = $1', [manifest.receitaId]) : { rows: [] };
    const itemCheck = manifest.itemId ? await client.query('SELECT id, operacao_id FROM public.receitas_operacionais_itens WHERE id = $1', [manifest.itemId]) : { rows: [] };
    const colabCheck = await client.query('SELECT id FROM public.production_entry_collaborators WHERE production_entry_id = $1', [manifest.operacaoId]);

    console.log(`- Operações encontradas: ${opCheck.rows.length}`);
    console.log(`- Receitas encontradas: ${recCheck.rows.length}`);
    console.log(`- Itens de receita encontrados: ${itemCheck.rows.length}`);
    console.log(`- Vínculos de equipe encontrados: ${colabCheck.rows.length}`);

    // Verificação de segurança: não apagar receita se ela possuir itens de outras operações!
    if (manifest.receitaId) {
      const otherItemsCheck = await client.query(`
        SELECT count(*) as total_outros 
        FROM public.receitas_operacionais_itens 
        WHERE receita_id = $1 AND operacao_id <> $2;
      `, [manifest.receitaId, manifest.operacaoId]);

      const outrosItens = parseInt(otherItemsCheck.rows[0].total_outros, 10);
      if (outrosItens > 0) {
        throw new Error(`BLOQUEIO DE SEGURANÇA: A receita ${manifest.receitaId} contém ${outrosItens} itens de outras operações! Abortando exclusão.`);
      }
      console.log('✅ Verificado: Receita é unívoca e exclusiva desta operação de teste.');
    }

    // 2. Execução da limpeza cirúrgica em transação atômica
    console.log("\n[EXECUÇÃO TEARDOWN] Removendo registros cirurgicamente em transação atômica...");
    await client.query('BEGIN;');

    if (manifest.itemId) {
      await client.query('DELETE FROM public.receitas_operacionais_itens WHERE id = $1;', [manifest.itemId]);
    }

    if (manifest.receitaId) {
      await client.query('DELETE FROM public.receitas_operacionais WHERE id = $1;', [manifest.receitaId]);
    }

    if (manifest.operacaoId) {
      await client.query('DELETE FROM public.production_entry_collaborators WHERE production_entry_id = $1;', [manifest.operacaoId]);
      await client.query('DELETE FROM public.operacoes_producao WHERE id = $1;', [manifest.operacaoId]);
    }

    // 3. Validação pós-exclusão
    const finalOp = await client.query('SELECT count(*) FROM public.operacoes_producao WHERE id = $1', [manifest.operacaoId]);
    const finalRec = manifest.receitaId ? await client.query('SELECT count(*) FROM public.receitas_operacionais WHERE id = $1', [manifest.receitaId]) : { rows: [{ count: '0' }] };

    if (finalOp.rows[0].count !== '0' || finalRec.rows[0].count !== '0') {
      throw new Error("FALHA TEARDOWN: Registros ainda presentes após DELETE!");
    }

    await client.query('COMMIT;');
    console.log('✅ Teardown concluído com sucesso. 0 registros residuais.');

    fs.unlinkSync(MANIFEST_PATH);
    console.log('✅ Manifesto removido do disco.');

  } catch (cleanErr) {
    await client.query('ROLLBACK;').catch(() => { });
    console.error("❌ ERRO NO TEARDOWN:", cleanErr.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv.includes('--teardown')) {
  executeTeardownAudited().catch(console.error);
} else {
  executeFaseB().catch(console.error);
}
