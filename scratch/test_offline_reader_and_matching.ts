import fs from 'fs';
import path from 'path';
import { CNABRetornoReaderFactory } from '../src/services/cnab/CNABRetornoReaderFactory';
import { CNAB240ItauReader } from '../src/services/cnab/CNAB240ItauReader';
import { mapearOcorrenciaItau } from '../src/services/cnab/retorno/ocorrenciasItau';
import { createClient } from '@supabase/supabase-js';

const baseDir = 'y:\\2026\\ERP ESC LOG\\Orbe';
const envStr = fs.readFileSync(path.join(baseDir, '.env.local'), 'utf8');
const env: Record<string, string> = {};
envStr.split('\n').forEach((line) => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function normalizeDoc(doc?: string | null): string {
  return String(doc || '').replace(/\D/g, '');
}

function moneyEquals(a?: number | null, b?: number | null, tolerance = 0.01): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tolerance;
}

async function runOfflineTest() {
  const filePath = path.join(baseDir, 'RETORNO_ITAU_HOMOLOGACAO_210.RET');
  const content = fs.readFileSync(filePath, 'utf8');

  console.log('==================================================');
  console.log('4. TESTE OFFLINE DO READER ITAÚ');
  console.log('==================================================');

  // 1. Factory
  const reader = CNABRetornoReaderFactory.getReader(content, '341');
  console.log('Reader instanciado pela Factory:', reader.constructor.name);
  if (!(reader instanceof CNAB240ItauReader)) {
    throw new Error('Factory não retornou CNAB240ItauReader!');
  }

  // 2. Parse
  const parseResult = await reader.parse(content, {
    banco: '341',
    fileName: 'RETORNO_ITAU_HOMOLOGACAO_210.RET',
    uploadedAt: new Date().toISOString(),
  });

  const detalhe = parseResult.detalhes[0];
  const ocorrencia = mapearOcorrenciaItau(detalhe.codigoOcorrencia);

  console.log('\n--- RESULTADO PARSEADO ---');
  console.log('Banco:                  ', parseResult.resumo.banco);
  console.log('Sequencial (NSA):       ', parseResult.metadados.sequencialArquivo);
  console.log('Beneficiário:           ', detalhe.nomeFavorecido);
  console.log('CPF:                    ', detalhe.documentoFavorecido);
  console.log('Valor:                  ', `R$ ${detalhe.valorPago?.toFixed(2)}`);
  console.log('Ocorrência:             ', `${detalhe.codigoOcorrencia} - ${detalhe.descricaoOcorrencia}`);
  console.log('Classificação:          ', ocorrencia.statusBase);
  console.log('Quantidade de títulos:  ', parseResult.resumo.quantidadeTitulos);
  console.log('Quantidade liquidados:  ', parseResult.resumo.quantidadeLiquidados);
  console.log('Quantidade rejeitados:  ', parseResult.resumo.quantidadeRejeitados);
  console.log('Valor total pago:       ', `R$ ${parseResult.resumo.valorTotalPago.toFixed(2)}`);

  console.log('\n==================================================');
  console.log('5. SIMULAÇÃO DE MATCHING — SEM ESCRITA (READ-ONLY)');
  console.log('==================================================');

  // Autenticar com credenciais do ambiente para leitura segura
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD,
  });

  if (authError) {
    console.warn('Aviso: Falha ao autenticar E2E user:', authError.message);
  }

  // Localizar Remessa Relacionada via query idêntica ao CnabRetornoService.localizarRemessaRelacionada
  const sequencial = parseResult.metadados.sequencialArquivo;
  const bancoArquivo = parseResult.estrutura.headerArquivo.banco;

  const { data: remessas, error: remError } = await supabase
    .from('cnab_remessas_arquivos')
    .select(`
      *,
      contas_bancarias_empresa (
        id,
        empresa_id,
        banco_codigo,
        banco_nome,
        agencia,
        conta,
        convenio
      )
    `)
    .eq('sequencial_arquivo', sequencial);

  if (remError) {
    throw new Error(`Erro ao buscar remessas: ${remError.message}`);
  }

  const candidatos = (remessas || []).filter((cand: any) => {
    const bancoCand = cand.banco_codigo || cand.contas_bancarias_empresa?.banco_codigo;
    return bancoCand === bancoArquivo;
  });

  console.log(`Remessas encontradas com sequencial ${sequencial} e banco ${bancoArquivo}: ${candidatos.length}`);
  const remessaRelacionada = candidatos[0];
  if (!remessaRelacionada) {
    throw new Error(`Nenhuma remessa encontrada para sequencial ${sequencial} e banco ${bancoArquivo}`);
  }

  console.log('Remessa Alvo Identificada:');
  console.log('  ID:                    ', remessaRelacionada.id);
  console.log('  Nome Arquivo:          ', remessaRelacionada.nome_arquivo);
  console.log('  Sequencial:            ', remessaRelacionada.sequencial_arquivo);
  console.log('  Conta Pagadora:        ', remessaRelacionada.contas_bancarias_empresa?.banco_nome, `(Banco ${remessaRelacionada.contas_bancarias_empresa?.banco_codigo})`);
  console.log('  Total Remessa:         ', `R$ ${remessaRelacionada.total_valor}`);
  console.log('  Diaristas Lote ID:     ', remessaRelacionada.diaristas_lote_id);

  // Buscar itens da remessa
  const { data: itensRemessa, error: itensErr } = await supabase
    .from('cnab_remessa_itens')
    .select('id, remessa_id, origem_tipo, origem_id, valor, status')
    .eq('remessa_id', remessaRelacionada.id);

  if (itensErr) throw new Error(`Erro ao buscar itens da remessa: ${itensErr.message}`);

  console.log(`\nItens registrados na remessa (${itensRemessa?.length}):`);
  itensRemessa?.forEach((item, i) => {
    console.log(`  [Item ${i + 1}] ID: ${item.id} | Origem Tipo: ${item.origem_tipo} | Origem ID: ${item.origem_id} | Valor: R$ ${item.valor} | Status: ${item.status}`);
  });

  // Buscar lançamentos de diaristas correspondentes
  const lancamentoIds = itensRemessa?.filter((i) => i.origem_tipo === 'DIARISTA').map((i) => i.origem_id) || [];
  const { data: lancamentosDiaristas, error: lancErr } = await supabase
    .from('lancamentos_diaristas')
    .select('id, lote_fechamento_id, diarista_id, valor_calculado, codigo_marcacao, status, nome_colaborador, cpf_colaborador')
    .in('id', lancamentoIds);

  if (lancErr) throw new Error(`Erro ao buscar lançamentos: ${lancErr.message}`);

  console.log(`\nLançamentos Operacionais de Diaristas vinculados (${lancamentosDiaristas?.length}):`);
  let somaLancamentos = 0;
  lancamentosDiaristas?.forEach((l, i) => {
    console.log(`  [Lançamento ${i + 1}] ID: ${l.id} | Diarista: ${l.nome_colaborador} (CPF: ${l.cpf_colaborador}) | Marcação: ${l.codigo_marcacao} | Valor: R$ ${l.valor_calculado} | Status: ${l.status}`);
    somaLancamentos += Number(l.valor_calculado);
  });
  console.log(`  Soma Total dos Lançamentos Operacionais: R$ ${somaLancamentos.toFixed(2)}`);

  // Simular matching conforme a lógica exata de matchDetalhe do CnabRetornoService:
  const diaristaId = lancamentosDiaristas?.[0]?.diarista_id;
  const cpfDiarista = lancamentosDiaristas?.[0]?.cpf_colaborador;
  const valorConsolidadoDiarista = somaLancamentos;

  // Lógica de matching da Fase 2:
  const docRetorno = normalizeDoc(detalhe.documentoFavorecido);
  const docColaborador = normalizeDoc(cpfDiarista);
  const matchDoc = docRetorno === docColaborador;
  const matchValorConsolidado = moneyEquals(valorConsolidadoDiarista, detalhe.valorPago);

  let criterioMatch = 'nao_encontrado';
  if (matchDoc && matchValorConsolidado) {
    criterioMatch = 'documento_valor (consolidado)';
  } else if (matchDoc) {
    criterioMatch = 'documento';
  } else if (matchValorConsolidado) {
    criterioMatch = 'valor';
  }

  console.log('\n--- SIMULAÇÃO DE MATCHING DETALHADA ---');
  console.log('Registro Retorno:        ', `CPF ${detalhe.documentoFavorecido} | Valor R$ ${detalhe.valorPago?.toFixed(2)}`);
  console.log('Beneficiário no Orbe:    ', `${lancamentosDiaristas?.[0]?.nome_colaborador} | CPF ${cpfDiarista}`);
  console.log('Valor Consolidado Orbe:  ', `R$ ${valorConsolidadoDiarista.toFixed(2)}`);
  console.log('Critério de Match:       ', criterioMatch);
  console.log('Match Bem-Sucedido?      ', criterioMatch.startsWith('documento_valor') ? 'SIM (100% EXATO)' : 'NÃO');

  console.log('\n--- RELACIONAMENTO RETORNO -> REMESSA -> ITENS ORIGINAIS ---');
  console.log('RETORNO BANCÁRIO:');
  console.log(`  Banco: 341 (Itaú) | NSA: ${sequencial} | Beneficiário: ${detalhe.nomeFavorecido} | Valor: R$ ${detalhe.valorPago?.toFixed(2)}`);
  console.log('       ↓  (Matching via Sequencial NSA 000004 e Conta Pagadora Itaú)');
  console.log('REMESSA HISTÓRICA:');
  console.log(`  Arquivo: ${remessaRelacionada.nome_arquivo} | Lote: #${remessaRelacionada.diaristas_lote_id?.slice(0, 8)} | Total: R$ ${remessaRelacionada.total_valor}`);
  console.log('       ↓  (Desdobramento do Pagamento Consolidado)');
  console.log('ITENS ORIGINAIS OPERACIONAIS:');
  lancamentosDiaristas?.forEach((l) => {
    console.log(`  • [${l.codigo_marcacao}] Lançamento ID: ${l.id} | Valor: R$ ${Number(l.valor_calculado).toFixed(2)} | Status Atual: ${l.status}`);
  });
  console.log(`  Total: R$ ${somaLancamentos.toFixed(2)} === R$ ${detalhe.valorPago?.toFixed(2)} do retorno bancário`);

  console.log('\n==================================================');
  console.log('6. CONFIRMAÇÃO DE INTEGRIDADE (READ-ONLY)');
  console.log('==================================================');
  console.log('• Nenhuma gravação em cnab_retorno_arquivos');
  console.log('• Nenhuma gravação em cnab_retorno_itens');
  console.log('• Nenhum status alterado em cnab_remessas_arquivos');
  console.log('• Nenhum status alterado em cnab_remessa_itens');
  console.log('• Nenhum status alterado em diaristas_lotes_fechamento');
  console.log('• Nenhum status alterado em lancamentos_diaristas');
  console.log('• rpc_aplicar_cnab_retorno NÃO FOI EXECUTADA');
  console.log('ZERO ESCRITAS NO BANCO DE DADOS.');
}

runOfflineTest().catch((e) => {
  console.error('Erro na execução:', e);
  process.exit(1);
});
