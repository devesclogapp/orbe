import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function checkSchema() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authErr) {
    console.error('Falha na autenticacao:', authErr.message);
    process.exit(1);
  }
  console.log('Autenticado com sucesso no Supabase oficial.');

  // Lista de tabelas e colunas que FIX-HML-02 precisa
  const schemaChecks = [
    {
      table: 'receitas_operacionais',
      columns: ['id', 'empresa_id', 'tenant_id', 'status', 'observacao', 'updated_at', 'competencia']
    },
    {
      table: 'receitas_operacionais_itens',
      columns: ['id', 'receita_id', 'tenant_id', 'operacao_id', 'servico_extra_id']
    },
    {
      table: 'empresas',
      columns: ['id', 'tenant_id', 'is_teste', 'nome']
    },
    {
      table: 'operacoes_producao',
      columns: ['id', 'empresa_id', 'tenant_id', 'data_operacao', 'deleted_at', 'deleted_by', 'motivo_exclusao', 'status', 'status_rh', 'updated_at']
    },
    {
      table: 'servicos_extras_operacionais',
      columns: ['id', 'empresa_id', 'tenant_id', 'data', 'pipeline_status', 'justificativa_devolucao', 'status_pagamento', 'atualizado_em']
    },
    {
      table: 'custos_extras_operacionais',
      columns: ['id', 'empresa_id', 'tenant_id', 'data', 'pipeline_status', 'status_pagamento', 'deleted_at', 'observacoes', 'atualizado_em']
    },
    {
      table: 'faturas',
      columns: ['id', 'empresa_id', 'tenant_id', 'colaborador_id', 'status', 'updated_at', 'motivo_rejeicao', 'competencia']
    },
    {
      table: 'colaboradores',
      columns: ['id', 'tenant_id', 'is_teste']
    },
    {
      table: 'contas_bancarias_empresa',
      columns: ['id', 'empresa_id', 'tenant_id', 'ativo', 'banco_codigo', 'banco_nome']
    },
    {
      table: 'rh_financeiro_lote_itens',
      columns: ['id', 'tenant_id', 'colaborador_id', 'status']
    },
    {
      table: 'cnab_remessas_arquivos',
      columns: ['id', 'tenant_id', 'empresa_id', 'lote_id', 'conta_bancaria_id', 'nome_arquivo', 'sequencial_arquivo', 'hash_arquivo', 'total_registros', 'total_valor', 'modo', 'status', 'usuario_geracao', 'data_geracao', 'banco_codigo', 'banco_nome']
    },
    {
      table: 'cnab_remessa_itens',
      columns: ['id', 'remessa_id', 'tenant_id', 'empresa_id', 'origem_tipo', 'origem_id', 'fatura_id', 'lote_item_id', 'valor', 'status', 'criado_por']
    },
    {
      table: 'cnab_auditoria_bancaria',
      columns: ['id', 'tenant_id', 'arquivo_id', 'lote_id', 'acao', 'usuario_id', 'usuario_nome', 'detalhes', 'ip_address']
    },
    {
      table: 'profiles',
      columns: ['id', 'user_id', 'role']
    },
    {
      table: 'lancamentos_diaristas',
      columns: ['id', 'empresa_id', 'tenant_id', 'status', 'data_lancamento']
    },
    {
      table: 'diaristas_lotes_fechamento',
      columns: ['id', 'empresa_id', 'tenant_id', 'status', 'mes_referencia', 'updated_at']
    },
    {
      table: 'intermitentes_lotes_fechamento',
      columns: ['id', 'empresa_id', 'tenant_id', 'status', 'competencia', 'updated_at']
    },
    {
      table: 'rh_financeiro_lotes',
      columns: ['id', 'empresa_id', 'tenant_id', 'status', 'competencia', 'updated_at']
    },
    {
      table: 'financeiro_consolidados_cliente',
      columns: ['id', 'empresa_id', 'tenant_id', 'status', 'competencia']
    },
    {
      table: 'financeiro_consolidados_colaborador',
      columns: ['id', 'empresa_id', 'tenant_id', 'status', 'competencia']
    }
  ];

  const results = [];

  for (const item of schemaChecks) {
    const colList = item.columns.join(',');
    const { data, error } = await sb.from(item.table).select(colList).limit(1);

    if (error) {
      results.push({
        table: item.table,
        status: 'FAIL',
        error: `${error.message} (${error.code || 'NO_CODE'})`
      });
    } else {
      results.push({
        table: item.table,
        status: 'OK',
        columnsChecked: item.columns.length
      });
    }
  }

  console.log('\n--- RESULTADO DA VERIFICACAO DE TABELAS E COLUNAS ---');
  results.forEach(r => {
    if (r.status === 'OK') {
      console.log(`[PASS] ${r.table} (${r.columnsChecked} colunas validadas)`);
    } else {
      console.error(`[FAIL] ${r.table} -> ERRO: ${r.error}`);
    }
  });

  // Verificar se a RPC rpc_registrar_cnab_remessa ou outras existem no banco
  console.log('\n--- VERIFICANDO RPCs ---');
  try {
    const { error: rpcErr } = await sb.rpc('get_next_cnab_sequencial', {
      p_tenant_id: '00000000-0000-0000-0000-000000000000',
      p_conta_bancaria_id: '00000000-0000-0000-0000-000000000000',
      p_banco_codigo: '001'
    });
    console.log('get_next_cnab_sequencial check:', rpcErr ? rpcErr.message : 'OK');
  } catch (e) {
    console.log('get_next_cnab_sequencial catch:', e.message);
  }

  try {
    const { error: rpcRegErr } = await sb.rpc('rpc_registrar_cnab_remessa', {});
    console.log('rpc_registrar_cnab_remessa check:', rpcRegErr ? rpcRegErr.message : 'OK');
  } catch (e) {
    console.log('rpc_registrar_cnab_remessa catch:', e.message);
  }

  try {
    const { error: rpcEncErr } = await sb.rpc('rpc_encerrar_homologacao_empresa', {});
    console.log('rpc_encerrar_homologacao_empresa check:', rpcEncErr ? rpcEncErr.message : 'OK');
  } catch (e) {
    console.log('rpc_encerrar_homologacao_empresa catch:', e.message);
  }
}

checkSchema().catch(console.error);
