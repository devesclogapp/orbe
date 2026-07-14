import { getE2EContext } from './utils/e2e-guard';

function generateCPF(): string {
  const num = () => Math.floor(Math.random() * 9);
  const n = Array.from({ length: 9 }, num);
  
  let d1 = 0;
  for (let i = 0; i < 9; i++) {
    d1 += n[i] * (10 - i);
  }
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = 0;
  for (let i = 0; i < 9; i++) {
    d2 += n[i] * (11 - i);
  }
  d2 += d1 * 2;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  
  return n.join('') + d1 + d2;
}

async function run() {
  try {
    const { supabase, tenantId, empresaId } = await getE2EContext();
    console.log(`\n🚀 [POPULATE-HOMOLOGACAO] Iniciando Povoamento...`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Empresa: ${empresaId}`);

    // Cria 3 Colaboradores (Intermitentes)
    const cpfs = [generateCPF(), generateCPF(), generateCPF()];
    
    const colabs = [
        {
            tenant_id: tenantId, empresa_id: empresaId, nome_completo: "José Homologação (E2E)", nome: "José", cpf: cpfs[0],
            tipo_colaborador: 'INTERMITENTE', cargo: 'Ajudante E2E', valor_hora: 12.50,
            banco_codigo: "341", agencia: "1234", conta: "56789", tipo_conta: "corrente", matricula: `HML-${Date.now()}-1`, status: 'ativo'
        },
        {
            tenant_id: tenantId, empresa_id: empresaId, nome_completo: "Maria Homologação (E2E)", nome: "Maria", cpf: cpfs[1],
            tipo_colaborador: 'INTERMITENTE', cargo: 'Conferente E2E', valor_hora: 15.00,
            banco_codigo: "001", agencia: "4321", conta: "98765", tipo_conta: "corrente", matricula: `HML-${Date.now()}-2`, status: 'ativo'
        },
        {
            tenant_id: tenantId, empresa_id: empresaId, nome_completo: "João Pendente (Sem Banco)", nome: "João", cpf: cpfs[2],
            tipo_colaborador: 'INTERMITENTE', cargo: 'Separador E2E', valor_hora: 13.00,
            banco_codigo: null, agencia: null, conta: null, tipo_conta: null, matricula: `HML-${Date.now()}-3`, status: 'ativo'
        }
    ];

    console.log('\n[1/3] Criando colaboradores...');
    const { data: insertedColabs, error: colabErr } = await supabase.from('colaboradores').insert(colabs).select();
    if (colabErr) throw colabErr;
    console.log(`✅ Foram criados 3 colaboradores intermitentes no banco.`);

    console.log('\n[2/3] Criando Lote 1 (Válido para aprovação)...');
    
    // Padronizar data
    const periodoAtual = new Date().toISOString().substring(0, 7); // YYYY-MM
    const lote1 = await supabase.from('intermitentes_lotes_fechamento').insert({
        tenant_id: tenantId, empresa_id: empresaId, competencia: periodoAtual, status: 'AGUARDANDO_VALIDACAO_RH',
        quantidade_registros: 2, valor_total: 275.00, periodo_inicio: `${periodoAtual}-01`, periodo_fim: `${periodoAtual}-15`,
        created_by: '00000000-0000-0000-0000-000000000000', observacoes: 'Lote Válido - Completo - E2E'
    }).select().single();
    if (lote1.error) throw lote1.error;

    await supabase.from('lancamentos_intermitentes').insert([
        { 
          tenant_id: tenantId, empresa_id: empresaId, colaborador_id: insertedColabs[0].id, nome_colaborador: insertedColabs[0].nome, cpf_colaborador: insertedColabs[0].cpf,
          data_referencia: `${periodoAtual}-10`, horas_trabalhadas: 10, total: 125.00, status_pipeline: 'EM_ANALISE_RH', cargo: 'Ajudante', lote_fechamento_id: lote1.data.id
        },
        { 
          tenant_id: tenantId, empresa_id: empresaId, colaborador_id: insertedColabs[1].id, nome_colaborador: insertedColabs[1].nome, cpf_colaborador: insertedColabs[1].cpf,
          data_referencia: `${periodoAtual}-11`, horas_trabalhadas: 10, total: 150.00, status_pipeline: 'EM_ANALISE_RH', cargo: 'Conferente', lote_fechamento_id: lote1.data.id
        }
    ]);
    console.log(`✅ Lote 1 gerado: ${lote1.data.id}`);

    console.log('\n[3/3] Criando Lote 2 (Bloqueado por falta de Dados Bancários)...');

    const lote2 = await supabase.from('intermitentes_lotes_fechamento').insert({
        tenant_id: tenantId, empresa_id: empresaId, competencia: periodoAtual, status: 'AGUARDANDO_VALIDACAO_RH',
        quantidade_registros: 1, valor_total: 130.00, periodo_inicio: `${periodoAtual}-01`, periodo_fim: `${periodoAtual}-15`,
        created_by: '00000000-0000-0000-0000-000000000000', observacoes: 'Lote Incompleto - Teste E2E'
    }).select().single();
    if (lote2.error) throw lote2.error;

    await supabase.from('lancamentos_intermitentes').insert([
        { 
          tenant_id: tenantId, empresa_id: empresaId, colaborador_id: insertedColabs[2].id, nome_colaborador: insertedColabs[2].nome, cpf_colaborador: insertedColabs[2].cpf,
          data_referencia: `${periodoAtual}-12`, horas_trabalhadas: 10, total: 130.00, status_pipeline: 'EM_ANALISE_RH', cargo: 'Separador', lote_fechamento_id: lote2.data.id
        }
    ]);
    console.log(`✅ Lote 2 gerado: ${lote2.data.id}`);

    console.log(`\n🎉 Processo Concluído com Sucesso!`);
    console.log(`Abra "Aprovações RH" no UI e você verá 2 Lotes novos do tipo "Intermitentes" de ${periodoAtual}. Você pode tentar aprovar os dois usando a aprovação em lote.`);
    
  } catch (err) {
    console.error("\n❌ ERRO DETECTADO:", err);
  }
}

run();
