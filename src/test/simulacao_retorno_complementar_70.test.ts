import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CNABRetornoReaderFactory } from '@/services/cnab/CNABRetornoReaderFactory';
import { CNAB240ItauReader } from '@/services/cnab/CNAB240ItauReader';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';
import { mapearOcorrenciaItau } from '@/services/cnab/retorno/ocorrenciasItau';

describe('SIMULAÇÃO READ-ONLY DO RETORNO COMPLEMENTAR R$ 70,00', () => {
  const filePath = 'y:\\2026\\ERP ESC LOG\\Orbe\\RETORNO_ITAU_HOMOLOGACAO_COMPLEMENTAR_70.RET';
  const content = fs.readFileSync(filePath, 'utf8');

  it('1. Arquivo deve ser lido e reconhecido pelo Reader Itaú com valor R$ 70', async () => {
    const reader = CNABRetornoReaderFactory.getReader(content, '341');
    expect(reader).toBeInstanceOf(CNAB240ItauReader);

    const parseResult = await reader.parse(content, {
      banco: '341',
      fileName: 'RETORNO_ITAU_HOMOLOGACAO_COMPLEMENTAR_70.RET',
      uploadedAt: new Date().toISOString(),
    });

    expect(parseResult.estrutura.headerArquivo.banco).toBe('341');
    expect(parseResult.metadados.sequencialArquivo).toBe(4);
    expect(parseResult.detalhes.length).toBe(1);
    expect(parseResult.resumo.valorTotalPago).toBe(70);

    const detalhe = parseResult.detalhes[0];
    expect(detalhe.valorPago).toBe(70);
    expect(detalhe.nomeFavorecido).toBe('DIARISTA 1');
    expect(detalhe.documentoFavorecido).toBe('45678912355');
    expect(detalhe.codigoOcorrencia).toBe('00');

    const ocorrencia = mapearOcorrenciaItau(detalhe.codigoOcorrencia);
    expect(ocorrencia.statusBase).toBe('pago');
  });

  it('2. Matching deve associar estritamente o item MP (R$ 70) e NÃO o item P (R$ 140)', () => {
    // Faturas reais da remessa CB341 (79aae5f6)
    const faturasRelacionadas = [
      {
        id: '053c94db-932b-4e09-9714-7727ff52e532', // Lançamento P
        remessa_item_id: '6dd89aea-3ebf-44ba-ae93-f6591e9819ff',
        lote_remessa_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        colaborador_id: '93049551-93c8-4381-a415-e3f95523f744',
        valor: 140,
        valor_consolidado: 210,
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: '93049551-93c8-4381-a415-e3f95523f744', nome: 'DIARISTA 1', cpf: '45678912355' },
      },
      {
        id: 'a1a0b0b5-4162-43c3-b188-d78f24c76838', // Lançamento MP
        remessa_item_id: 'fabc013e-f070-48c9-8d04-4a3ec255dfb8',
        lote_remessa_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        colaborador_id: '93049551-93c8-4381-a415-e3f95523f744',
        valor: 70,
        valor_consolidado: 210,
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: '93049551-93c8-4381-a415-e3f95523f744', nome: 'DIARISTA 1', cpf: '45678912355' },
      },
    ];

    const detalheRetorno = {
      banco: '341',
      valorPago: 70,
      documentoFavorecido: '45678912355',
      nomeFavorecido: 'DIARISTA 1',
      codigoOcorrencia: '00',
      linhaOriginal: '',
    };

    const match = CnabRetornoService.matchDetalhe(detalheRetorno as any, faturasRelacionadas);

    // Assertivas de matching seletivo
    expect(match.faturas.length).toBe(1);
    expect(match.isConsolidado).toBe(false);

    const itemCasado = match.faturas[0];
    expect(itemCasado.id).toBe('a1a0b0b5-4162-43c3-b188-d78f24c76838'); // Lançamento MP
    expect(itemCasado.remessa_item_id).toBe('fabc013e-f070-48c9-8d04-4a3ec255dfb8'); // Remessa item MP
    expect(itemCasado.valor).toBe(70);

    // Garantia absoluta de que o lançamento P (R$ 140) NÃO é associado
    const itemPNaoCasado = match.faturas.find((f) => f.id === '053c94db-932b-4e09-9714-7727ff52e532');
    expect(itemPNaoCasado).toBeUndefined();
  });

  it('3. Simulação de Baixa Contábil e Quitação do Lote', () => {
    // Simulação dos dois lançamentos após processamento do complemento:
    const lancamentosAposComplemento = [
      { id: '053c94db', tipo: 'P', valor: 140, status: 'PAGO' }, // Já estava PAGO
      { id: 'a1a0b0b5', tipo: 'MP', valor: 70, status: 'PAGO' },  // Liquidado pelo complemento
    ];

    const remessaItensAposComplemento = [
      { id: '6dd89aea', origem_id: '053c94db', status: 'conciliado' }, // Já estava conciliado
      { id: 'fabc013e', origem_id: 'a1a0b0b5', status: 'conciliado' }, // Conciliado pelo complemento
    ];

    const todosLancamentosPagos = lancamentosAposComplemento.every((l) => l.status === 'PAGO');
    const todosRemessaItensConciliados = remessaItensAposComplemento.every((r) => r.status === 'conciliado');

    expect(todosLancamentosPagos).toBe(true);
    expect(todosRemessaItensConciliados).toBe(true);

    // Somente com ambos TRUE o lote fecha como PAGO
    const loteFinalStatus = todosLancamentosPagos && todosRemessaItensConciliados ? 'PAGO' : 'cnab_gerado';
    const loteFinalConciliacao = todosLancamentosPagos && todosRemessaItensConciliados ? 'conciliado' : 'conciliacao_parcial';

    expect(loteFinalStatus).toBe('PAGO');
    expect(loteFinalConciliacao).toBe('conciliado');
  });
});
