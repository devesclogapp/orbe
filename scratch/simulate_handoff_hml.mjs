import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
const EXPECTED_SANDBOX_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
const COMPETENCIA = '2026-10';

async function main() {
  console.log('=== SIMULAÇÃO READ-ONLY DO HANDOFF FINANCEIRO HML (PÓS-FIX) ===');

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
  });

  if (authErr || !authData.user) {
    throw new Error(`Falha na autenticação: ${authErr?.message}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', authData.user.id)
    .single();

  const tenantId = profile.tenant_id;

  // Importar o serviço compilado / módulo
  const { buildFolhaVariavelItems } = await import('../src/services/rhFinanceiro.service.ts');

  // Buscar dados reais da sandbox
  const { data: colabs } = await supabase
    .from('colaboradores')
    .select('id, nome, status, status_cadastro, cadastro_provisorio, tipo_colaborador, empresa_id, valor_hora, salario_base, valor_base, valor_diaria, modelo_calculo, tipo_contrato, gera_faturamento, regra_banco_horas_id, jornada_trabalho_id')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', EXPECTED_SANDBOX_ID);

  const { data: pontos } = await supabase
    .from('registros_ponto')
    .select('id, tenant_id, empresa_id, colaborador_id, nome_colaborador, data, status_processamento, jornada_calculada, valor_hora_extra, valor_atraso, valor_falta, minutos_extra, minutos_atraso, horas_extras_detalhadas')
    .eq('tenant_id', tenantId)
    .eq('empresa_id', EXPECTED_SANDBOX_ID)
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .gte('data', '2026-10-01')
    .lte('data', '2026-10-31')
    .order('data', { ascending: true });

  const { data: regras } = await supabase
    .from('banco_horas_regras')
    .select('id, nome, adicional_hora_extra_percentual, ativo, empresa_id, tenant_id')
    .eq('tenant_id', tenantId);

  console.log(`Dados carregados: ${colabs.length} colab(s), ${pontos.length} ponto(s), ${regras.length} regra(s).`);

  // Executar buildFolhaVariavelItems
  const itensVariaveis = buildFolhaVariavelItems(pontos, colabs, regras);

  console.log('\n--- ITENS GERADOS PARA FOLHA_VARIAVEL ---');
  console.table(itensVariaveis.map(it => ({
    colaborador: it.nome_colaborador,
    evento: it.tipo_evento,
    minutos: it.minutos,
    horas: it.horas,
    valor_calculado: `R$ ${it.valor_calculado.toFixed(2)}`,
    referencia_id: it.referencia_evento_id,
  })));

  const totalMinutosHE = itensVariaveis
    .filter(i => i.tipo_evento === 'hora_extra')
    .reduce((acc, i) => acc + i.minutos, 0);

  const totalHorasHE = itensVariaveis
    .filter(i => i.tipo_evento === 'hora_extra')
    .reduce((acc, i) => acc + i.horas, 0);

  const totalValorHE = itensVariaveis
    .filter(i => i.tipo_evento === 'hora_extra')
    .reduce((acc, i) => acc + i.valor_calculado, 0);

  console.log(`\nRESUMO DA FOLHA VARIÁVEL HML:`);
  console.log(`- Total de Itens: ${itensVariaveis.length}`);
  console.log(`- Minutos Físicos HE: ${totalMinutosHE} min (${totalHorasHE}h)`);
  console.log(`- Valor Total HE: R$ ${totalValorHE.toFixed(2)}`);

  // Lote FOLHA_BASE
  const colab = colabs.find(c => c.id === EXPECTED_COLAB_ID);
  console.log(`\nRESUMO DA FOLHA BASE HML:`);
  console.log(`- Salário Base Contratual: R$ ${Number(colab.valor_base).toFixed(2)}`);

  console.log(`\nTOTAL GERAL CONSOLIDADO HML:`);
  console.log(`- FOLHA BASE: R$ ${Number(colab.valor_base).toFixed(2)}`);
  console.log(`- FOLHA VARIÁVEL: R$ ${totalValorHE.toFixed(2)}`);
  console.log(`- TOTAL GERAL: R$ ${(Number(colab.valor_base) + totalValorHE).toFixed(2)}`);
}

main().catch(console.error);
