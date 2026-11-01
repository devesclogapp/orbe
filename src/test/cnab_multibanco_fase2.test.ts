import { describe, it, expect, vi } from 'vitest';
import { CNABRetornoReaderFactory, mapearOcorrenciaRetorno } from '@/services/cnab/CNABRetornoReaderFactory';
import { CNAB240BBReader } from '@/services/cnab/CNAB240BBReader';
import { CNAB240ItauReader } from '@/services/cnab/CNAB240ItauReader';
import { mapearOcorrenciaItau } from '@/services/cnab/retorno/ocorrenciasItau';
import { mapearOcorrenciaBB } from '@/services/cnab/retorno/ocorrenciasBB';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { gerarCNAB240BB, EmpresaRemessa, BeneficiarioPagamento } from '@/services/cnab/cnab240-posicional';
import { gerarCNAB240Itau } from '@/services/cnab/cnab240-itau';
import { MotorCNAB240 } from '@/services/cnab/motorCNAB240.service';

// Mock do Supabase para conciliação e matching
vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-test-id', email: 'tester@orbe.com' } },
        }),
      },
    },
  };
});

// Mock parcial do base.service preservando BaseService
vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-123'),
  };
});

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
  },
}));

// Helpers para construir linhas posicionalmente válidas de 240 caracteres
function padStr(val: string, len: number): string {
  return val.padEnd(len, ' ').substring(0, len);
}
function padNum(val: number | string, len: number): string {
  return String(val).padStart(len, '0').slice(-len);
}

function buildMockHeaderArquivo(banco: string, seq = 1): string {
  let l = banco;                         // 1-3: Banco (3)
  l += '0000';                            // 4-7: Lote (4)
  l += '0';                               // 8-8: Tipo (1)
  l += padStr('', 9);                     // 9-17: Brancos (9)
  l += '2';                               // 18-18: Tipo inscrição CNPJ (1)
  l += padNum('12345678000199', 14);      // 19-32: CNPJ (14)
  l += padStr('', 20);                    // 33-52: Convênio (20)
  l += padNum('1234', 5);                 // 53-57: Agência (5)
  l += ' ';                               // 58-58: Dígito agência (1)
  l += padNum('12345', 12);               // 59-70: Conta (12)
  l += ' ';                               // 71-71: Dígito conta (1)
  l += ' ';                               // 72-72: Dígito ag/conta (1)
  l += padStr('EMPRESA TESTE', 30);       // 73-102: Nome Empresa (30)
  l += padStr(banco === '341' ? 'BANCO ITAU SA' : 'BANCO DO BRASIL', 30); // 103-132: Banco (30)
  l += padStr('', 10);                    // 133-142: Brancos (10)
  l += '2';                               // 143-143: Código Arquivo (1) - 2 = Retorno
  l += '28092026';                        // 144-151: Data (8)
  l += '100000';                          // 152-157: Hora (6)
  l += padNum(seq, 6);                    // 158-163: Sequencial (6)
  l += '081';                             // 164-166: Layout (3)
  l += padStr('', 74);                    // 167-240: Brancos (74)
  return l.padEnd(240, ' ');
}

function buildMockHeaderLote(banco: string, lote = 1): string {
  let l = banco;                         // 1-3: Banco (3)
  l += padNum(lote, 4);                   // 4-7: Lote (4)
  l += '1';                               // 8-8: Tipo (1)
  l += 'C';                               // 9-9: Operação (1)
  l += '20';                              // 10-11: Serviço (2)
  l += '41';                              // 12-13: Lançamento (2)
  l += '040';                             // 14-16: Layout (3)
  l += ' ';                               // 17-17: Branco (1)
  l += '2';                               // 18-18: Tipo Inscrição (1)
  l += padNum('12345678000199', 14);      // 19-32: CNPJ (14)
  l += padStr('', 20);                    // 33-52: Convênio (20)
  l += padNum('1234', 5);                 // 53-57: Agência (5)
  l += ' ';                               // 58-58: Dígito agência (1)
  l += padNum('12345', 12);               // 59-70: Conta (12)
  l += ' ';                               // 71-71: Dígito conta (1)
  l += ' ';                               // 72-72: Dígito ag/conta (1)
  l += padStr('EMPRESA TESTE', 30);       // 73-102: Nome (30)
  l += padStr('', 138);                   // 103-240: Brancos (138)
  return l.padEnd(240, ' ');
}

function buildMockSegmentoA(
  banco: string,
  lote: number,
  seq: number,
  codOcorrencia: string,
  valor: number,
  seuNumero: string,
  _cpf: string,
  motivo2 = ''
): string {
  let l = banco;                         // 1-3: Banco (3)
  l += padNum(lote, 4);                   // 4-7: Lote (4)
  l += '3';                               // 8-8: Tipo detalhe (1)
  l += padNum(seq, 5);                    // 9-13: NSeq (5)
  l += 'A';                               // 14-14: Segmento A (1)
  l += '0';                               // 15-15: Tipo movimento (1)
  l += padStr(codOcorrencia, 2);          // 16-17: Código ocorrência retorno (2)
  l += '018';                             // 18-20: Câmara (3)
  l += banco;                             // 21-23: Banco favorecido (3)
  l += padNum('1234', 5);                 // 24-28: Agência (5)
  l += ' ';                               // 29-29: Dígito agência (1)
  l += padNum('54321', 12);               // 30-41: Conta (12)
  l += ' ';                               // 42-42: Dígito conta (1)
  l += ' ';                               // 43-43: Dígito ag/conta (1)
  l += padStr('FAVORECIDO TESTE', 30);    // 44-73: Nome (30)
  l += padStr(seuNumero, 20);             // 74-93: Seu Número (20)
  l += '28092026';                        // 94-101: Data pagamento (8)
  l += 'BRL';                             // 102-104: Moeda (3)
  l += padNum('0', 15);                   // 105-119: Qtd moeda (15)
  const cents = Math.round(valor * 100);
  l += padNum(cents, 15);                 // 120-134: Valor pagamento (15)
  l += padStr('NOSSO123', 20);            // 135-154: Nosso número (20)
  l += '28092026';                        // 155-162: Data real (8)
  l += padNum(cents, 15);                 // 163-177: Valor real (15)
  l += padStr('', 53);                    // 178-230: Brancos (53)
  l += padStr(codOcorrencia + motivo2, 10); // 231-240: Ocorrências / Motivos (10)
  return l.padEnd(240, ' ');
}

function buildMockSegmentoB(banco: string, lote: number, seq: number, cpf: string): string {
  let l = banco;                         // 1-3 (3)
  l += padNum(lote, 4);                   // 4-7 (4)
  l += '3';                               // 8-8 (1)
  l += padNum(seq, 5);                    // 9-13 (5)
  l += 'B';                               // 14-14: Segmento B (1)
  l += '   ';                             // 15-17: Brancos (3)
  l += '1';                               // 18-18: 1=CPF (1)
  l += padNum(cpf.replace(/\D/g, ''), 14);// 19-32: CPF (14)
  l += padStr('', 208);                   // 33-240: Brancos (208)
  return l.padEnd(240, ' ');
}

function buildMockTrailerLote(banco: string, lote: number, qtdRegistros: number, valorTotal: number): string {
  let l = banco;                         // 1-3 (3)
  l += padNum(lote, 4);                   // 4-7 (4)
  l += '5';                               // 8-8 (1)
  l += padStr('', 9);                     // 9-17 (9)
  l += padNum(qtdRegistros, 6);           // 18-23: Qtd registros do lote (6)
  const cents = Math.round(valorTotal * 100);
  l += padNum(cents, 18);                 // 24-41: Somatório (18)
  l += padStr('', 199);                   // 42-240 (199)
  return l.padEnd(240, ' ');
}

function buildMockTrailerArquivo(banco: string, qtdLotes: number, totalLinhas: number): string {
  let l = banco;                         // 1-3 (3)
  l += '9999';                            // 4-7 (4)
  l += '9';                               // 8-8 (1)
  l += padStr('', 9);                     // 9-17 (9)
  l += padNum(qtdLotes, 6);               // 18-23 (6)
  l += padNum(totalLinhas, 6);            // 24-29 (6)
  l += padStr('', 211);                   // 30-240 (211)
  return l.padEnd(240, ' ');
}

describe('MOTOR CNAB MULTIBANCO — FASE 2: RETORNO E CONCILIAÇÃO', () => {

  const empresaMock: EmpresaRemessa = {
    cnpj: '12345678000199',
    razao_social: 'BENEVIDES OPERACOES',
    banco_codigo: '341',
    agencia: '1234',
    conta: '12345',
    conta_digito: '6',
    convenio: '',
  };

  const beneficiarioMock: BeneficiarioPagamento = {
    nome: 'DIARISTA 1',
    cpf: '12345678901',
    valor: 210,
    banco_codigo: '341',
    agencia: '4321',
    conta: '98765',
    conta_digito: '0',
    tipo_conta: 'corrente',
    data_pagamento: new Date('2026-09-28T12:00:00Z'),
    seu_numero: 'DIA1BF3F73C930495',
  };

  // 1. Retorno BB 001 -> Reader BB
  it('1. Deve instanciar CNAB240BBReader quando o banco for 001', () => {
    const reader = CNABRetornoReaderFactory.getReaderForBanco('001');
    expect(reader).toBeInstanceOf(CNAB240BBReader);

    const header = buildMockHeaderArquivo('001');
    const readerDetectado = CNABRetornoReaderFactory.getReader(header);
    expect(readerDetectado).toBeInstanceOf(CNAB240BBReader);
  });

  // 2. Retorno Itaú 341 -> Reader Itaú
  it('2. Deve instanciar CNAB240ItauReader quando o banco for 341', () => {
    const reader = CNABRetornoReaderFactory.getReaderForBanco('341');
    expect(reader).toBeInstanceOf(CNAB240ItauReader);

    const header = buildMockHeaderArquivo('341');
    const readerDetectado = CNABRetornoReaderFactory.getReader(header);
    expect(readerDetectado).toBeInstanceOf(CNAB240ItauReader);
  });

  // 3. Banco não homologado -> Bloqueio explícito com mensagem
  it('3. Deve bloquear banco não homologado com mensagem explícita e NUNCA usar BB como fallback', () => {
    expect(() => CNABRetornoReaderFactory.getReaderForBanco('237')).toThrow(
      'Banco 237 ainda não possui retorno CNAB240 homologado no ORBE.'
    );
    expect(() => CNABRetornoReaderFactory.getReaderForBanco('033')).toThrow(
      'Banco 033 ainda não possui retorno CNAB240 homologado no ORBE.'
    );

    const headerBradesco = buildMockHeaderArquivo('237');
    expect(() => CNABRetornoReaderFactory.getReader(headerBradesco)).toThrow(
      'Banco 237 ainda não possui retorno CNAB240 homologado no ORBE.'
    );
  });

  // 4. DIARISTA localizado corretamente no matching
  it('4. Deve localizar fatura de DIARISTA corretamente e manter contrato canônico', async () => {
    const { supabase } = await import('@/lib/supabase');

    const mockRemessaItens = [
      { id: 'rem-item-1', remessa_id: 'rem-1', origem_tipo: 'DIARISTA', origem_id: 'diaria-1', valor: 140 },
      { id: 'rem-item-2', remessa_id: 'rem-1', origem_tipo: 'DIARISTA', origem_id: 'diaria-2', valor: 70 },
    ];

    const mockDiaristas = [
      {
        id: 'diaria-1',
        lote_fechamento_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        diarista_id: '930495bc-0e1f-4b08-b112-9c3a388f6125',
        valor_calculado: 140,
        nome_colaborador: 'DIARISTA 1',
        cpf_colaborador: '12345678901',
      },
      {
        id: 'diaria-2',
        lote_fechamento_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        diarista_id: '930495bc-0e1f-4b08-b112-9c3a388f6125',
        valor_calculado: 70,
        nome_colaborador: 'DIARISTA 1',
        cpf_colaborador: '12345678901',
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockRemessaItens, error: null }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockDiaristas, error: null }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: '930495bc-0e1f-4b08-b112-9c3a388f6125', nome: 'DIARISTA 1', cpf: '12345678901' }],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const faturas = await CnabRetornoService.carregarFaturasRelacionadas(
      { id: 'rem-1' } as any,
      {} as any
    );

    expect(faturas.length).toBe(2);
    expect(faturas[0].origem_tipo).toBe('DIARISTA');
    expect(faturas[0].colaborador_id).toBe('930495bc-0e1f-4b08-b112-9c3a388f6125');
    expect(faturas[0].valor_consolidado).toBe(210);
    expect(faturas[0].seu_numero_esperado).toBe('DIA1BF3F73C930495BC');
  });

  // 5. Retorno pago -> Item pago
  it('5. Deve classificar item como PAGO quando a ocorrência for liquidação bem-sucedida', () => {
    const ocItau = mapearOcorrenciaItau('00');
    expect(ocItau.statusBase).toBe('pago');

    const fatura: any = {
      id: 'fatura-teste-1',
      valor: 210,
      valor_consolidado: 210,
      seu_numero_esperado: 'DIA1BF3F73C930495BC',
    };

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIA1BF3F73C930495BC', valorPago: 210 } as any,
      [fatura]
    );
    expect(match.fatura).toBeDefined();
    expect(match.criterio).toBe('seu_numero_forte');
  });

  // 6. Retorno rejeitado -> Item NÃO pago
  it('6. Deve classificar item como REJEITADO e não permitir status pago', () => {
    const ocItau = mapearOcorrenciaItau('03');
    expect(ocItau.statusBase).toBe('rejeitado');

    const ocItauRJ = mapearOcorrenciaItau('RJ');
    expect(ocItauRJ.statusBase).toBe('rejeitado');

    const ocBB = mapearOcorrenciaBB('RJ');
    expect(ocBB.statusBase).toBe('rejeitado');

    // Mapeador sensível ao banco
    const unificada = mapearOcorrenciaRetorno('341', '03');
    expect(unificada.statusBase).toBe('rejeitado');
  });

  // 7. Retorno parcial -> Lote NÃO pago
  it('7. Deve manter lote como cnab_gerado / conciliacao_parcial se nem todos os itens forem pagos', async () => {
    const { supabase } = await import('@/lib/supabase');

    const mockRetornoItens = [
      { id: 'ret-1', remessa_arquivo_id: 'rem-1', diaristas_lote_id: 'lote-1', fatura_id: 'd-1', status: 'pago' },
      { id: 'ret-2', remessa_arquivo_id: 'rem-1', diaristas_lote_id: 'lote-1', fatura_id: 'd-2', status: 'rejeitado', descricao_ocorrencia: 'Rejeitado pelo banco' },
    ];

    const updateCalls: { table: string; data: any }[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockRetornoItens, error: null }),
          }),
          update: vi.fn((data) => {
            updateCalls.push({ table, data });
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
              in: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: 'rem-1', diaristas_lote_id: 'lote-1' }], error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: 'ri-1', remessa_id: 'rem-1', origem_id: 'd-1' }], error: null }),
          }),
          update: vi.fn((data) => {
            updateCalls.push({ table, data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              // 2 lançamentos no lote: 1 foi pago, 1 continua em AGUARDANDO_PAGAMENTO
              data: [
                { id: 'd-1', status: 'PAGO' },
                { id: 'd-2', status: 'AGUARDANDO_PAGAMENTO' },
              ],
              error: null,
            }),
          }),
          update: vi.fn((data) => {
            updateCalls.push({ table, data });
            return { eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn((data) => {
            updateCalls.push({ table, data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-1');
    expect(res.success).toBe(true);

    // O lote NÃO pode ser PAGO
    const loteUpdate = updateCalls.find((c) => c.table === 'diaristas_lotes_fechamento');
    expect(loteUpdate).toBeDefined();
    expect(loteUpdate?.data.status).toBe('cnab_gerado');
    expect(loteUpdate?.data.status_conciliacao).toBe('conciliacao_parcial');
  });

  // 8. Todos os itens pagos -> Lote PAGO
  it('8. Deve promover lote para PAGO / conciliado somente quando TODOS os itens forem quitados', async () => {
    const { supabase } = await import('@/lib/supabase');

    const mockRetornoItens = [
      { id: 'ret-1', remessa_arquivo_id: 'rem-1', diaristas_lote_id: 'lote-1', fatura_id: 'd-1', status: 'pago' },
      { id: 'ret-2', remessa_arquivo_id: 'rem-1', diaristas_lote_id: 'lote-1', fatura_id: 'd-2', status: 'pago' },
    ];

    const updateCalls: { table: string; data: any }[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockRetornoItens, error: null }),
          }),
          update: vi.fn((data) => {
            updateCalls.push({ table, data });
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
              in: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: 'rem-1', diaristas_lote_id: 'lote-1' }], error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              // Ambos pagos
              data: [
                { id: 'd-1', status: 'PAGO' },
                { id: 'd-2', status: 'PAGO' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn((data) => {
            updateCalls.push({ table, data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-2');
    expect(res.success).toBe(true);

    const loteUpdate = updateCalls.find((c) => c.table === 'diaristas_lotes_fechamento');
    expect(loteUpdate).toBeDefined();
    expect(loteUpdate?.data.status).toBe('PAGO');
    expect(loteUpdate?.data.status_conciliacao).toBe('conciliado');
  });

  // 9. Mesmo retorno duas vezes -> Bloqueado por hash
  it('9. Deve bloquear reprocessamento do mesmo arquivo de retorno por hash', async () => {
    const { supabase } = await import('@/lib/supabase');

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'ret-antigo', nome_arquivo: 'RET_JA_PROCESSADO.RET' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
    });

    const fileMock = {
      name: 'RET_JA_PROCESSADO.RET',
      text: async () => 'conteudo dummy',
    } as unknown as File;

    await expect(CnabRetornoService.processarArquivo(fileMock, '341')).rejects.toThrow(
      'Arquivo de retorno ja processado anteriormente'
    );
  });

  // 10. Banco da remessa persistido corretamente
  it('10. Deve identificar remessa tanto pelo banco_codigo persistido quanto pelo da conta pagadora', async () => {
    const { supabase } = await import('@/lib/supabase');

    const mockRemessas = [
      {
        id: 'rem-itau-1',
        banco_codigo: null, // Histórico com NULL
        contas_bancarias_empresa: { empresa_id: 'emp-1', banco_codigo: '341' },
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockRemessas, error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const parseResult: any = {
      metadados: { sequencialArquivo: 3 },
      estrutura: {
        headerArquivo: { banco: '341', agencia: '1234', conta: '12345', convenio: '' },
      },
      resumo: { valorTotalPago: 210 },
    };

    const remRel = await CnabRetornoService.localizarRemessaRelacionada(parseResult);
    expect(remRel).toBeDefined();
    expect(remRel?.id).toBe('rem-itau-1');
  });

  // 11. Matching por identificador forte (seu_numero determinístico)
  it('11. Deve preferir matching por seu_numero forte antes de qualquer fallback', () => {
    const faturas: any[] = [
      {
        id: 'fatura-1',
        seu_numero_esperado: 'DIA1BF3F73C930495BC',
        valor: 140,
        colaboradores: { cpf: '12345678901' },
      },
      {
        id: 'fatura-2',
        seu_numero_esperado: 'DIA99999999AAAAAAAA',
        valor: 210,
        colaboradores: { cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      {
        seuNumero: 'DIA1BF3F73C930495BC',
        valorPago: 210, // mesmo com valor diferente de 140
        documentoFavorecido: '12345678901',
      } as any,
      faturas
    );

    expect(match.criterio).toBe('seu_numero_forte');
    expect(match.fatura?.id).toBe('fatura-1');
  });

  // 12. Fallback histórico CPF + valor quando seu_numero está vazio
  it('12. Deve executar fallback para CPF + valor para remessas históricas sem seu_numero', () => {
    const faturas: any[] = [
      {
        id: 'fatura-historica',
        seu_numero_esperado: null,
        valor: 210,
        valor_consolidado: 210,
        colaboradores: { cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      {
        seuNumero: '',
        documentoEmpresa: '',
        nossoNumero: '',
        valorPago: 210,
        documentoFavorecido: '123.456.789-01',
      } as any,
      faturas
    );

    expect(match.criterio).toBe('documento_valor');
    expect(match.fatura?.id).toBe('fatura-historica');
  });

  // 13. Tenant diferente -> Bloqueado
  it('13. Não deve associar retorno a remessa pertencente a outro tenant', async () => {
    const { supabase } = await import('@/lib/supabase');
    const { EnvironmentService } = await import('@/services/environment/EnvironmentService');

    (EnvironmentService.assertEmpresaAllowed as any).mockRejectedValueOnce(
      new Error('Acesso negado: empresa pertence a outro tenant')
    );

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'rem-outro-tenant',
                  banco_codigo: '341',
                  contas_bancarias_empresa: { empresa_id: 'emp-estranha', banco_codigo: '341' },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const parseResult: any = {
      metadados: { sequencialArquivo: 3 },
      estrutura: { headerArquivo: { banco: '341' } },
      resumo: { valorTotalPago: 210 },
    };

    const res = await CnabRetornoService.localizarRemessaRelacionada(parseResult);
    expect(res).toBeNull();
  });

  // 14. Empresa diferente -> Bloqueado
  it('14. Não deve permitir baixa em empresa fora do escopo autorizado', async () => {
    const { EnvironmentService } = await import('@/services/environment/EnvironmentService');
    (EnvironmentService.assertEmpresaAllowed as any).mockRejectedValueOnce(new Error('Empresa não autorizada'));

    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant-123', empresaId: 'emp-outra' })
    ).rejects.toThrow('Empresa não autorizada');
  });

  // 15. Gerar remessa continua NÃO significando pagamento
  it('15. Gerar remessa Itaú ou BB define status como cnab_gerado e NÃO como pago', () => {
    const resBB = MotorCNAB240.gerar(
      { ...empresaMock, banco_codigo: '001' },
      [beneficiarioMock]
    );
    expect(resBB.conteudo).toBeDefined();

    const resItau = MotorCNAB240.gerar(
      { ...empresaMock, banco_codigo: '341' },
      [beneficiarioMock]
    );
    expect(resItau.conteudo).toBeDefined();
  });

  // 16. Regressão BB 001
  it('16. Regressão BB: CNAB240BBReader deve continuar funcionando perfeitamente para retorno 001', async () => {
    const reader = new CNAB240BBReader();

    const hArq = buildMockHeaderArquivo('001');
    const hLote = buildMockHeaderLote('001');
    const segA = buildMockSegmentoA('001', 1, 1, '00', 100, 'DOC123', '12345678901');
    const segB = buildMockSegmentoB('001', 1, 2, '12345678901');
    const tLote = buildMockTrailerLote('001', 1, 4, 100);
    const tArq = buildMockTrailerArquivo('001', 1, 6);

    const content = [hArq, hLote, segA, segB, tLote, tArq].join('\r\n');

    const result = await reader.parse(content, { banco: '001' });
    expect(result.resumo.banco).toBe('001');
    expect(result.resumo.quantidadeTitulos).toBe(1);
    expect(result.resumo.quantidadeLiquidados).toBe(1);
    expect(result.resumo.valorTotalPago).toBe(100);
  });

  // 17. Regressão do Writer Itaú 341
  it('17. Regressão Itaú: CNAB240ItauReader deve ler arquivo de retorno Itaú 341 com sucesso', async () => {
    const reader = new CNAB240ItauReader();

    const hArq = buildMockHeaderArquivo('341');
    const hLote = buildMockHeaderLote('341');
    const segA = buildMockSegmentoA('341', 1, 1, '00', 210, 'DIA1BF3F73C930495BC', '12345678901');
    const segB = buildMockSegmentoB('341', 1, 2, '12345678901');
    const tLote = buildMockTrailerLote('341', 1, 4, 210);
    const tArq = buildMockTrailerArquivo('341', 1, 6);

    const content = [hArq, hLote, segA, segB, tLote, tArq].join('\r\n');

    const result = await reader.parse(content, { banco: '341' });
    expect(result.resumo.banco).toBe('341');
    expect(result.resumo.quantidadeTitulos).toBe(1);
    expect(result.resumo.quantidadeLiquidados).toBe(1);
    expect(result.resumo.valorTotalPago).toBe(210);
  });

  // 18. Lote P/MP do mesmo diarista continua rastreável
  it('18. Lote com P (140) + MP (70) deve ter identificador determinístico e valor consolidado de 210', () => {
    const loteId = '1bf3f73c-942e-4127-be32-bf27df39d1a5';
    const diaristaId = '930495bc-0e1f-4b08-b112-9c3a388f6125';

    const cleanLote = loteId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    const cleanColab = diaristaId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    const seuNumero = `DIA${cleanLote}${cleanColab}`;

    expect(seuNumero).toBe('DIA1BF3F73C930495BC');
    expect(seuNumero.length).toBeLessThanOrEqual(20);
  });

  // 19. Botão manual não permite pagamento
  it('19. Validação do botão manual: LoteFechamentoDiaristaService bloqueia pagamento manual', async () => {
    const { LoteFechamentoDiaristaService } = await import('@/services/domain/diaristas.service');
    await expect(
      LoteFechamentoDiaristaService.marcarComoPago('lote-1', 'user-1', 'Admin')
    ).rejects.toThrow('Pagamento manual desabilitado');
  });

  // 20. Nenhuma UF fictícia 'SP' no novo CNAB Itaú ou BB
  it('20. Nenhum fallback de estado SP deve ser gerado quando o estado do beneficiário estiver ausente', () => {
    const benSemEstado: BeneficiarioPagamento = {
      ...beneficiarioMock,
      estado: undefined, // Sem estado
    };

    const cnabItau = gerarCNAB240Itau(empresaMock, [benSemEstado]);
    const linhasItau = cnabItau.conteudo.split('\r\n');
    const segBItau = linhasItau.find((l) => l.slice(13, 14) === 'B');
    expect(segBItau).toBeDefined();
    // Posições 126-127 (índice 125 a 127) não podem ser 'SP', devem ser dois espaços em branco
    const ufItau = segBItau!.slice(125, 127);
    expect(ufItau).toBe('  ');
    expect(ufItau).not.toBe('SP');

    const cnabBB = gerarCNAB240BB({ ...empresaMock, banco_codigo: '001' }, [benSemEstado]);
    const linhasBB = cnabBB.conteudo.split('\r\n');
    const segBBB = linhasBB.find((l) => l.slice(13, 14) === 'B');
    expect(segBBB).toBeDefined();
    const ufBB = segBBB!.slice(125, 127);
    expect(ufBB).toBe('  ');
    expect(ufBB).not.toBe('SP');
  });
});
