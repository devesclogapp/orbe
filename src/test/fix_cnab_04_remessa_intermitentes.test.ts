import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { LoteFechamentoDiaristaService } from '@/services/domain/diaristas.service';
import { CNABService } from '@/services/financial.service';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import { SimulacaoHomologacaoService } from '@/services/cnab/simulacaoHomologacao.service';
import { BancarioOficialAdapter } from '@/services/bancarioOficialAdapter';
import { MotorCNAB240 } from '@/services/cnab/motorCNAB240.service';
import { supabase } from '@/lib/supabase';
import { EnvironmentService } from '@/services/environment/EnvironmentService';

const mockUser = { id: 'usr-cnab-test-04', email: 'auditor04@orbe.test' };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-test-04', userId: 'usr-cnab-test-04' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-04'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-cnab-test-04', tenant_id: 'tenant-test-04' }),
  };
});

function createChainableQuery(data: any = null, error: any = null) {
  const query: any = {
    _data: data,
    _error: error,
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    not: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    range: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data, error })),
    then: (resolve: any, reject?: any) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return query;
}

describe('FIX-CNAB-04 — Implementação controlada da remessa de intermitentes', () => {
  const empHmlId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
  const loteIntHmlId = '67b0d4c0-7878-43ab-8cd2-06d67f58909f';
  const remessaNsa9Id = '8aebd6bc-d9d5-4a42-8ffa-1e2f4ef42543';

  const mockLancamentos2x300 = [
    {
      id: 'lanc-int-001',
      fechamento_id: loteIntHmlId,
      colaborador_id: 'colab-001',
      nome_colaborador: 'Colaborador Intermitente Um',
      cpf: '11122233344',
      total: 300.0,
      valor_total: 300.0,
      status_pipeline: 'ENVIADO_FINANCEIRO',
      chave_pix: '11122233344',
      tipo_chave_pix: 'CPF',
    },
    {
      id: 'lanc-int-002',
      fechamento_id: loteIntHmlId,
      colaborador_id: 'colab-002',
      nome_colaborador: 'Colaborador Intermitente Dois',
      cpf: '55566677788',
      total: 300.0,
      valor_total: 300.0,
      status_pipeline: 'ENVIADO_FINANCEIRO',
      chave_pix: '55566677788',
      tipo_chave_pix: 'CPF',
    },
  ];

  const mockColaboradoresCompletos = [
    {
      id: 'colab-001',
      nome: 'Colaborador Intermitente Um',
      cpf: '11122233344',
      banco_codigo: '341',
      agencia: '1234',
      agencia_digito: '0',
      conta: '56789',
      digito_conta: '0',
      tipo_conta: 'corrente',
    },
    {
      id: 'colab-002',
      nome: 'Colaborador Intermitente Dois',
      cpf: '55566677788',
      banco_codigo: '341',
      agencia: '1234',
      agencia_digito: '0',
      conta: '98765',
      digito_conta: '1',
      tipo_conta: 'corrente',
    },
  ];

  const mockContaBancaria = {
    id: 'conta-hml-1',
    empresa_id: empHmlId,
    banco_codigo: '341',
    banco_nome: 'Itaú Unibanco',
    agencia: '1234',
    conta: '56789',
    digito_conta: '0',
    convenio: 'CONV123',
    ativo: true,
    permite_cnab: true,
  };

  const mockEmpresaRemetente = {
    cnpj: '12345678000199',
    razao_social: 'EMPRESA TESTE - HOMOLOGACAO',
    banco_codigo: '341',
    agencia: '1234',
    conta: '56789',
    digito_conta: '0',
    convenio_bancario: 'CONV123',
  };

  beforeEach(() => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined as any);
    vi.spyOn(EnvironmentService, 'getTestEmpresaIds').mockResolvedValue([empHmlId]);
  });

  // ─── TESTE 1: Homologação gera relatório não transmissível ────────────────
  it('1. Homologação gera relatório de simulação não transmissível com aviso explícito e origem INTERMITENTES', async () => {
    const relatorio = SimulacaoHomologacaoService.gerar({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste - Homologação',
      bancoCodigo: '341',
      sequencial: 9,
      totalRegistros: 2,
      totalValor: 600.0,
      beneficiarios: [
        { nome: 'Colaborador Intermitente Um', valor: 300.0, cpf: '11122233344' },
        { nome: 'Colaborador Intermitente Dois', valor: 300.0, cpf: '55566677788' },
      ],
      dataGeracao: new Date('2026-10-14T10:00:00Z'),
    });

    expect(relatorio.fileName).toMatch(/^SIMULACAO_HOMOLOGACAO_ITAU_\d{8}_SEQ000009\.txt$/);
    expect(relatorio.content).toContain('SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO');
    expect(relatorio.content).toContain('MODALIDADE: INTERMITENTES');
    expect(relatorio.content).toContain('ESTE ARQUIVO NÃO É UM ARQUIVO POSICIONAL FEBRABAN');
    expect(relatorio.content).toContain('R$ 600.00');
    expect(relatorio.content).toContain('Colaborador Intermitente Um — R$ 300,00');
    expect(relatorio.content).not.toMatch(/^01\d{14}/); // Não é arquivo posicional bancário
  });

  // ─── TESTE 2: Produção mantém CNAB posicional válido ───────────────────────
  it('2. Produção mantém CNAB posicional FEBRABAN 240 com finalidade PAGAMENTO INTERMITENTES', async () => {
    const resultado = MotorCNAB240.gerar(
      {
        cnpj: '12345678000199',
        razao_social: 'EMPRESA PRODUCAO LTDA',
        banco_codigo: '341',
        agencia: '1234',
        agencia_digito: '0',
        conta: '56789',
        digito_conta: '0',
        convenio_bancario: 'CONV123',
      },
      [
        {
          nome: 'Colaborador Intermitente Um',
          cpf: '11122233344',
          banco_codigo: '341',
          agencia: '1234',
          agencia_digito: '0',
          conta: '56789',
          conta_digito: '0',
          tipo_conta: 'corrente',
          valor: 300.0,
          data_pagamento: new Date('2026-10-14T10:00:00Z'),
        },
      ],
      {
        sequencial_remessa: 10,
        finalidade_lote: 'PAGAMENTO INTERMITENTES',
      }
    );

    expect(resultado.conteudo).toBeDefined();
    const linhas = resultado.conteudo.split('\r\n').filter(Boolean);
    expect(linhas.length).toBeGreaterThanOrEqual(4);
    linhas.forEach((linha) => {
      expect(linha.length).toBe(240);
    });

    const headerLote = linhas[1];
    expect(headerLote).toContain('PAGAMENTO INTERMITENTES');
    expect(headerLote).not.toContain('PAGAMENTO DIARISTAS');
  });

  // ─── TESTE 3: Persistência falha → download bloqueado ──────────────────────
  it('3. Persistência falha → download é bloqueado (fail-closed)', async () => {
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return createChainableQuery({
          id: loteIntHmlId,
          codigo_lote: 'INT-2026-07',
          empresa_id: empHmlId,
          status: 'FECHADO_FINANCEIRO',
          valor_total: 600.0,
        });
      }
      if (table === 'lancamentos_intermitentes') {
        return createChainableQuery(mockLancamentos2x300);
      }
      if (table === 'colaboradores') {
        return createChainableQuery(mockColaboradoresCompletos);
      }
      if (table === 'empresas') {
        return createChainableQuery({ id: empHmlId, nome: 'Empresa Teste', is_teste: true });
      }
      if (table === 'contas_bancarias_empresa') {
        return createChainableQuery([mockContaBancaria]);
      }
      return createChainableQuery(null);
    });

    vi.spyOn(CnabRemessaArquivoService, 'checkIntermitentesLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(10);
    const spyReg = vi.spyOn(CnabRemessaArquivoService, 'registrar').mockRejectedValue(new Error('Falha simulada na gravação da remessa'));

    try {
      await expect(
        IntermitentesLoteService.gerarCNABParaLote({
          loteId: loteIntHmlId,
          empresaId: empHmlId,
          geradoPor: 'usr-01',
          geradoPorNome: 'Operador Financeiro',
          empresaRemetente: mockEmpresaRemetente,
        })
      ).rejects.toThrow('Falha simulada na gravação da remessa');

      // Download não pode ter sido chamado
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    } finally {
      spyReg.mockRestore();
    }
  });

  // ─── TESTE 4: Persistência falha → NSA não avança ──────────────────────────
  it('4. Persistência falha → sequencial/NSA é abortado atomicamente pela RPC', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'empresas') {
        return createChainableQuery({ id: empHmlId, is_teste: true });
      }
      return createChainableQuery(null);
    });
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Erro de violação de chave estrangeira na RPC', code: '23503' },
    });

    await expect(
      CnabRemessaArquivoService.registrar({
        bancoCodigo: '341',
        empresaId: empHmlId,
        nomeArquivo: 'CB341_20261014000010.txt',
        conteudoArquivo: 'dummy_cnab_content',
        totalRegistros: 4,
        totalValor: 600.0,
        modo: 'homologacao',
        intermitentesLoteId: loteIntHmlId,
        loteId: null,
        itens: [
          { origem_id: 'lanc-int-001', valor: 300.0, origem_tipo: 'INTERMITENTE' },
          { origem_id: 'lanc-int-002', valor: 300.0, origem_tipo: 'INTERMITENTE' },
        ],
      })
    ).rejects.toThrow(/Transação CNAB RPC/);
  });

  // ─── TESTE 5: Remessa existente → geração duplicada bloqueada ──────────────
  it('5. Remessa existente para o lote → geração duplicada bloqueada', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'empresas') {
        return createChainableQuery({ id: empHmlId, is_teste: true });
      }
      return createChainableQuery(null);
    });

    const spyCheck = vi.spyOn(CnabRemessaArquivoService, 'checkIntermitentesLoteJaRemessado').mockResolvedValue({
      id: remessaNsa9Id,
      nome_arquivo: 'CB341_20261014000009.txt',
      sequencial_arquivo: 9,
      status: 'gerado',
    } as any);

    try {
      await expect(
        IntermitentesLoteService.gerarCNABParaLote({
          loteId: loteIntHmlId,
          empresaId: empHmlId,
          geradoPor: 'usr-01',
          geradoPorNome: 'Operador',
          empresaRemetente: mockEmpresaRemetente,
        })
      ).rejects.toThrow(/Lote de intermitentes já possui remessa CNAB registrada \(arquivo: CB341_20261014000009\.txt, NSA: 9\)/);

      // Também no próprio CnabRemessaArquivoService.registrar:
      await expect(
        CnabRemessaArquivoService.registrar({
          bancoCodigo: '341',
          empresaId: empHmlId,
          nomeArquivo: 'CB341_TESTE.txt',
          conteudoArquivo: 'dummy_cnab_content',
          totalRegistros: 2,
          totalValor: 600.0,
          intermitentesLoteId: loteIntHmlId,
          loteId: null,
          itens: [],
        })
      ).rejects.toThrow(/Lote de intermitentes já possui remessa CNAB gerada/);
    } finally {
      spyCheck.mockRestore();
    }
  });

  // ─── TESTE 6: Remessa NSA 9 reconhecida pelo adapter ────────────────────────
  it('6. Remessa NSA 9 é vinculada e reconhecida pelo adapter da Central Bancária', async () => {
    const mockLoteDb = {
      id: loteIntHmlId,
      codigo_lote: 'INT-2026-07',
      empresa_id: empHmlId,
      status: 'CNAB_GERADO',
      valor_total: 600.0,
      total_horas: 16.0,
      periodo_inicio: '2026-10-01',
      periodo_fim: '2026-10-14',
      created_at: '2026-10-14T08:00:00Z',
      empresas: { id: empHmlId, nome: 'Empresa Teste - Homologação', is_teste: true },
    };

    const mockRemessaNsa9 = {
      id: remessaNsa9Id,
      nome_arquivo: 'CB341_20261014000009.txt',
      sequencial_arquivo: 9,
      status: 'gerado',
      empresa_id: empHmlId,
      banco_codigo: '341',
      total_registros: 4,
      valor_total: 600.0,
      created_at: '2026-10-14T09:00:00Z',
      modo: 'homologacao',
      intermitentes_lote_id: null, // Histórico onde FK direta era nula
      origem_tipo: 'INTERMITENTE',
    };

    const mockItensNsa9 = [
      { id: 'item-rem-1', remessa_id: remessaNsa9Id, origem_id: 'lanc-int-001', valor: 300.0 },
      { id: 'item-rem-2', remessa_id: remessaNsa9Id, origem_id: 'lanc-int-002', valor: 300.0 },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return createChainableQuery([mockLoteDb]);
      }
      if (table === 'lancamentos_intermitentes') {
        return createChainableQuery([
          { id: 'lanc-int-001', lote_fechamento_id: loteIntHmlId, colaborador_id: 'colab-1', valor_total: 300 },
          { id: 'lanc-int-002', lote_fechamento_id: loteIntHmlId, colaborador_id: 'colab-2', valor_total: 300 },
        ]);
      }
      if (table === 'cnab_remessas_arquivos') {
        return createChainableQuery([mockRemessaNsa9]);
      }
      if (table === 'cnab_remessa_itens') {
        return createChainableQuery(mockItensNsa9);
      }
      if (table === 'empresas') {
        return createChainableQuery([{ id: empHmlId, nome: 'Empresa Teste - Homologação', is_teste: true }]);
      }
      if (table === 'contas_bancarias_empresa') {
        return createChainableQuery([mockContaBancaria]);
      }
      return createChainableQuery([]);
    });

    const itensCarregados = await BancarioOficialAdapter.carregarObrigacoes();
    const itemInt = itensCarregados.find((i) => i.loteId === loteIntHmlId);

    expect(itemInt).toBeDefined();
    expect(itemInt?.remessaId).toBe(remessaNsa9Id);
    expect(itemInt?.remessaNsa).toBe(9);
    expect(itemInt?.situacao).toBe('REMESSA_GERADA');
    expect(itemInt?.estagioTab).toBe('REMESSAS');
    expect(itemInt?.isEmpresaTeste).toBe(true);
  });

  // ─── TESTE 7: Lote INT-2026-07 deixa de aparecer em PRONTAS_BANCO ──────────
  it('7. Lote INT-2026-07 com remessa já gerada deixa de aparecer em PRONTAS_BANCO e vai para REMESSAS', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return createChainableQuery([{
          id: loteIntHmlId,
          codigo_lote: 'INT-2026-07',
          empresa_id: empHmlId,
          status: 'CNAB_GERADO',
          valor_total: 600.0,
          total_horas: 16.0,
          created_at: '2026-10-14T08:00:00Z',
          empresas: { id: empHmlId, nome: 'Empresa Teste', is_teste: true },
        }]);
      }
      if (table === 'lancamentos_intermitentes') {
        return createChainableQuery([
          { id: 'lanc-int-001', lote_fechamento_id: loteIntHmlId, colaborador_id: 'colab-1', valor_total: 300 },
          { id: 'lanc-int-002', lote_fechamento_id: loteIntHmlId, colaborador_id: 'colab-2', valor_total: 300 },
        ]);
      }
      if (table === 'cnab_remessas_arquivos') {
        return createChainableQuery([{
          id: remessaNsa9Id,
          nome_arquivo: 'CB341_20261014000009.txt',
          sequencial_arquivo: 9,
          status: 'gerado',
          empresa_id: empHmlId,
          intermitentes_lote_id: loteIntHmlId,
          origem_tipo: 'INTERMITENTE',
        }]);
      }
      if (table === 'empresas') {
        return createChainableQuery([{ id: empHmlId, nome: 'Empresa Teste - Homologação', is_teste: true }]);
      }
      if (table === 'contas_bancarias_empresa') {
        return createChainableQuery([mockContaBancaria]);
      }
      return createChainableQuery([]);
    });

    const itens = await BancarioOficialAdapter.carregarObrigacoes();
    const itemInt = itens.find((i) => i.loteId === loteIntHmlId);

    expect(itemInt).toBeDefined();
    expect(itemInt?.situacao).not.toBe('PRONTO_BANCO');
    expect(itemInt?.estagioTab).toBe('REMESSAS');
    expect(itemInt?.situacao).toBe('REMESSA_GERADA');
  });

  // ─── TESTE 8: Dois lançamentos de R$ 300,00 → total R$ 600,00 ─────────────
  it('8. Consolidação monetária: 2 lançamentos de R$ 300,00 perfazem exatamente R$ 600,00', async () => {
    const somaLancamentos = mockLancamentos2x300.reduce((acc, l) => acc + l.valor_total, 0);
    expect(somaLancamentos).toBe(600.0);

    const relatorio = SimulacaoHomologacaoService.gerar({
      origem: 'INTERMITENTES',
      bancoCodigo: '341',
      empresaNome: 'Empresa Teste',
      sequencial: 9,
      totalRegistros: 2,
      totalValor: somaLancamentos,
      beneficiarios: mockLancamentos2x300.map((l) => ({
        nome: l.nome_colaborador,
        valor: l.valor_total,
        cpf: l.cpf,
      })),
    });

    expect(relatorio.content).toContain('R$ 600.00');
  });

  // ─── TESTE 9: Contagem de lançamentos e favorecidos únicos ─────────────────
  it('9. Apresenta separadamente a quantidade de lançamentos (2) e quantidade de favorecidos únicos (2)', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return createChainableQuery([{
          id: loteIntHmlId,
          codigo_lote: 'INT-2026-07',
          empresa_id: empHmlId,
          status: 'CNAB_GERADO',
          valor_total: 600.0,
          created_at: '2026-10-14T08:00:00Z',
          empresas: { id: empHmlId, nome: 'Empresa Teste', is_teste: true },
        }]);
      }
      if (table === 'lancamentos_intermitentes') {
        return createChainableQuery([
          { id: 'lanc-int-001', lote_fechamento_id: loteIntHmlId, colaborador_id: 'colab-1', valor_total: 300 },
          { id: 'lanc-int-002', lote_fechamento_id: loteIntHmlId, colaborador_id: 'colab-2', valor_total: 300 },
        ]);
      }
      if (table === 'empresas') {
        return createChainableQuery([{ id: empHmlId, nome: 'Empresa Teste - Homologação', is_teste: true }]);
      }
      if (table === 'contas_bancarias_empresa') {
        return createChainableQuery([mockContaBancaria]);
      }
      return createChainableQuery([]);
    });

    const itens = await BancarioOficialAdapter.carregarObrigacoes();
    const itemInt = itens.find((i) => i.loteId === loteIntHmlId);

    expect(itemInt).toBeDefined();
    expect(itemInt?.quantidadeLancamentos).toBe(2);
    expect(itemInt?.quantidadeFavorecidosUnicos).toBe(2);
    expect(itemInt?.quantidadeFavorecidos).toBe(2);
  });

  // ─── TESTE 10: Nenhuma interferência em CLT ────────────────────────────────
  it('10. Nenhuma interferência no pipeline CNAB de CLT', async () => {
    expect(typeof CNABService.generateRemessa).toBe('function');
    
    (supabase.rpc as any).mockResolvedValue({
      data: { remessa_id: 'remessa-clt-uuid', sucesso: true, sequencial: 1 },
      error: null,
    });
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'empresas') {
        return createChainableQuery({ id: 'emp-clt-1', is_teste: false });
      }
      return createChainableQuery(null);
    });

    const res = await CnabRemessaArquivoService.registrar({
      bancoCodigo: '341',
      empresaId: 'emp-clt-1',
      nomeArquivo: 'CB341_CLT_01.txt',
      conteudoArquivo: 'dummy_clt_content',
      totalRegistros: 10,
      totalValor: 15000.0,
      loteId: 'rh-lote-uuid-1',
      itens: [{ origem_id: 'rh-item-1', valor: 1500.0, origem_tipo: 'CLT' }],
    });

    expect(res.id).toBe('remessa-clt-uuid');
  });

  // ─── TESTE 11: Nenhuma interferência em Diaristas ──────────────────────────
  it('11. Nenhuma interferência no pipeline CNAB de Diaristas', async () => {
    expect(typeof LoteFechamentoDiaristaService.gerarCNABParaLote).toBe('function');

    const resultado = MotorCNAB240.gerar(
      {
        cnpj: '12345678000199',
        razao_social: 'EMPRESA PRODUCAO LTDA',
        banco_codigo: '341',
        agencia: '1234',
        agencia_digito: '0',
        conta: '56789',
        digito_conta: '0',
        convenio_bancario: 'CONV123',
      },
      [
        {
          nome: 'Diarista Um',
          cpf: '99988877766',
          banco_codigo: '341',
          agencia: '1234',
          agencia_digito: '0',
          conta: '56789',
          conta_digito: '0',
          tipo_conta: 'corrente',
          valor: 150.0,
          data_pagamento: new Date('2026-10-14T10:00:00Z'),
        },
      ]
    );

    const linhas = resultado.conteudo.split('\r\n').filter(Boolean);
    const headerLote = linhas[1];
    expect(headerLote).toContain('PAGAMENTO DIARISTAS');
  });

  // ─── TESTE 12: Nenhuma alteração indevida na liquidação ou conciliação ───────
  it('12. Geração de remessa marca lote como CNAB_GERADO e NÃO como PAGO/liquidado', async () => {
    let statusAtualizadoNoLote: string | null = null;
    let statusLancamentosAtualizados: string | null = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        const query = createChainableQuery({
          id: loteIntHmlId,
          codigo_lote: 'INT-2026-07',
          empresa_id: empHmlId,
          status: 'FECHADO_FINANCEIRO',
          valor_total: 600.0,
        });
        query.update = vi.fn().mockImplementation((payload: any) => {
          statusAtualizadoNoLote = payload.status;
          return createChainableQuery({ error: null });
        });
        return query;
      }
      if (table === 'lancamentos_intermitentes') {
        const query = createChainableQuery(mockLancamentos2x300);
        query.update = vi.fn().mockImplementation((payload: any) => {
          statusLancamentosAtualizados = payload.status_pipeline;
          return createChainableQuery({ error: null });
        });
        return query;
      }
      if (table === 'empresas') {
        return createChainableQuery({ id: empHmlId, nome: 'Empresa Teste', is_teste: true });
      }
      if (table === 'colaboradores') {
        return createChainableQuery(mockColaboradoresCompletos);
      }
      if (table === 'contas_bancarias_empresa') {
        return createChainableQuery([mockContaBancaria]);
      }
      return createChainableQuery(null);
    });

    vi.spyOn(CnabRemessaArquivoService, 'checkIntermitentesLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(9);
    const spyReg = vi.spyOn(CnabRemessaArquivoService, 'registrar').mockResolvedValue({
      remessa_id: remessaNsa9Id,
      sucesso: true,
      sequencial: 9,
      modo: 'homologacao',
    } as any);

    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    global.URL.revokeObjectURL = vi.fn();

    try {
      await IntermitentesLoteService.gerarCNABParaLote({
        loteId: loteIntHmlId,
        empresaId: empHmlId,
        geradoPor: 'usr-01',
        geradoPorNome: 'Operador Financeiro',
        empresaRemetente: mockEmpresaRemetente,
      });

      // Validar status:
      expect(statusAtualizadoNoLote).toBe('CNAB_GERADO');
      expect(statusAtualizadoNoLote).not.toBe('PAGO');
      expect(statusLancamentosAtualizados).not.toBe('PAGO');
    } finally {
      spyReg.mockRestore();
    }
  });
});
