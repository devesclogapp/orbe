import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltando variaveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Iniciando validacao do fluxo Operacoes por Volume E2E...');
  try {
    // 1. Procurar empresa homologação (is_teste = true)
    const { data: empresa, error: empError } = await supabase
      .from('empresas')
      .select('id, nome, tenant_id')
      .eq('is_teste', true)
      .limit(1)
      .single();

    if (empError || !empresa) {
        throw new Error('Empresa de teste nao encontrada: ' + JSON.stringify(empError));
    }
    console.log(`[PASS] Empresa selecionada: ${empresa.nome} | ID: ${empresa.id}`);

    // Pegar unidade e fornecedor e tipo servico
    const { data: unidade } = await supabase.from('unidades').select('id').eq('empresa_id', empresa.id).limit(1).single();
    const { data: fornecedor } = await supabase.from('fornecedores').select('id').limit(1).single();
    const { data: tipo_servico } = await supabase.from('config_tipos_operacao').select('id').limit(1).single();
    const { data: colaborador } = await supabase.from('colaboradores').select('id').limit(1).single();

    const mockOperacao = {
      empresa_id: empresa.id,
      tenant_id: empresa.tenant_id,
      unidade_id: unidade?.id || null,
      fornecedor_id: fornecedor?.id || null,
      tipo_servico_id: tipo_servico?.id || null,
      placa: 'E2E-TEST',
      nf_numero: 'SIM',
      ctrc: '123456',
      quantidade: 100,
      valor_unitario_snapshot: 1.5,
      quantidade_colaboradores: 1,
      entrada_ponto: '08:00',
      saida_ponto: '18:00',
      data_operacao: new Date().toISOString().split('T')[0],
      status: 'RECEBIDO', // or LANCADO
      status_pagamento: 'PENDENTE',
      tipo_calculo_snapshot: 'volume',
      observacao: 'Validacao E2E automatizada'
    };

    console.log('[INFO] Inserindo Operacao producao...');
    const { data: operacao, error: opError } = await supabase
      .from('operacoes_producao')
      .insert(mockOperacao)
      .select()
      .single();

    if (opError) {
       console.error('[ERRO] Falha ao inserir operação:', opError);
       return;
    }

    console.log(`[PASS] Operacao Inserida com Sucesso! ID: ${operacao.id}`);
    
    // Inserindo na tabela de colaboradores vinculados se encontrar algum
    if (colaborador) {
        const { error: colabError } = await supabase.from('production_entry_collaborators').insert({
            production_entry_id: operacao.id,
            collaborator_id: colaborador.id,
            entrada_ponto: '08:00',
            saida_ponto: '18:00'
        });
        if (colabError) console.error('[AVISO] Falha ao vincular colaborador (talvez duplicado ou restrito):', colabError);
        else console.log(`[PASS] Colaborador ${colaborador.id} vinculado.`);
    }

    // Buscando o Dashboard ou lendo de volta os dados com JOIN
    const { data: operacaoBD, error: fetchError } = await supabase
       .from('operacoes_producao')
       .select('*, colaboradores:colaborador_id(*), production_entry_collaborators(collaborator_id)')
       .eq('id', operacao.id)
       .single();
       
    if (fetchError) {
        console.error('[ERRO] Falha ao recuperar operacao da view de dashboard', fetchError);
    } else {
        console.log('[PASS] Leitura do Serviço funciona! Dados retornados com sucesso:');
        console.log(`Quantidade: ${operacaoBD.quantidade}`);
        console.log(`Placa: ${operacaoBD.placa}`);
        console.log(`Colaboradores Vinculados Qtd: ${operacaoBD.production_entry_collaborators?.length || 0}`);
    }

    // Cleanup E2E
    console.log('\n[INFO] Realizando Limpeza...');
    await supabase.from('operacoes_producao').delete().eq('id', operacao.id);
    console.log('[PASS] Limpeza concluida.');

  } catch (err) {
    console.error('FATAL', err);
  }
}

main();
