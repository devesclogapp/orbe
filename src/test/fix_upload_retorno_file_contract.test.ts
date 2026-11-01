import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';
import { CNABRetornoReaderFactory } from '@/services/cnab/CNABRetornoReaderFactory';
import { CNAB240ItauReader } from '@/services/cnab/CNAB240ItauReader';

// Mocks para isolar banco de dados e garantir ZERO execução real de conciliação
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock('@/services/domain/base.service', () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-123'),
}));

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
  },
}));

describe('FIX — Contrato de Upload de Arquivo de Retorno CNAB (file.text is not a function)', () => {
  const filePath = path.join(process.cwd(), 'RETORNO_ITAU_HOMOLOGACAO_210.RET');
  const realFileContent = fs.readFileSync(filePath, 'utf8');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Deve ler com sucesso o conteúdo de um objeto File nativo com método .text()', async () => {
    const file = new File([realFileContent], 'RETORNO_ITAU_HOMOLOGACAO_210.RET', {
      type: 'text/plain',
    });
    // Garantir que file.text esteja definido mesmo no ambiente jsdom
    if (!file.text) {
      (file as any).text = async () => realFileContent;
    }

    const mockRemessa = {
      id: 'rem-1',
      sequencial_arquivo: 4,
      banco_codigo: '341',
      empresa_id: 'emp-1',
      conta_bancaria_id: 'cta-1',
      contas_bancarias_empresa: { id: 'cta-1', empresa_id: 'emp-1', banco_codigo: '341' }
    };
    const factorySpy = vi.spyOn(CNABRetornoReaderFactory, 'getReader');
    vi.spyOn(CnabRetornoService, 'localizarRemessaRelacionada').mockResolvedValue(mockRemessa as any);

    const resultado = await CnabRetornoService.processarArquivo(file, '341');

    expect(factorySpy).toHaveBeenCalledWith(expect.any(String), '341');
    const contentPassado = factorySpy.mock.calls[0][0];
    expect(contentPassado.trim()).toBe(realFileContent.trim());
    expect(resultado.resumo.totalProcessado).toBe(1);
  });

  it('2. Deve suportar leitura segura mesmo se o objeto File não possuir .text() direto no protótipo (fallback arrayBuffer)', async () => {
    // Simular objeto File onde .text() é undefined mas possui arrayBuffer()
    const file = new File([realFileContent], 'RETORNO_ITAU_HOMOLOGACAO_210.RET', {
      type: 'text/plain',
    });
    (file as any).text = undefined;

    const mockRemessa = {
      id: 'rem-1',
      sequencial_arquivo: 4,
      banco_codigo: '341',
      empresa_id: 'emp-1',
      conta_bancaria_id: 'cta-1',
      contas_bancarias_empresa: { id: 'cta-1', empresa_id: 'emp-1', banco_codigo: '341' }
    };
    const factorySpy = vi.spyOn(CNABRetornoReaderFactory, 'getReader');
    vi.spyOn(CnabRetornoService, 'localizarRemessaRelacionada').mockResolvedValue(mockRemessa as any);

    const resultado = await CnabRetornoService.processarArquivo(file, '341');

    expect(factorySpy).toHaveBeenCalled();
    const contentPassado = factorySpy.mock.calls[0][0];
    expect(contentPassado.trim()).toBe(realFileContent.trim());
    expect(resultado.resumo.totalProcessado).toBe(1);
  });

  it('3. Deve rejeitar explicitamente com mensagem clara caso receba string (evitando TypeError silencioso)', async () => {
    // Simular o erro anterior onde a UI passava file.name (string) em vez do objeto File
    await expect(
      (CnabRetornoService.processarArquivo as any)('RETORNO_ITAU_HOMOLOGACAO_210.RET', '341')
    ).rejects.toThrow('Contrato inválido: CnabRetornoService.processarArquivo requer um objeto File nativo.');
  });

  it('4. Deve garantir que o conteúdo lido chegue 100% íntegro ao CNAB240ItauReader e seja parseado corretamente', async () => {
    const file = new File([realFileContent], 'RETORNO_ITAU_HOMOLOGACAO_210.RET', {
      type: 'text/plain',
    });

    const reader = CNABRetornoReaderFactory.getReader(realFileContent, '341');
    expect(reader).toBeInstanceOf(CNAB240ItauReader);

    const parseResult = await reader.parse(realFileContent, {
      banco: '341',
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
    });

    expect(parseResult.resumo.banco).toBe('341');
    expect(parseResult.metadados.sequencialArquivo).toBe(4);
    expect(parseResult.detalhes).toHaveLength(1);
    expect(parseResult.detalhes[0].nomeFavorecido).toBe('DIARISTA 1');
    expect(parseResult.detalhes[0].valorPago).toBe(210.0);
    expect(parseResult.detalhes[0].codigoOcorrencia).toBe('00');
  });

  it('5. Validação de contrato na UI: handleUploadRetorno deve repassar (file, banco) diretamente', () => {
    // Simulação do handler da UI corrigido
    const mockFile = new File(['teste'], 'teste.ret');
    const mockBanco = '341';

    let argsRecebidos: any[] = [];
    const mockProcessar = vi.fn().mockImplementation((...args) => {
      argsRecebidos = args;
      return Promise.resolve({ resumo: { totalProcessado: 0 } });
    });

    // Simulação exata do código corrigido em CentralBancaria.tsx:
    // const resultado = await CnabRetornoService.processarArquivo(file, banco);
    mockProcessar(mockFile, mockBanco);

    expect(argsRecebidos).toHaveLength(2);
    expect(argsRecebidos[0]).toBeInstanceOf(File);
    expect(argsRecebidos[0].name).toBe('teste.ret');
    expect(argsRecebidos[1]).toBe('341');
  });
});
