import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';
import { CNABRetornoReaderFactory } from '@/services/cnab/CNABRetornoReaderFactory';

// Mock do supabase e base.service
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-test' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue('09ccafb6-2cf2-4c83-ac3d-a2913947693c'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-test', tenant_id: '09ccafb6-2cf2-4c83-ac3d-a2913947693c' }),
}));

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
  },
}));

describe('CNAB RETORNO — BLINDAGEM FAIL-CLOSED & CONTRATO RPC', () => {
  const filePath70 = path.join(process.cwd(), 'RETORNO_ITAU_HOMOLOGACAO_COMPLEMENTAR_70.RET');
  const conteudoValido70 = fs.readFileSync(filePath70, 'utf8');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const remessaValidaMock = {
    id: '79aae5f6-6031-47fe-94cd-7bebe8fd5984',
    sequencial_arquivo: 4,
    banco_codigo: '341',
    total_valor: 210,
    empresa_id: '4d4c1328-a8e7-4c5b-875d-924b416fa13a',
    conta_bancaria_id: '26f655a9-acd5-4dbc-b0db-a987c29e0686',
    contas_bancarias_empresa: {
      id: '26f655a9-acd5-4dbc-b0db-a987c29e0686',
      empresa_id: '4d4c1328-a8e7-4c5b-875d-924b416fa13a',
      banco_codigo: '341',
      agencia: '1234',
      conta: '12345',
      convenio: '',
    },
    lotes_remessa: {
      id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
      valor_total: 210,
    },
  };

  // A. Itaú 341 + NSA existente → localiza remessa
  it('A. Itaú 341 + NSA existente (4) -> deve localizar a remessa correspondente com sucesso', async () => {
    const { supabase } = await import('@/lib/supabase');

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: any) => {
              if (col === 'sequencial_arquivo' && val === 4) {
                return Promise.resolve({ data: [remessaValidaMock], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const parseResultMock: any = {
      metadados: { sequencialArquivo: 4 },
      estrutura: {
        headerArquivo: { banco: '341', agencia: '1234', conta: '12345', convenio: '' },
      },
      resumo: { valorTotalPago: 70 },
    };

    const remessa = await CnabRetornoService.localizarRemessaRelacionada(parseResultMock);
    expect(remessa).not.toBeNull();
    expect(remessa?.id).toBe('79aae5f6-6031-47fe-94cd-7bebe8fd5984');
    expect(remessa?.sequencial_arquivo).toBe(4);
  });

  // B. Itaú 341 + NSA inexistente → aborta ANTES da RPC; zero escrita; mensagem funcional clara
  it('B. Itaú 341 + NSA inexistente (5) -> deve abortar ANTES da RPC com mensagem funcional clara e zero escrita', async () => {
    const { supabase } = await import('@/lib/supabase');

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
            eq: vi.fn().mockResolvedValue({ data: [], error: null }), // Nenhum encontrado para NSA 5
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    // Alterando o NSA de 000004 para 000005 mantendo os 240 caracteres exatos por linha
    const conteudoNsa5 = conteudoValido70.replace('00000408101600', '00000508101600');
    const fileMock = new File([conteudoNsa5], 'RETORNO_NSA_5.RET');

    await expect(
      CnabRetornoService.processarArquivo(fileMock, '341')
    ).rejects.toThrow('Remessa bancária correspondente não encontrada para Banco 341 / NSA 000005. Nenhuma baixa foi realizada.');

    // Garantir que a RPC NUNCA foi chamada
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  // C. empresa_id ausente na remessa relacionada → aborta antes da RPC
  it('C. empresa_id ausente na remessa relacionada -> deve abortar antes da RPC com erro funcional', async () => {
    const { supabase } = await import('@/lib/supabase');

    const remessaSemEmpresa = {
      ...remessaValidaMock,
      empresa_id: null,
      contas_bancarias_empresa: {
        ...remessaValidaMock.contas_bancarias_empresa,
        empresa_id: null,
      },
    };

    // Espionar localizarRemessaRelacionada para simular retorno de remessa com empresa_id ausente
    const spyLocalizar = vi.spyOn(CnabRetornoService, 'localizarRemessaRelacionada').mockResolvedValue(remessaSemEmpresa as any);

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
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const fileMock = new File([conteudoValido70], 'RETORNO_SEM_EMPRESA.RET');

    await expect(
      CnabRetornoService.processarArquivo(fileMock, '341')
    ).rejects.toThrow('Empresa pagadora não identificada na remessa relacionada');

    expect(supabase.rpc).not.toHaveBeenCalled();
    spyLocalizar.mockRestore();
  });

  // D. conta_bancaria_id ausente na remessa relacionada → aborta antes da RPC
  it('D. conta_bancaria_id ausente na remessa relacionada -> deve abortar antes da RPC com erro funcional', async () => {
    const { supabase } = await import('@/lib/supabase');

    const remessaSemConta = {
      ...remessaValidaMock,
      conta_bancaria_id: null,
      contas_bancarias_empresa: {
        ...remessaValidaMock.contas_bancarias_empresa,
        id: null,
      },
    };

    // Espionar localizarRemessaRelacionada para simular retorno de remessa com conta_bancaria_id ausente
    const spyLocalizar = vi.spyOn(CnabRetornoService, 'localizarRemessaRelacionada').mockResolvedValue(remessaSemConta as any);

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
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const fileMock = new File([conteudoValido70], 'RETORNO_SEM_CONTA.RET');

    await expect(
      CnabRetornoService.processarArquivo(fileMock, '341')
    ).rejects.toThrow('Conta bancária pagadora não identificada na remessa relacionada');

    expect(supabase.rpc).not.toHaveBeenCalled();
    spyLocalizar.mockRestore();
  });

  // E. Garantir que supabase.rpc nunca seja chamado com payload incompleto
  it('E. Deve garantir que quando supabase.rpc for chamado, possui todos os 6 parâmetros preenchidos e não undefined', async () => {
    const { supabase } = await import('@/lib/supabase');

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
            eq: vi.fn().mockResolvedValue({ data: [remessaValidaMock], error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'rem-item-mp',
                  remessa_id: remessaValidaMock.id,
                  origem_tipo: 'DIARISTA',
                  origem_id: 'lanc-mp-70',
                  valor: 70,
                },
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
                {
                  id: 'lanc-mp-70',
                  diarista_id: 'colab-1',
                  nome_colaborador: 'DIARISTA 1',
                  cpf_colaborador: '45678912355',
                  valor_calculado: 70,
                  lote_fechamento_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
                },
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
              data: [{ id: 'colab-1', nome: 'DIARISTA 1', cpf: '45678912355' }],
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
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    (supabase.rpc as any).mockResolvedValue({
      data: { sucesso: true, retorno_arquivo_id: 'ret-123', baixas_efetuadas: 1 },
      error: null,
    });

    const fileMock = new File([conteudoValido70], 'RETORNO_VALIDO.RET');
    const result = await CnabRetornoService.processarArquivo(fileMock, '341');

    expect(result).toBeDefined();
    expect(supabase.rpc).toHaveBeenCalledWith('rpc_aplicar_cnab_retorno', expect.anything());

    const rpcCall = (supabase.rpc as any).mock.calls.find((c: any[]) => c[0] === 'rpc_aplicar_cnab_retorno');
    expect(rpcCall).toBeDefined();
    const payload = rpcCall[1];

    // Validação estrita do payload (6 parâmetros obrigatórios sem undefined)
    expect(payload.p_empresa_id).toBe('4d4c1328-a8e7-4c5b-875d-924b416fa13a');
    expect(payload.p_conta_bancaria_id).toBe('26f655a9-acd5-4dbc-b0db-a987c29e0686');
    expect(payload.p_banco_codigo).toBe('341');
    expect(payload.p_nome_arquivo).toBe('RETORNO_VALIDO.RET');
    expect(typeof payload.p_hash_arquivo).toBe('string');
    expect(Array.isArray(payload.p_itens)).toBe(true);

    // Nenhuma chave pode ser undefined
    Object.entries(payload).forEach(([key, val]) => {
      expect(val, `Chave ${key} não pode ser undefined`).not.toBeUndefined();
    });
  });

  // F, G, H: Retorno complementar corrigido (NSA 4, R$70, DIARISTA 1, matching exclusivo MP R$70)
  it('F, G, H. Retorno complementar R$70 (NSA 4) -> parse e matching offline exclusivo no item MP (R$70) sem re-conciliar P (R$140)', async () => {
    // F. Parser offline Itaú
    const reader = CNABRetornoReaderFactory.getReader(conteudoValido70, '341');
    const parseResult = await reader.parse(conteudoValido70, {
      banco: '341',
      fileName: 'RETORNO_ITAU_HOMOLOGACAO_COMPLEMENTAR_70.RET',
      uploadedAt: new Date().toISOString(),
    });

    expect(parseResult.estrutura.headerArquivo.banco).toBe('341');
    expect(parseResult.metadados.sequencialArquivo).toBe(4);
    expect(parseResult.detalhes.length).toBe(1);

    const detalhe = parseResult.detalhes[0];
    expect(detalhe.valorPago).toBe(70);
    expect(detalhe.nomeFavorecido).toBe('DIARISTA 1');
    expect(detalhe.documentoFavorecido).toBe('45678912355');
    expect(detalhe.codigoOcorrencia).toBe('00'); // Pago

    // G & H: Matching offline com faturas da remessa (onde P de R$140 já foi pago e MP de R$70 está aberto)
    const faturasRemessaMock = [
      {
        id: '053c94db-932b-4e09-9714-7727ff52e532',
        remessa_item_id: '6dd89aea-3ebf-44ba-ae93-f6591e9819ff',
        lote_remessa_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        colaborador_id: '93049551-93c8-4381-a415-e3f95523f744',
        valor: 140, // Item P (já conciliado anteriormente)
        valor_consolidado: 210,
        seu_numero_esperado: 'DIA1BF3F73C93049551',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: '93049551-93c8-4381-a415-e3f95523f744', nome: 'DIARISTA 1', cpf: '45678912355' },
      },
      {
        id: 'a1a0b0b5-4162-43c3-b188-d78f24c76838',
        remessa_item_id: 'fabc013e-f070-48c9-8d04-4a3ec255dfb8',
        lote_remessa_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        colaborador_id: '93049551-93c8-4381-a415-e3f95523f744',
        valor: 70, // Item MP (pendente de liquidação)
        valor_consolidado: 210,
        seu_numero_esperado: 'DIA1BF3F73C93049551',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: '93049551-93c8-4381-a415-e3f95523f744', nome: 'DIARISTA 1', cpf: '45678912355' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(detalhe, faturasRemessaMock);

    // G. Deve casar exclusivamente com MP (R$ 70,00)
    expect(match.faturas.length).toBe(1);
    expect(match.fatura?.id).toBe('a1a0b0b5-4162-43c3-b188-d78f24c76838');
    expect(match.fatura?.valor).toBe(70);
    expect(match.isConsolidado).toBe(false);

    // H. P (R$ 140,00) não deve estar no match
    const casouP = match.faturas.some((f) => f.id === '053c94db-932b-4e09-9714-7727ff52e532');
    expect(casouP).toBe(false);
  });
});
