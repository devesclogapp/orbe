import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

async function diagnose() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'e2e-test@orbe.local',
    password: '123456'
  });
  if (authErr) {
    console.error("Erro auth:", authErr);
    return;
  }
  console.log("Auth realizado com sucesso:", authData.user.email);

  console.log("=== BUSCANDO LOTE 6e48aa ===");
  const { data: allLotes, error: errLote } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('*');

  if (errLote) {
    console.error("Erro ao buscar lote:", errLote);
    return;
  }

  const lotes = (allLotes || []).filter(l => l.id.toLowerCase().startsWith('6e48aa'));
  console.log("Total de lotes no banco:", allLotes?.length);
  console.log("Lotes encontrados com 6e48aa:", lotes);

  if (!lotes || lotes.length === 0) {
    // Buscar também em rh_financeiro_lotes se for o caso
    const { data: rhLotes } = await supabase
      .from('rh_financeiro_lotes')
      .select('*')
      .ilike('id', '6e48aa%');
    console.log("Busca em rh_financeiro_lotes:", rhLotes);
    return;
  }

  const lote = lotes[0];
  console.log("\n=== DETALHES DO LOTE ===");
  console.log({
    id: lote.id,
    empresa_id: lote.empresa_id,
    empresa_nome: lote.empresa_nome,
    competencia: lote.competencia,
    status: lote.status,
    total_colaboradores: lote.total_colaboradores,
    horas_totais: lote.horas_totais,
    valor_total: lote.valor_total,
    tenant_id: lote.tenant_id
  });

  // Buscar empresa vinculada
  if (lote.empresa_id) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('id, nome, tenant_id')
      .eq('id', lote.empresa_id)
      .maybeSingle();
    console.log("Empresa do lote:", empresa);
  }

  // Buscar lançamentos do lote
  const { data: lancamentos, error: errLanc } = await supabase
    .from('lancamentos_intermitentes')
    .select('*')
    .eq('lote_fechamento_id', lote.id);

  console.log(`\n=== LANÇAMENTOS DO LOTE (${lancamentos?.length || 0}) ===`);
  if (lancamentos && lancamentos.length > 0) {
    lancamentos.forEach((l, idx) => {
      console.log(`Lancamento ${idx + 1}:`, {
        id: l.id,
        colaborador_id: l.colaborador_id,
        nome_colaborador: l.nome_colaborador,
        data_inicio: l.data_inicio,
        data_fim: l.data_fim,
        horas_trabalhadas: l.horas_trabalhadas,
        valor_calculado: l.valor_calculado,
        status_pipeline: l.status_pipeline
      });
    });

    const colabIds = [...new Set(lancamentos.map(l => l.colaborador_id).filter(Boolean))];
    console.log("\nColaboradores IDs únicos:", colabIds);

    for (const cId of colabIds) {
      const { data: colab, error: errColab } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('id', cId)
        .maybeSingle();

      console.log(`\n=== CADASTRO COLABORADOR ID: ${cId} ===`);
      console.log(colab);
    }
  }
}

diagnose().catch(console.error);
