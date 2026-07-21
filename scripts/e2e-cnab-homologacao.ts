import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Inject Vite's import.meta.env and global window object for the node runtime
(globalThis as any).import = { meta: { env: process.env } };
(globalThis as any).window = {};

async function main() {
  const { getE2EContext } = await import('./utils/e2e-guard');
  const guard = await getE2EContext();
  const supabase = guard.supabase;
  const tenantId = guard.tenantId;
  const log = (msg: string) => console.log(`[E2E-CNAB] ${msg}`);
  
  // A empresa oficial de HML do E2E Sandbox
  const EMPRESA_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
  
  // Precisamos criar ou achar a conta corrente oficial da Empresa pro Itaú
  let { data: conta } = await supabase.from('contas_bancarias_empresa')
    .select('id').eq('empresa_id', EMPRESA_ID).eq('banco_codigo', '341').maybeSingle();
    
  if (!conta) {
    const { data: newConta, error: errConta } = await supabase.from('contas_bancarias_empresa').insert({
      tenant_id: tenantId,
      empresa_id: EMPRESA_ID,
      banco_codigo: '341',
      banco_nome: 'Itaú Unibanco S.A.',
      agencia: '1234',
      conta: '56789',
      conta_digito: '0',
      cedente_cnpj: '12345678000100',
      cedente_nome: 'EMPRESA E2E SANDBOX LTDA',
      convenio: '999999'
    }).select('id').single();
    if(errConta) throw errConta;
    conta = newConta;
  }
  
  // Vamos assegurar 2 colaboradores com contas Itaú nessa empresa HML
  const colabsToInsert = [
    {
      nome: 'Homologação Itaú 001',
      nome_completo: 'Homologação Itaú 001',
      cpf: '77777777771', // 11 digits
      banco_codigo: '341',
      agencia: '1111',
      conta: '22222',
      tipo_conta: 'corrente',
      banco_validado: true,
      tipo_colaborador: 'INTERMITENTE',
      is_teste: true
    },
    {
      nome: 'Homologação Itaú 002',
      nome_completo: 'Homologação Itaú 002',
      cpf: '77777777772', 
      banco_codigo: '341',
      agencia: '3333',
      conta: '44444',
      tipo_conta: 'corrente',
      banco_validado: true,
      tipo_colaborador: 'INTERMITENTE',
      is_teste: true
    }
  ];
  
  log(`Garantindo cadastro de 2 colaboradores fictícios ITAU.`);
  const colabIds = [];
  for (const c of colabsToInsert) {
    let { data: ext } = await supabase.from('colaboradores').select('id, cpf').eq('cpf', c.cpf).maybeSingle();
    if (!ext) {
      const { data: rec, error: errC } = await supabase.from('colaboradores').insert({
        ...c,
        tenant_id: tenantId,
        empresa_id: EMPRESA_ID
      }).select('id').single();
      if(errC) throw errC;
      colabIds.push(rec.id);
    } else {
      // Ensure it has the bank info updated
      await supabase.from('colaboradores').update({ ...c, empresa_id: EMPRESA_ID }).eq('id', ext.id);
      colabIds.push(ext.id);
    }
  }

  // 1. Criar Lote Intermitentes
  const lotePayload = {
    tenant_id: tenantId,
    empresa_id: EMPRESA_ID,
    competencia: '2026-07',
    periodo_inicio: '2026-07-01',
    periodo_fim: '2026-07-31',
    status: 'AGUARDANDO_VALIDACAO_RH',
    valor_total: 600
  };
  
  log(`Gerando Lote Operacional Intermitentes para a empresa.`);
  // Cleanup any old test runs so we don't pile up
  await supabase.from('intermitentes_lotes_fechamento').delete().eq('competencia', '2026-07').eq('empresa_id', EMPRESA_ID);
  
  const { data: loteRow, error: errLote } = await supabase.from('intermitentes_lotes_fechamento')
    .insert(lotePayload).select('id').single();
  if (errLote) throw errLote;
  
  // Cleanup orphans if script aborted
  await supabase.from('lancamentos_intermitentes').delete().in('colaborador_id', colabIds).eq('data_referencia', '2026-07-01');
  
  // 2. Criar lançamentos
  const { error: errLancs } = await supabase.from('lancamentos_intermitentes')
    .insert([
      { tenant_id: tenantId, lote_fechamento_id: loteRow.id, colaborador_id: colabIds[0], nome_colaborador: colabsToInsert[0].nome_completo, horas_trabalhadas: 10, total: 300, empresa_id: EMPRESA_ID, status_pipeline: 'EM_ANALISE_RH', data_referencia: '2026-07-01', competencia: '2026-07', convocacao: 'C1' },
      { tenant_id: tenantId, lote_fechamento_id: loteRow.id, colaborador_id: colabIds[1], nome_colaborador: colabsToInsert[1].nome_completo, horas_trabalhadas: 10, total: 300, empresa_id: EMPRESA_ID, status_pipeline: 'EM_ANALISE_RH', data_referencia: '2026-07-01', competencia: '2026-07', convocacao: 'C1' },
    ]);
  if (errLancs) throw errLancs;
  
  // Instanciar service real do sistema using dynamic import
  const { IntermitentesLoteService } = await import('../src/services/domain/intermitentes.service');
  
  // Use the exported instance
  const IntermitentesService = IntermitentesLoteService;
  
  // Replace supabase client temporarily for the script
  (IntermitentesService as any).supabase = supabase;
  
  // MOCK Completude API to let Dummies pass without inserting 20 address fields!
  IntermitentesService.verificarCompletudeLote = async () => ({ podeAprovar: true, pendencias: [] });
  
  const { supabase: globalSupabase } = await import('../src/lib/supabase');
  const { data: sess } = await supabase.auth.getSession();
  if (sess?.session) {
      await globalSupabase.auth.setSession(sess.session);
  }

  const userId = (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000';
  
  log(`Enviando para RH (Validar Lote)...`);
  await IntermitentesService.validarLote(loteRow.id, userId);
  
  log(`Enviando para Financeiro (Aprovar Financeiro) -> 'FECHADO_FINANCEIRO'`);
  await IntermitentesService.aprovarFinanceiro(loteRow.id, userId);
  
  // Check the mapped rh_financeiro_lotes
  const { data: sfLote } = await supabase.from('rh_financeiro_lotes')
    .select('id, status, rh_financeiro_lote_itens(count)').eq('empresa_id', EMPRESA_ID).eq('competencia', '2026-07').eq('origem', 'OPERACIONAL').eq('tipo', 'INTERMITENTES').maybeSingle();
    
  log(`Lote no RH estrutural encontrado com status: ${sfLote?.status} | Itens: ${sfLote?.rh_financeiro_lote_itens?.[0]?.count}`);
  if (!sfLote) throw new Error('Não espelhou para rh_financeiro_lotes');

  // Gerar a remessa via CNABService
  log(`Disparando generateRemessa() simulando o clique da UI na Central Bancária...`);
  
  const { CNABService } = await import('../src/services/financial.service');
  
  try {
    const remessa = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId: EMPRESA_ID,
      contaId: conta.id,
      rhLoteId: sfLote.id,
      modo: 'homologacao'
    });
    
    log(`SUCESSO ===========================`);
    log(`Arquivo ID: ${remessa.arquivoId}`);
    log(`Layout selecionado: Itaú (341) `);
    log(`\n\n=== AMOSTRA DO ARQUIVO GERADO ===`);
    log(remessa.content.substring(0, 500));
    log(`=================================`);
    
  } catch (err: any) {
    log(`ERRO NA GERAÇÃO DO CNAB: ${err.message}`);
    throw err;
  }
}

main().catch(console.error);
