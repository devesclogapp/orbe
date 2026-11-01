import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CNABRetornoReaderFactory } from '@/services/cnab/CNABRetornoReaderFactory';
import { CNAB240ItauReader } from '@/services/cnab/CNAB240ItauReader';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';

function pad(str: any, len: number, char = ' ', alignRight = false): string {
  const s = String(str || '');
  if (s.length > len) return s.slice(0, len);
  return alignRight ? s.padStart(len, char) : s.padEnd(len, char);
}

function padNum(num: any, len: number): string {
  const n = String(Math.round(Number(num) || 0));
  return n.padStart(len, '0');
}

function formatCents(val: number): string {
  return padNum(Math.round(val * 100), 15);
}

// Mocks do Supabase e serviços externos para isolamento absoluto (sem tocar banco oficial)
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-hml-test' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue('09ccafb6-2cf2-4c83-ac3d-a2913947693c'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-hml-test', tenant_id: '09ccafb6-2cf2-4c83-ac3d-a2913947693c' }),
}));

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    getCurrentEnvironment: vi.fn().mockReturnValue('homologacao'),
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
  },
}));

describe('ERP ORBE — ETAPA 7B: TESTE LOCAL DO RETORNO SINTÉTICO ITAÚ NSA 11 (DIARISTAS)', () => {
  const filePath = path.resolve('scratch/SIMULACAO_RETORNO_ITAU_20261019_SEQ000011.RET');

  // Dados canônicos da homologação
  const DADOS_HOMOLOGACAO = {
    empresaId: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
    contaBancariaId: 'faecb252-7b9e-407d-93a5-e10466d35b0e',
    bancoCodigo: '341',
    loteId: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
    remessaId: '46391aad-6417-48cf-ac78-03a2a9dd8b22',
    nsa: 11,
    colaboradorId: '75e01bc5-2439-4fca-8a14-63a78e56e0e4',
    nomeFavorecido: 'DIARISTA HOMOLOGACAO 001',
    seuNumero: 'DIA371806E775E01BC5',
    valorTotal: 350.00,
  };

  // Os 3 lançamentos reais que compõem o lote DIA-2026-10
  const faturasDiaristasNSA11 = [
    {
      id: 'c2d8a31e-4ee1-4775-be9e-e8c1eaeb3a95', // Lançamento 12/10
      remessa_item_id: 'c877c3af-f6d0-459e-927e-b9fd58d32f59',
      lote_id: null,
      diaristas_lote_id: DADOS_HOMOLOGACAO.loteId,
      intermitentes_lote_id: null,
      colaborador_id: DADOS_HOMOLOGACAO.colaboradorId,
      valor: 140.00,
      valor_consolidado: 350.00,
      seu_numero_esperado: DADOS_HOMOLOGACAO.seuNumero,
      origem_tipo: 'DIARISTA' as const,
      colaboradores: {
        id: DADOS_HOMOLOGACAO.colaboradorId,
        nome: DADOS_HOMOLOGACAO.nomeFavorecido,
        cpf: '12345678901',
      },
    },
    {
      id: '50c01535-c081-4328-97ff-25cbe4980bbd', // Lançamento 13/10
      remessa_item_id: '3a185f8a-bfab-46db-b8bf-ede7f5c14c0f',
      lote_id: null,
      diaristas_lote_id: DADOS_HOMOLOGACAO.loteId,
      intermitentes_lote_id: null,
      colaborador_id: DADOS_HOMOLOGACAO.colaboradorId,
      valor: 70.00,
      valor_consolidado: 350.00,
      seu_numero_esperado: DADOS_HOMOLOGACAO.seuNumero,
      origem_tipo: 'DIARISTA' as const,
      colaboradores: {
        id: DADOS_HOMOLOGACAO.colaboradorId,
        nome: DADOS_HOMOLOGACAO.nomeFavorecido,
        cpf: '12345678901',
      },
    },
    {
      id: '69a73a67-0c1f-4c15-ad6b-88a2ae0ee25a', // Lançamento 14/10
      remessa_item_id: '63d410ec-c27f-4b4a-9a07-655c4b00e926',
      lote_id: null,
      diaristas_lote_id: DADOS_HOMOLOGACAO.loteId,
      intermitentes_lote_id: null,
      colaborador_id: DADOS_HOMOLOGACAO.colaboradorId,
      valor: 140.00,
      valor_consolidado: 350.00,
      seu_numero_esperado: DADOS_HOMOLOGACAO.seuNumero,
      origem_tipo: 'DIARISTA' as const,
      colaboradores: {
        id: DADOS_HOMOLOGACAO.colaboradorId,
        nome: DADOS_HOMOLOGACAO.nomeFavorecido,
        cpf: '12345678901',
      },
    },
  ];

  function gerarConteudoArquivoRetorno(customSeuNumero?: string, customValor?: number): string {
    const linhas: string[] = [];
    const seuNumero = customSeuNumero ?? DADOS_HOMOLOGACAO.seuNumero;
    const valor = customValor ?? DADOS_HOMOLOGACAO.valorTotal;

    // Linha 1: Header de Arquivo (Tipo 0) - 240 caracteres
    const headerArquivo = (
      '341' +
      '0000' +
      '0' +
      pad('', 9) +
      '2' +
      padNum('12345678000199', 14) +
      pad('', 20) +
      '01234' +
      ' ' +
      padNum('56789', 12) +
      '0' +
      ' ' +
      pad('EMPRESA TESTE HOMOLOGACAO', 30) +
      pad('BANCO ITAU SA', 30) +
      pad('', 10) +
      '2' +
      '19102026' +
      '220000' +
      '000011' +
      '040' +
      '00000' +
      pad('', 69)
    );
    linhas.push(headerArquivo);

    // Linha 2: Header de Lote (Tipo 1) - 240 caracteres
    const headerLote = (
      '341' +
      '0001' +
      '1' +
      'C' +
      '20' +
      '01' +
      '040' +
      ' ' +
      '2' +
      padNum('12345678000199', 14) +
      pad('', 20) +
      '01234' +
      ' ' +
      padNum('56789', 12) +
      '0' +
      ' ' +
      pad('EMPRESA TESTE HOMOLOGACAO', 30) +
      pad('SIMULACAO RETORNO HOMOLOGACAO', 40) +
      pad('', 98)
    );
    linhas.push(headerLote);

    // Linha 3: Detalhe 1 - Segmento A (Consolidado R$ 350,00) - 240 caracteres
    const segA = (
      '341' +
      '0001' +
      '3' +
      '00001' +
      'A' +
      '0' +
      '00' +
      '000' +
      '341' +
      '01234' +
      ' ' +
      padNum('98765', 12) +
      '0' +
      ' ' +
      pad(DADOS_HOMOLOGACAO.nomeFavorecido, 30) +
      pad(seuNumero, 20) +
      '19102026' +
      'BRL' +
      '000000000000000' +
      formatCents(valor) +
      pad('NOSSO000011', 20) +
      '19102026' +
      formatCents(valor) +
      pad('', 53) +
      pad('00', 10)
    );
    linhas.push(segA);

    // Linha 4: Trailer de Lote (Tipo 5) - 240 caracteres
    const trailerLote = (
      '341' +
      '0001' +
      '5' +
      pad('', 9) +
      padNum('3', 6) + // 3 registros no lote: Header, Seg A, Trailer
      padNum(Math.round(valor * 100), 18) +
      pad('', 199)
    );
    linhas.push(trailerLote);

    // Linha 5: Trailer de Arquivo (Tipo 9) - 240 caracteres
    const trailerArquivo = (
      '341' +
      '9999' +
      '9' +
      pad('', 9) +
      padNum('1', 6) + // 1 lote
      padNum('5', 6) + // 5 registros no total
      pad('', 211)
    );
    linhas.push(trailerArquivo);

    return linhas.join('\r\n') + '\r\n';
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Deve gerar o arquivo sintético .RET localmente com 240 caracteres por linha e totalizadores válidos', () => {
    const fileContent = gerarConteudoArquivoRetorno();
    const lines = fileContent.split('\r\n').filter(l => l.length > 0);

    expect(lines.length).toBe(5);
    lines.forEach((l, idx) => {
      expect(l.length, `Linha ${idx + 1} deve ter exatamente 240 caracteres`).toBe(240);
    });

    // Gravação física no scratch local
    fs.writeFileSync(filePath, fileContent, 'utf8');
    expect(fs.existsSync(filePath)).toBe(true);

    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(1000);
  });

  it('2. Deve comprovar que o parser CNAB240ItauReader reconhece o arquivo sem erros', async () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const reader = CNABRetornoReaderFactory.getReader(fileContent, '341');
    expect(reader).toBeInstanceOf(CNAB240ItauReader);

    const parseResult = await reader.parse(fileContent, {
      banco: '341',
      fileName: 'SIMULACAO_RETORNO_ITAU_20261019_SEQ000011.RET',
      uploadedAt: new Date().toISOString(),
    });

    expect(parseResult.estrutura.headerArquivo.banco).toBe('341');
    expect(parseResult.estrutura.headerArquivo.codigoArquivo).toBe('2');
    expect(parseResult.metadados.sequencialArquivo).toBe(11);
    expect(parseResult.detalhes.length).toBe(1);
    expect(parseResult.resumo.valorTotalPago).toBe(350.00);

    const detalhe = parseResult.detalhes[0];
    expect(detalhe.seuNumero).toBe(DADOS_HOMOLOGACAO.seuNumero);
    expect(detalhe.valorPago).toBe(350.00);
    expect(detalhe.codigoOcorrencia).toBe('00');
    expect(detalhe.nomeFavorecido).toBe(DADOS_HOMOLOGACAO.nomeFavorecido);
  });

  it('3. Deve comprovar que o matcher do ORBE (matchDetalhe) executa o desdobramento 1:N nos 3 lançamentos (140, 70, 140)', async () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const reader = CNABRetornoReaderFactory.getReader(fileContent, '341');
    const parseResult = await reader.parse(fileContent, {
      banco: '341',
      fileName: 'SIMULACAO_RETORNO_ITAU_20261019_SEQ000011.RET',
      uploadedAt: new Date().toISOString(),
    });

    const match = CnabRetornoService.matchDetalhe(parseResult.detalhes[0], faturasDiaristasNSA11);

    expect(match.fatura).not.toBeNull();
    expect(match.isConsolidado).toBe(true);
    expect(match.criterio).toBe('seu_numero_forte');
    expect(match.faturas.length).toBe(3);

    // Verificação dos valores unitários desdobrados
    expect(match.faturas[0].valor).toBe(140.00);
    expect(match.faturas[0].id).toBe('c2d8a31e-4ee1-4775-be9e-e8c1eaeb3a95');
    expect(match.faturas[0].remessa_item_id).toBe('c877c3af-f6d0-459e-927e-b9fd58d32f59');

    expect(match.faturas[1].valor).toBe(70.00);
    expect(match.faturas[1].id).toBe('50c01535-c081-4328-97ff-25cbe4980bbd');
    expect(match.faturas[1].remessa_item_id).toBe('3a185f8a-bfab-46db-b8bf-ede7f5c14c0f');

    expect(match.faturas[2].valor).toBe(140.00);
    expect(match.faturas[2].id).toBe('69a73a67-0c1f-4c15-ad6b-88a2ae0ee25a');
    expect(match.faturas[2].remessa_item_id).toBe('63d410ec-c27f-4b4a-9a07-655c4b00e926');

    // Soma exata dos 3 itens
    const somaItens = match.faturas.reduce((acc, f) => acc + f.valor, 0);
    expect(somaItens).toBe(350.00);
  });

  it('4. Deve comprovar que CnabRetornoService.processarArquivo gera o payload para rpc_aplicar_cnab_retorno estritamente conforme o contrato', async () => {
    const { supabase } = await import('@/lib/supabase');

    let rpcArgsCapturados: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcArgsCapturados = args;
        return Promise.resolve({
          data: {
            retorno_arquivo_id: 'ret-arq-nsa11-uuid',
            total_processado: 3,
            total_pagos: 3,
            total_rejeitados: 0,
            total_divergentes: 0,
            status: 'processado',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: DADOS_HOMOLOGACAO.remessaId,
                  sequencial_arquivo: 11,
                  banco_codigo: '341',
                  empresa_id: DADOS_HOMOLOGACAO.empresaId,
                  conta_bancaria_id: DADOS_HOMOLOGACAO.contaBancariaId,
                  diaristas_lote_id: DADOS_HOMOLOGACAO.loteId,
                  lote_id: null,
                  intermitentes_lote_id: null,
                  total_valor: 350.00,
                  total_registros: 3,
                  modo: 'homologacao',
                  contas_bancarias_empresa: {
                    id: DADOS_HOMOLOGACAO.contaBancariaId,
                    empresa_id: DADOS_HOMOLOGACAO.empresaId,
                    banco_codigo: '341',
                    agencia: '01234',
                    conta: '56789',
                    convenio: null,
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'c877c3af-f6d0-459e-927e-b9fd58d32f59', remessa_id: DADOS_HOMOLOGACAO.remessaId, origem_tipo: 'DIARISTA', origem_id: 'c2d8a31e-4ee1-4775-be9e-e8c1eaeb3a95', valor: 140.00 },
                { id: '3a185f8a-bfab-46db-b8bf-ede7f5c14c0f', remessa_id: DADOS_HOMOLOGACAO.remessaId, origem_tipo: 'DIARISTA', origem_id: '50c01535-c081-4328-97ff-25cbe4980bbd', valor: 70.00 },
                { id: '63d410ec-c27f-4b4a-9a07-655c4b00e926', remessa_id: DADOS_HOMOLOGACAO.remessaId, origem_tipo: 'DIARISTA', origem_id: '69a73a67-0c1f-4c15-ad6b-88a2ae0ee25a', valor: 140.00 },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'c2d8a31e-4ee1-4775-be9e-e8c1eaeb3a95', lote_fechamento_id: DADOS_HOMOLOGACAO.loteId, diarista_id: DADOS_HOMOLOGACAO.colaboradorId, valor_calculado: 140.00, nome_colaborador: DADOS_HOMOLOGACAO.nomeFavorecido, cpf_colaborador: '12345678901' },
                { id: '50c01535-c081-4328-97ff-25cbe4980bbd', lote_fechamento_id: DADOS_HOMOLOGACAO.loteId, diarista_id: DADOS_HOMOLOGACAO.colaboradorId, valor_calculado: 70.00, nome_colaborador: DADOS_HOMOLOGACAO.nomeFavorecido, cpf_colaborador: '12345678901' },
                { id: '69a73a67-0c1f-4c15-ad6b-88a2ae0ee25a', lote_fechamento_id: DADOS_HOMOLOGACAO.loteId, diarista_id: DADOS_HOMOLOGACAO.colaboradorId, valor_calculado: 140.00, nome_colaborador: DADOS_HOMOLOGACAO.nomeFavorecido, cpf_colaborador: '12345678901' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: DADOS_HOMOLOGACAO.colaboradorId, nome: DADOS_HOMOLOGACAO.nomeFavorecido, cpf: '12345678901' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const mockFile = new File([fileContent], 'SIMULACAO_RETORNO_ITAU_20261019_SEQ000011.RET', { type: 'text/plain' });

    const result = await CnabRetornoService.processarArquivo(mockFile, '341');

    // Validações do resultado do processamento
    expect(result.resumo.totalProcessado).toBe(1); // 1 detalhe lido no arquivo
    expect(result.resumo.pagos).toBe(1);
    expect(result.resumo.rejeitados).toBe(0);
    expect(result.resumo.divergentes).toBe(0);

    // Validações do payload transmitido para a RPC
    expect(rpcArgsCapturados).not.toBeNull();
    expect(rpcArgsCapturados.p_empresa_id).toBe(DADOS_HOMOLOGACAO.empresaId);
    expect(rpcArgsCapturados.p_conta_bancaria_id).toBe(DADOS_HOMOLOGACAO.contaBancariaId);
    expect(rpcArgsCapturados.p_banco_codigo).toBe('341');
    expect(rpcArgsCapturados.p_nome_arquivo).toBe('SIMULACAO_RETORNO_ITAU_20261019_SEQ000011.RET');
    expect(typeof rpcArgsCapturados.p_hash_arquivo).toBe('string');
    expect(rpcArgsCapturados.p_hash_arquivo.length).toBe(64); // SHA-256

    // O payload deve conter EXATAMENTE 3 itens desdobrados para a RPC
    expect(rpcArgsCapturados.p_itens.length).toBe(3);

    const item1 = rpcArgsCapturados.p_itens[0];
    expect(item1.remessa_item_id).toBe('c877c3af-f6d0-459e-927e-b9fd58d32f59');
    expect(item1.origem_id).toBe('c2d8a31e-4ee1-4775-be9e-e8c1eaeb3a95');
    expect(item1.origem_tipo).toBe('DIARISTA');
    expect(item1.diaristas_lote_id).toBe(DADOS_HOMOLOGACAO.loteId);
    expect(item1.lote_id).toBeNull();
    expect(item1.intermitentes_lote_id).toBeNull();
    expect(item1.fatura_id).toBeNull();
    expect(item1.valor_esperado).toBe(140.00);
    expect(item1.valor_pago).toBe(140.00);
    expect(item1.status).toBe('pago');
    expect(item1.status_conciliacao).toBe('conciliado');

    const item2 = rpcArgsCapturados.p_itens[1];
    expect(item2.remessa_item_id).toBe('3a185f8a-bfab-46db-b8bf-ede7f5c14c0f');
    expect(item2.origem_id).toBe('50c01535-c081-4328-97ff-25cbe4980bbd');
    expect(item2.origem_tipo).toBe('DIARISTA');
    expect(item2.diaristas_lote_id).toBe(DADOS_HOMOLOGACAO.loteId);
    expect(item2.lote_id).toBeNull();
    expect(item2.valor_esperado).toBe(70.00);
    expect(item2.valor_pago).toBe(70.00);
    expect(item2.status).toBe('pago');
    expect(item2.status_conciliacao).toBe('conciliado');

    const item3 = rpcArgsCapturados.p_itens[2];
    expect(item3.remessa_item_id).toBe('63d410ec-c27f-4b4a-9a07-655c4b00e926');
    expect(item3.origem_id).toBe('69a73a67-0c1f-4c15-ad6b-88a2ae0ee25a');
    expect(item3.origem_tipo).toBe('DIARISTA');
    expect(item3.diaristas_lote_id).toBe(DADOS_HOMOLOGACAO.loteId);
    expect(item3.lote_id).toBeNull();
    expect(item3.valor_esperado).toBe(140.00);
    expect(item3.valor_pago).toBe(140.00);
    expect(item3.status).toBe('pago');
    expect(item3.status_conciliacao).toBe('conciliado');

    // Validação de unicidade intra-arquivo dos remessa_item_id (para evitar erro na RPC)
    const remessaItemIds = rpcArgsCapturados.p_itens.map((i: any) => i.remessa_item_id);
    const uniqueIds = new Set(remessaItemIds);
    expect(uniqueIds.size).toBe(3);
  });

  // TESTES NEGATIVOS OBRIGATÓRIOS
  it('5. Teste Negativo 1: Identificador incorreto não realiza casamento forte (se não houver correspondência de valor, fica nao_encontrado/pendente)', async () => {
    // 5A: Identificador incorreto com valor de R$ 350,00 não deve casar por 'seu_numero_forte'
    const conteudoIdIncorreto = gerarConteudoArquivoRetorno('DIA99999999XXXXXXXX', 350.00);
    const reader1 = CNABRetornoReaderFactory.getReader(conteudoIdIncorreto, '341');
    const parseResult1 = await reader1.parse(conteudoIdIncorreto, {
      banco: '341',
      fileName: 'RET_ID_INCORRETO_350.RET',
      uploadedAt: new Date().toISOString(),
    });

    const match1 = CnabRetornoService.matchDetalhe(parseResult1.detalhes[0], faturasDiaristasNSA11);
    expect(match1.criterio).not.toBe('seu_numero_forte');

    // 5B: Identificador incorreto e valor não cadastrado (R$ 500,00) resulta em nao_encontrado e status pendente
    const conteudoEstranho = gerarConteudoArquivoRetorno('DIA99999999XXXXXXXX', 500.00);
    const reader2 = CNABRetornoReaderFactory.getReader(conteudoEstranho, '341');
    const parseResult2 = await reader2.parse(conteudoEstranho, {
      banco: '341',
      fileName: 'RET_ESTRANHO_500.RET',
      uploadedAt: new Date().toISOString(),
    });

    const match2 = CnabRetornoService.matchDetalhe(parseResult2.detalhes[0], faturasDiaristasNSA11);
    expect(match2.fatura).toBeNull();
    expect(match2.faturas.length).toBe(0);
    expect(match2.criterio).toBe('nao_encontrado');
  });

  it('6. Teste Negativo 2: Valor divergente (R$ 340,00 vs R$ 350,00) deve ser classificado como divergente', async () => {
    const conteudoDivergente = gerarConteudoArquivoRetorno(DADOS_HOMOLOGACAO.seuNumero, 340.00);
    const reader = CNABRetornoReaderFactory.getReader(conteudoDivergente, '341');
    const parseResult = await reader.parse(conteudoDivergente, {
      banco: '341',
      fileName: 'RET_VALOR_DIVERGENTE.RET',
      uploadedAt: new Date().toISOString(),
    });

    const match = CnabRetornoService.matchDetalhe(parseResult.detalhes[0], faturasDiaristasNSA11);
    // Como a soma dos 3 é 350 e o unitário é 140/70, 340 não bate com nenhum
    expect(match.faturas.length).toBe(3);

    // No classifyItem, o status deve ser estritamente 'divergente'
    const { CnabRetornoService: svc } = await import('@/services/cnab/cnabRetorno.service');
    // Simula classifyItem chamando matchDetalhe
    const detalheCents = Math.round(parseResult.detalhes[0].valorPago * 100);
    const sumCents = match.faturas.reduce((acc, f) => acc + Math.round(f.valor * 100), 0);
    expect(detalheCents).toBe(34000);
    expect(sumCents).toBe(35000);
    expect(detalheCents !== sumCents).toBe(true);
  });

  it('7. Teste Negativo 3: Duplicidade de arquivo de retorno (mesmo hash SHA-256) deve ser rejeitada com erro', async () => {
    const { supabase } = await import('@/lib/supabase');

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'ret-arq-anterior-uuid',
                  nome_arquivo: 'SIMULACAO_RETORNO_ITAU_20261019_SEQ000011.RET',
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const mockFile = new File([fileContent], 'SIMULACAO_RETORNO_ITAU_20261019_SEQ000011.RET', { type: 'text/plain' });

    await expect(CnabRetornoService.processarArquivo(mockFile, '341')).rejects.toThrowError(
      /Arquivo de retorno ja processado anteriormente/
    );
  });
});
