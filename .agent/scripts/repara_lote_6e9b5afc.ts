import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente manualmente se --env-file não funcionar
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LOTE_CONTAMINADO_ID = '6e9b5afc-e2f0-4ae8-b0ef-9c581da5e8f0';

async function repararLote() {
  console.log("Iniciando reparação do lote:", LOTE_CONTAMINADO_ID);

  // 1. Buscar lote pai atual
  const { data: lotePaiRows, error: loteError } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('*')
    .eq('id', LOTE_CONTAMINADO_ID);
    
  const lotePai = lotePaiRows?.[0] || null;

  if (loteError || !lotePai) {
    console.error("Erro ao buscar lote pai:", loteError);
    return;
  }

  // 2. Buscar lançamentos vinculados
  const { data: lancamentos, error: lancsError } = await supabase
    .from('lancamentos_intermitentes')
    .select('*')
    .eq('lote_fechamento_id', LOTE_CONTAMINADO_ID);

  if (lancsError) {
    console.error("Erro ao buscar lançamentos:", lancsError);
    return;
  }

  console.log(`Lote pai encontrado. Status: ${lotePai.status}. Quantidade de lançamentos: ${lancamentos.length}`);

  if (lancamentos.length !== 11 && lancamentos.length > 0) {
     console.log(`Atenção: Era esperado 11 lançamentos, mas foram encontrados ${lancamentos.length}. Vou continuar pois pode ser ambiente de testes.`);
  }

  if (lancamentos.length === 0) {
      console.log('Nenhum lançamento vinculado ao lote pai. Reparação possivelmente já executada.');
      return;
  }

  // 3. Agrupar lançamentos por empresa
  const grupos = new Map<string, any[]>();
  for (const l of lancamentos) {
    if (!l.empresa_id) {
       console.error("Lançamento sem empresa_id identificado:", l.id);
       continue;
    }
    if (!grupos.has(l.empresa_id)) {
      grupos.set(l.empresa_id, []);
    }
    grupos.get(l.empresa_id)!.push(l);
  }

  console.log(`Lançamentos distribuídos em ${grupos.size} empresas.`);

  // 4. Invalidação do lote antigo
  const motivoInvalidação = 'Lote invalidado por agrupamento indevido de lançamentos pertencentes a múltiplas empresas. Substituído por lotes segregados por empresa.';
  
  // Tentando mudar o status. Como CANCELADO é válido na tipagem, vamos usar CANCELADO, e em observações colocamos o motivo
  // Tentar colocar "INVALIDADO", mas pode quebrar a constraint se for ENUM estrito.
  // Pela instrução: "Caso o status INVALIDADO ainda não exista, manter compatibilidade... Motivo: Lote invalidado..."
  
  const { error: invalidarError } = await supabase
    .from('intermitentes_lotes_fechamento')
    .update({
       status: 'CANCELADO',
       observacoes: motivoInvalidação,
       empresa_id: lotePai.empresa_id // Garantir que continua como estava
    })
    .eq('id', LOTE_CONTAMINADO_ID);

  if (invalidarError) {
      console.error("Erro ao invalidar lote pai:", invalidarError);
      return;
  }
  
  console.log("Lote original invalidado/cancelado com sucesso.");

  let totalReconstruidoLancamentos = 0;
  let totalReconstruidoValor = 0;
  const idsNovosLotes = [];

  // 5. Criar novos lotes e atualizar lançamentos
  for (const [empresaId, grupoLancs] of grupos.entries()) {
      const quantidade_registros = grupoLancs.length;
      const valor_total = grupoLancs.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

      // Inserir novo lote
      const { data: novoLote, error: novoLoteError } = await supabase
        .from('intermitentes_lotes_fechamento')
        .insert({
          tenant_id: lotePai.tenant_id,
          empresa_id: empresaId,
          competencia: lotePai.competencia,
          periodo_inicio: lotePai.periodo_inicio,
          periodo_fim: lotePai.periodo_fim,
          quantidade_registros,
          valor_total,
          status: 'AGUARDANDO_VALIDACAO_RH', // Ponto de retorno definido na ETAPA 06
          observacoes: `Reparação do lote legado ${LOTE_CONTAMINADO_ID}.`,
          created_by: lotePai.created_by
        })
        .select()
        .single();
        
      if (novoLoteError) {
          console.error(`Erro ao criar lote para empresa ${empresaId}:`, novoLoteError);
          continue;
      }
      
      console.log(`Criado novo lote ${novoLote.id} para empresa ${empresaId} com ${quantidade_registros} registros. R$ ${valor_total.toFixed(2)}.`);
      idsNovosLotes.push(novoLote.id);
      
      totalReconstruidoLancamentos += quantidade_registros;
      totalReconstruidoValor += valor_total;

      // Vincular lançamentos ao novo lote
      const idsLancs = grupoLancs.map(l => l.id);
      const { error: updateError } = await supabase
        .from('lancamentos_intermitentes')
        .update({
          lote_fechamento_id: novoLote.id,
          status_pipeline: 'EM_ANALISE_RH' // Ponto de retorno
        })
        .in('id', idsLancs);
        
      if (updateError) {
          console.error(`Erro ao atualizar os lançamentos da empresa ${empresaId}:`, updateError);
      }
  }

  console.log("----");
  console.log("Validação Matemática:");
  console.log(`Lote Original - Lancamentos: ${lotePai.quantidade_registros} | Valor Original: R$ ${lotePai.valor_total}`);
  console.log(`Lotes Novos   - Lancamentos: ${totalReconstruidoLancamentos} | Valor Recriado: R$ ${totalReconstruidoValor.toFixed(2)}`);
  console.log(`Total Novos Lotes Gerados: ${idsNovosLotes.length}`);
}

repararLote();
