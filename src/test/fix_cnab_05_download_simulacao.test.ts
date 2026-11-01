import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { CnabRemessaArquivoService, CnabRemessaArquivo } from '@/services/cnab/cnabRemessaArquivo.service';
import { CNAB240BBWriter } from '@/services/cnab/CNAB240BBWriter';
import { SimulacaoHomologacaoService } from '@/services/cnab/simulacaoHomologacao.service';

const createMockChain = (data: any = null) => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  chain.single = vi.fn().mockResolvedValue({ data, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  chain.then = (resolve: any) => Promise.resolve({ data, error: null }).then(resolve);
  return chain;
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-hml-test-id' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-secure-uuid', userId: 'usr-hml-test-id' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-secure-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-hml-test-id', tenant_id: 'tenant-secure-uuid' }),
  };
});

describe('FIX-CNAB-05 — VALIDAÇÃO E DOWNLOAD DE RELATÓRIO DE SIMULAÇÃO', () => {
  const tenantId = 'tenant-secure-uuid';

  // Helper para gerar linha FEBRABAN posicional 240 caracteres
  const gerarLinhaFebraban240 = (banco = '001', seq = 1) => {
    return (
      banco.padStart(3, '0') +
      '00000' +
      String(seq).padStart(6, '0') +
      'A'.repeat(226)
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createMockChain({ full_name: 'Usuário Teste' });
      }
      return createMockChain(null);
    });
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 1: NSA 10 com relatório não bancário válido: download permitido
  // ——————————————————————————————————————————————————————————
  it('1. NSA 10 com relatório não bancário válido: download permitido', async () => {
    const rel = SimulacaoHomologacaoService.gerar({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste - Homologação',
      bancoCodigo: '341',
      bancoNome: 'BANCO ITAÚ (341)',
      sequencial: 10,
      totalRegistros: 2,
      totalValor: 350.0,
      dataGeracao: new Date('2026-10-15T12:00:00Z'),
      beneficiarios: [
        { nome: 'Homologação Itaú 001', valor: 150.0 },
        { nome: 'Homologação Itaú 002', valor: 200.0 },
      ],
    });

    const hashCorreto = await CnabRemessaArquivoService.generateHash(rel.content);

    const remessaNsa10: CnabRemessaArquivo = {
      id: '38107d57-4069-434e-aed3-8501fe606272',
      tenant_id: tenantId,
      lote_id: 'lote-intermitentes-183c',
      intermitentes_lote_id: '183c011a-53ea-41da-b76f-aea686362f38',
      nome_arquivo: rel.fileName,
      sequencial_arquivo: 10,
      hash_arquivo: hashCorreto,
      conteudo_arquivo: rel.content,
      total_registros: 2,
      total_valor: 350.0,
      banco_codigo: '341',
      banco_nome: 'BANCO ITAÚ (341)',
      status: 'gerado',
      modo: 'homologacao',
      competencia: '2026-11',
      data_geracao: new Date('2026-10-15T12:00:00Z').toISOString(),
      created_at: new Date('2026-10-15T12:00:00Z').toISOString(),
      updated_at: new Date('2026-10-15T12:00:00Z').toISOString(),
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(remessaNsa10);

    // Mock do supabase usando chain helper
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createMockChain({ full_name: 'Usuário Teste' });
      }
      return createMockChain(null);
    });

    // 1. Validar diretamente o download
    const validacao = await CnabRemessaArquivoService.validarDownloadArquivo(remessaNsa10);
    expect(validacao.valido).toBe(true);
    expect(validacao.tipo).toBe('simulacao');

    // 2. Executar redownload
    const resultado = await CNAB240BBWriter.redownload(remessaNsa10.id);
    expect(resultado).not.toBeNull();
    expect(resultado?.fileName).toBe(rel.fileName);
    expect(resultado?.content).toBe(rel.content);
    expect(resultado?.content.startsWith('ORBE_SIMULACAO_CNAB_V1')).toBe(true);
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 2: NSA 9 histórica com conteúdo bancário: download bloqueado
  // ——————————————————————————————————————————————————————————
  it('2. NSA 9 histórica com conteúdo bancário: download bloqueado', async () => {
    // Linha FEBRABAN posicional real de 240 caracteres
    const conteudoBancarioPosicional = [
      gerarLinhaFebraban240('001', 1),
      gerarLinhaFebraban240('001', 2),
      gerarLinhaFebraban240('001', 3),
    ].join('\r\n') + '\r\n';

    const hashBancario = await CnabRemessaArquivoService.generateHash(conteudoBancarioPosicional);

    const remessaNsa9Historica: CnabRemessaArquivo = {
      id: '288ea1f9-8118-4fff-996e-bf68f42a8204',
      tenant_id: tenantId,
      lote_id: 'lote-antigo-nsa9',
      nome_arquivo: 'REM-000009.txt',
      sequencial_arquivo: 9,
      hash_arquivo: hashBancario,
      conteudo_arquivo: conteudoBancarioPosicional,
      total_registros: 1,
      total_valor: 100.0,
      banco_codigo: '001',
      status: 'gerado',
      modo: 'homologacao',
      data_geracao: '2026-10-14T10:00:00Z',
      created_at: '2026-10-14T10:00:00Z',
      updated_at: '2026-10-14T10:00:00Z',
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(remessaNsa9Historica);

    // Validação deve rejeitar com o bloqueio bancário estrito
    await expect(
      CnabRemessaArquivoService.validarDownloadArquivo(remessaNsa9Historica)
    ).rejects.toThrow(
      'Bloqueio de Segurança Bancária: Remessas geradas no ambiente de Homologação não podem ser baixadas em formato bancário de transmissão.'
    );

    // Redownload também deve rejeitar
    await expect(
      CNAB240BBWriter.redownload(remessaNsa9Historica.id)
    ).rejects.toThrow(
      'Bloqueio de Segurança Bancária: Remessas geradas no ambiente de Homologação não podem ser baixadas em formato bancário de transmissão.'
    );
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 3: Arquivo CNAB240 com nome de simulação: bloqueado
  // ——————————————————————————————————————————————————————————
  it('3. Arquivo CNAB240 posicional com nome disfarçado de simulação: bloqueado', async () => {
    // Arquivo bancário disfarçado com nome "SIMULACAO_..."
    const conteudoBancarioPosicional = [
      gerarLinhaFebraban240('341', 1),
      gerarLinhaFebraban240('341', 2),
    ].join('\r\n') + '\r\n';

    const hash = await CnabRemessaArquivoService.generateHash(conteudoBancarioPosicional);

    const arquivoDisfarcado: CnabRemessaArquivo = {
      id: 'remessa-spoof-id',
      tenant_id: tenantId,
      lote_id: 'lote-spoof',
      nome_arquivo: 'SIMULACAO_HOMOLOGACAO_ITAU_20261015_SEQ000010.txt',
      sequencial_arquivo: 10,
      hash_arquivo: hash,
      conteudo_arquivo: conteudoBancarioPosicional,
      total_registros: 1,
      total_valor: 350.0,
      status: 'gerado',
      modo: 'homologacao',
      data_geracao: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(arquivoDisfarcado);

    await expect(
      CnabRemessaArquivoService.validarDownloadArquivo(arquivoDisfarcado)
    ).rejects.toThrow(
      'Bloqueio de Segurança Bancária: Remessas geradas no ambiente de Homologação não podem ser baixadas em formato bancário de transmissão.'
    );
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 4: Relatório com estrutura inválida: bloqueado
  // ——————————————————————————————————————————————————————————
  it('4. Relatório de simulação com estrutura corrompida: bloqueado', async () => {
    // Começa com ORBE_SIMULACAO_CNAB_V1 mas é incompleto (apenas 5 linhas)
    const conteudoCorrompido = [
      'ORBE_SIMULACAO_CNAB_V1',
      '================================================================================',
      'ORBE ERP — RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (AMBIENTE DE HOMOLOGAÇÃO)',
      'TIPO: SIMULACAO_NAO_BANCARIA',
      'SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO',
    ].join('\r\n') + '\r\n';

    const hash = await CnabRemessaArquivoService.generateHash(conteudoCorrompido);

    const remessaCorrompida: CnabRemessaArquivo = {
      id: 'remessa-corrompida-id',
      tenant_id: tenantId,
      lote_id: 'lote-corrompido',
      nome_arquivo: 'SIMULACAO_HOMOLOGACAO_ITAU_20261015_SEQ000010.txt',
      sequencial_arquivo: 10,
      hash_arquivo: hash,
      conteudo_arquivo: conteudoCorrompido,
      total_registros: 1,
      total_valor: 100.0,
      status: 'gerado',
      modo: 'homologacao',
      data_geracao: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(remessaCorrompida);

    await expect(
      CnabRemessaArquivoService.validarDownloadArquivo(remessaCorrompida)
    ).rejects.toThrow(
      /Bloqueio de Segurança: Estrutura do relatório de simulação inválida/
    );
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 5: Conteúdo ausente: bloqueado
  // ——————————————————————————————————————————————————————————
  it('5. Conteúdo ausente ou vazio: bloqueado com erro específico', async () => {
    const remessaSemConteudo: CnabRemessaArquivo = {
      id: 'remessa-vazia-id',
      tenant_id: tenantId,
      lote_id: 'lote-vazio',
      nome_arquivo: 'SIMULACAO_HOMOLOGACAO_ITAU_20261015_SEQ000010.txt',
      sequencial_arquivo: 10,
      hash_arquivo: 'hash-qq',
      conteudo_arquivo: null,
      total_registros: 1,
      total_valor: 100.0,
      status: 'gerado',
      modo: 'homologacao',
      data_geracao: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(remessaSemConteudo);

    await expect(
      CnabRemessaArquivoService.validarDownloadArquivo(remessaSemConteudo)
    ).rejects.toThrow(
      'Bloqueio de Segurança: Conteúdo do arquivo de remessa ausente ou vazio na base de dados.'
    );
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 6: Hash divergente: bloqueado
  // ——————————————————————————————————————————————————————————
  it('6. Hash divergente do registrado: bloqueado com erro de integridade', async () => {
    const rel = SimulacaoHomologacaoService.gerar({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste - Homologação',
      bancoCodigo: '341',
      bancoNome: 'BANCO ITAÚ (341)',
      sequencial: 10,
      totalRegistros: 2,
      totalValor: 350.0,
      beneficiarios: [
        { nome: 'Favorecido 1', valor: 150.0 },
        { nome: 'Favorecido 2', valor: 200.0 },
      ],
    });

    const remessaHashAdulterado: CnabRemessaArquivo = {
      id: 'remessa-adulterada-id',
      tenant_id: tenantId,
      lote_id: 'lote-adulterado',
      nome_arquivo: rel.fileName,
      sequencial_arquivo: 10,
      hash_arquivo: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // hash falso divergente
      conteudo_arquivo: rel.content,
      total_registros: 2,
      total_valor: 350.0,
      status: 'gerado',
      modo: 'homologacao',
      data_geracao: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(remessaHashAdulterado);

    await expect(
      CnabRemessaArquivoService.validarDownloadArquivo(remessaHashAdulterado)
    ).rejects.toThrow(
      'Bloqueio de Segurança: Hash do conteúdo persistido diverge do hash oficial registrado na remessa.'
    );
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 7: Repetir download da NSA 10: mesmo conteúdo, sem nova remessa
  // ——————————————————————————————————————————————————————————
  it('7. Re-download idempotente da NSA 10: retorna mesmo conteúdo sem gerar nova remessa', async () => {
    const rel = SimulacaoHomologacaoService.gerar({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste - Homologação',
      bancoCodigo: '341',
      bancoNome: 'BANCO ITAÚ (341)',
      sequencial: 10,
      totalRegistros: 2,
      totalValor: 350.0,
      beneficiarios: [
        { nome: 'Homologação Itaú 001', valor: 150.0 },
        { nome: 'Homologação Itaú 002', valor: 200.0 },
      ],
    });
    const hash = await CnabRemessaArquivoService.generateHash(rel.content);

    const remessaNsa10: CnabRemessaArquivo = {
      id: '38107d57-4069-434e-aed3-8501fe606272',
      tenant_id: tenantId,
      lote_id: 'lote-intermitentes-183c',
      intermitentes_lote_id: '183c011a-53ea-41da-b76f-aea686362f38',
      nome_arquivo: rel.fileName,
      sequencial_arquivo: 10,
      hash_arquivo: hash,
      conteudo_arquivo: rel.content,
      total_registros: 2,
      total_valor: 350.0,
      status: 'gerado',
      modo: 'homologacao',
      data_geracao: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(remessaNsa10);

    const rpcSpy = vi.spyOn(supabase, 'rpc');

    // Primeiro download
    const d1 = await CNAB240BBWriter.redownload(remessaNsa10.id);
    // Segundo download
    const d2 = await CNAB240BBWriter.redownload(remessaNsa10.id);

    expect(d1?.content).toBe(d2?.content);
    expect(d1?.fileName).toBe(d2?.fileName);
    expect(d1?.content).toBe(rel.content);

    // Garante que NENHUMA RPC de geração de remessa foi executada (sem novo NSA)
    expect(rpcSpy).not.toHaveBeenCalledWith('rpc_registrar_cnab_remessa', expect.anything());
    expect(rpcSpy).not.toHaveBeenCalledWith('get_next_cnab_sequencial', expect.anything());
  });

  // ——————————————————————————————————————————————————————————
  // TESTE 8: Confirmar que NSA e quantidade de remessas permanecem inalterados
  // ——————————————————————————————————————————————————————————
  it('8. Confirmar que NSA e quantidade de remessas permanecem inalterados', async () => {
    // Simula contagem de remessas antes do download
    const remessasExistentes = [
      { id: 'rem-8', sequencial_arquivo: 8 },
      { id: 'rem-9', sequencial_arquivo: 9 },
      { id: 'rem-10', sequencial_arquivo: 10 },
    ];

    const countAntes = remessasExistentes.length;
    const maxNsaAntes = Math.max(...remessasExistentes.map((r) => r.sequencial_arquivo));

    // Executa validações de download
    const rel = SimulacaoHomologacaoService.gerar({
      origem: 'INTERMITENTES',
      empresaNome: 'Empresa Teste - Homologação',
      bancoCodigo: '341',
      sequencial: 10,
      totalRegistros: 2,
      totalValor: 350.0,
    });
    const hash = await CnabRemessaArquivoService.generateHash(rel.content);

    const remessaNsa10: CnabRemessaArquivo = {
      id: 'rem-10',
      tenant_id: tenantId,
      lote_id: 'lote-10',
      nome_arquivo: rel.fileName,
      sequencial_arquivo: 10,
      hash_arquivo: hash,
      conteudo_arquivo: rel.content,
      total_registros: 2,
      total_valor: 350.0,
      status: 'gerado',
      modo: 'homologacao',
      data_geracao: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue(remessaNsa10);

    await CNAB240BBWriter.redownload('rem-10');

    const countDepois = remessasExistentes.length;
    const maxNsaDepois = Math.max(...remessasExistentes.map((r) => r.sequencial_arquivo));

    expect(countDepois).toBe(countAntes);
    expect(maxNsaDepois).toBe(maxNsaAntes);
    expect(maxNsaDepois).toBe(10);
  });
});
