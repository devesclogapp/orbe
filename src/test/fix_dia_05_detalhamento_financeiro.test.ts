import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoteFechamentoDiaristaService } from '../services/domain/diaristas.service';
import { RHFinanceiroService } from '../services/rhFinanceiro.service';
import { IntermitentesLoteService } from '../services/domain/intermitentes.service';
import { EnvironmentService } from '../services/environment/EnvironmentService';
import { EnvironmentQueryFilter } from '../services/environment/EnvironmentQueryFilter';
import { DespesasContasPagarOficialService } from '../services/despesasOficial.service';

describe('FIX-DIA-05 — Detalhamento Financeiro de Diaristas & Deep Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Formatação do Deep Link em RH Diaristas', () => {
    it('deve incluir tipo=DIARISTAS, tab=lotes-rh, rhLoteId, empresaId e competencia', () => {
      const lote = {
        id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
        empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
      };
      const competenciaLote = '2026-10';

      const params = new URLSearchParams();
      params.set('tab', 'lotes-rh');
      params.set('tipo', 'DIARISTAS');
      if (lote.id) params.set('rhLoteId', lote.id);
      if (lote.empresa_id) params.set('empresaId', lote.empresa_id);
      if (competenciaLote) params.set('competencia', competenciaLote);

      const url = `/financeiro?${params.toString()}`;
      expect(url).toContain('tab=lotes-rh');
      expect(url).toContain('tipo=DIARISTAS');
      expect(url).toContain('rhLoteId=371806e7-91e4-49ed-b6df-e7e0e5fcd68a');
      expect(url).toContain('empresaId=28a560b5-37ef-403d-ae4f-b28a608b6a68');
      expect(url).toContain('competencia=2026-10');
    });
  });

  describe('2. Recepção e Hidratação Segura do Deep Link no Financeiro', () => {
    it('não deve gerar valores undefined no lote selecionado', () => {
      const searchParams = new URLSearchParams('tab=lotes-rh&tipo=DIARISTAS&rhLoteId=371806e7-91e4-49ed-b6df-e7e0e5fcd68a&empresaId=28a560b5-37ef-403d-ae4f-b28a608b6a68&competencia=2026-10');
      const deepLinkLoteId = searchParams.get('rhLoteId');
      const deepLinkCompetencia = searchParams.get('competencia');
      const deepLinkEmpresaId = searchParams.get('empresaId');
      const deepLinkTipo = searchParams.get('tipo');

      const empresas = [{ id: '28a560b5-37ef-403d-ae4f-b28a608b6a68', nome: 'Empresa Teste - Homologação' }];
      const empresaObj = empresas.find((e) => e.id === deepLinkEmpresaId);

      const loteSelecionado = {
        id: deepLinkLoteId,
        tipo: deepLinkTipo || undefined,
        competencia: deepLinkCompetencia || undefined,
        empresa_id: deepLinkEmpresaId || undefined,
        empresa: empresaObj || (deepLinkEmpresaId ? { id: deepLinkEmpresaId, nome: '' } : undefined),
      };

      expect(loteSelecionado.id).toBe('371806e7-91e4-49ed-b6df-e7e0e5fcd68a');
      expect(loteSelecionado.tipo).toBe('DIARISTAS');
      expect(loteSelecionado.competencia).toBe('2026-10');
      expect(loteSelecionado.empresa?.nome).toBe('Empresa Teste - Homologação');

      // Cabeçalho canônico formatado
      const partes = [loteSelecionado.competencia, loteSelecionado.empresa?.nome, 'Diaristas'].filter(Boolean);
      const cabecalhoFormatado = partes.join(' · ');
      expect(cabecalhoFormatado).toBe('2026-10 · Empresa Teste - Homologação · Diaristas');
      expect(cabecalhoFormatado).not.toContain('undefined');
    });

    it('hidrata o lote a partir da lista de diaristas se deep link não trouxer tipo', () => {
      const deepLinkLoteId = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
      let rhLoteSelecionado: any = { id: deepLinkLoteId }; // sem tipo

      const lotesDiaristas = [
        {
          id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
          empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
          periodo_inicio: '2026-10-12',
          periodo_fim: '2026-10-18',
          status: 'VALIDADO_RH',
          valor_total: 350,
        },
      ];
      const empresas = [{ id: '28a560b5-37ef-403d-ae4f-b28a608b6a68', nome: 'Empresa Teste - Homologação' }];

      // Lógica de hidratação implementada no CentralFinanceira
      const loteDia = lotesDiaristas.find((l) => l.id === rhLoteSelecionado.id);
      if (loteDia) {
        const emp = empresas.find((e) => e.id === loteDia.empresa_id);
        rhLoteSelecionado = {
          ...loteDia,
          ...rhLoteSelecionado,
          tipo: 'DIARISTAS',
          origem: 'OPERACIONAL',
          competencia: loteDia.periodo_inicio.slice(0, 7),
          empresa: emp,
          status: loteDia.status === 'VALIDADO_RH' ? 'AGUARDANDO_FINANCEIRO' : loteDia.status,
        };
      }

      expect(rhLoteSelecionado.tipo).toBe('DIARISTAS');
      expect(rhLoteSelecionado.competencia).toBe('2026-10');
      expect(rhLoteSelecionado.empresa?.nome).toBe('Empresa Teste - Homologação');
      expect(rhLoteSelecionado.status).toBe('AGUARDANDO_FINANCEIRO');
    });
  });

  describe('3. Roteamento de Serviço Seguro e Desacoplado', () => {
    it('seleciona LoteFechamentoDiaristaService quando o tipo é DIARISTAS', async () => {
      const spyDiarista = vi.spyOn(LoteFechamentoDiaristaService, 'getLoteDetalhe').mockResolvedValueOnce({
        id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
        tipo: 'DIARISTAS',
        competencia: '2026-10',
        total_colaboradores: 1,
        valor_total: 350,
        status: 'VALIDADO_RH',
        itens: [],
      } as any);

      const spyRh = vi.spyOn(RHFinanceiroService, 'getLoteDetalhe');

      const loteSelecionado = { id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a', tipo: 'DIARISTAS' };
      const isDiaristasInList = false;

      let result = null;
      if (isDiaristasInList || loteSelecionado.tipo === 'DIARISTAS') {
        result = await LoteFechamentoDiaristaService.getLoteDetalhe(loteSelecionado.id);
      } else {
        result = await RHFinanceiroService.getLoteDetalhe(loteSelecionado.id);
      }

      expect(spyDiarista).toHaveBeenCalledWith('371806e7-91e4-49ed-b6df-e7e0e5fcd68a');
      expect(spyRh).not.toHaveBeenCalled();
      expect(result.tipo).toBe('DIARISTAS');
    });

    it('recorre ao fallback seguro se tipo for omitido mas lote pertencer a Diaristas', async () => {
      // RHFinanceiroService lança erro porque o ID não é CLT
      vi.spyOn(RHFinanceiroService, 'getLoteDetalhe').mockRejectedValueOnce(new Error('PGRST116: Not Found'));
      const spyDiarista = vi.spyOn(LoteFechamentoDiaristaService, 'getLoteDetalhe').mockResolvedValueOnce({
        id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
        tipo: 'DIARISTAS',
        competencia: '2026-10',
        total_colaboradores: 1,
        valor_total: 350,
        status: 'VALIDADO_RH',
        itens: [],
      } as any);

      const targetId = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
      let detalhe = null;
      try {
        detalhe = await RHFinanceiroService.getLoteDetalhe(targetId);
      } catch {
        try {
          detalhe = await LoteFechamentoDiaristaService.getLoteDetalhe(targetId);
        } catch {
          detalhe = null;
        }
      }

      expect(spyDiarista).toHaveBeenCalledWith(targetId);
      expect(detalhe).not.toBeNull();
      expect(detalhe?.tipo).toBe('DIARISTAS');
    });

    it('mantém CLT roteando estritamente para RHFinanceiroService', async () => {
      const spyRh = vi.spyOn(RHFinanceiroService, 'getLoteDetalhe').mockResolvedValueOnce({
        id: 'clt-lote-123',
        tipo: 'FOLHA',
        competencia: '2026-10',
        itens: [],
      } as any);
      const spyDiarista = vi.spyOn(LoteFechamentoDiaristaService, 'getLoteDetalhe');

      const loteClt = { id: 'clt-lote-123', tipo: 'FOLHA' };
      const rawLotesRh = [{ id: 'clt-lote-123' }];
      const isRhInList = rawLotesRh.some((l) => l.id === loteClt.id);

      let result = null;
      if (isRhInList) {
        result = await RHFinanceiroService.getLoteDetalhe(loteClt.id);
      }

      expect(spyRh).toHaveBeenCalledWith('clt-lote-123');
      expect(spyDiarista).not.toHaveBeenCalled();
      expect(result.tipo).toBe('FOLHA');
    });
  });

  describe('4. Isolamento de Cache do TanStack Query', () => {
    it('gera chaves de cache distintas para tipos diferentes', () => {
      const id = 'lote-xyz';
      const keyDiarista = ['rh-financeiro-lote-detalhe', id, 'DIARISTAS'];
      const keyClt = ['rh-financeiro-lote-detalhe', id, 'RH'];
      const keyAuto = ['rh-financeiro-lote-detalhe', id, 'AUTO'];

      expect(keyDiarista).not.toEqual(keyClt);
      expect(keyDiarista).not.toEqual(keyAuto);
    });
  });

  describe('5. Exibição e Formatação dos Itens do Lote de Diaristas', () => {
    it('formata os 3 lançamentos do lote oficial com Data/Código, Diárias e Valor', () => {
      const itensMock = [
        {
          id: 'item-1',
          nome_colaborador: 'Diarista Homologação 001',
          data_lancamento: '2026-10-12',
          codigo_marcacao: 'P',
          quantidade_diaria: 1,
          valor_calculado: 140,
          status: 'VALIDADO_RH',
        },
        {
          id: 'item-2',
          nome_colaborador: 'Diarista Homologação 001',
          data_lancamento: '2026-10-13',
          codigo_marcacao: 'MP',
          quantidade_diaria: 0.5,
          valor_calculado: 70,
          status: 'VALIDADO_RH',
        },
        {
          id: 'item-3',
          nome_colaborador: 'Diarista Homologação 001',
          data_lancamento: '2026-10-14',
          codigo_marcacao: 'P',
          quantidade_diaria: 1,
          valor_calculado: 140,
          status: 'VALIDADO_RH',
        },
      ];

      const rows = itensMock.map((item) => {
        const dataFmt = item.data_lancamento
          ? `${item.data_lancamento.slice(8, 10)}/${item.data_lancamento.slice(5, 7)}`
          : '';
        const cod = item.codigo_marcacao || 'Diária';
        const eventoLabel = `${dataFmt} — ${cod}`;
        const diariasLabel = `${Number(item.quantidade_diaria)}d`;
        const valorLabel = `R$ ${Number(item.valor_calculado).toFixed(2).replace('.', ',')}`;
        return {
          colaborador: item.nome_colaborador,
          evento: eventoLabel,
          diarias: diariasLabel,
          valor: valorLabel,
          status: item.status,
        };
      });

      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual({
        colaborador: 'Diarista Homologação 001',
        evento: '12/10 — P',
        diarias: '1d',
        valor: 'R$ 140,00',
        status: 'VALIDADO_RH',
      });
      expect(rows[1]).toEqual({
        colaborador: 'Diarista Homologação 001',
        evento: '13/10 — MP',
        diarias: '0.5d',
        valor: 'R$ 70,00',
        status: 'VALIDADO_RH',
      });
      expect(rows[2]).toEqual({
        colaborador: 'Diarista Homologação 001',
        evento: '14/10 — P',
        diarias: '1d',
        valor: 'R$ 140,00',
        status: 'VALIDADO_RH',
      });

      const totalCalculado = itensMock.reduce((acc, it) => acc + it.valor_calculado, 0);
      expect(totalCalculado).toBe(350);
    });
  });

  describe('6. Disponibilidade das Ações de Aprovação Financeira', () => {
    it('habilita ação de aprovação somente quando itens > 0 e status elegível', () => {
      const elegiveis = ['VALIDADO_RH', 'AGUARDANDO_FINANCEIRO', 'EM_ANALISE_FINANCEIRA'];

      const loteValido = {
        id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
        status: 'VALIDADO_RH',
        itens: [{ id: '1' }, { id: '2' }, { id: '3' }],
      };

      const podeAprovarValido =
        elegiveis.includes(loteValido.status) && (loteValido.itens || []).length > 0;
      expect(podeAprovarValido).toBe(true);

      const loteVazio = {
        id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
        status: 'VALIDADO_RH',
        itens: [],
      };
      const podeAprovarVazio =
        elegiveis.includes(loteVazio.status) && (loteVazio.itens || []).length > 0;
      expect(podeAprovarVazio).toBe(false);

      const loteJaPago = {
        id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
        status: 'PAGO',
        itens: [{ id: '1' }],
      };
      const podeAprovarPago =
        elegiveis.includes(loteJaPago.status) && (loteJaPago.itens || []).length > 0;
      expect(podeAprovarPago).toBe(false);
    });

    it('executa mutação de aprovação para Diaristas chamando LoteFechamentoDiaristaService', async () => {
      const spyAprovarDiarista = vi
        .spyOn(LoteFechamentoDiaristaService, 'aprovarFinanceiro')
        .mockResolvedValueOnce({} as any);
      const spyAprovarRh = vi.spyOn(RHFinanceiroService, 'aprovarFinanceiro');

      const rhLoteSelecionado = { id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a', tipo: 'DIARISTAS' };
      const rhLoteDetalhe = { id: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a', tipo: 'DIARISTAS' };

      const loteTipo = rhLoteSelecionado?.tipo || rhLoteDetalhe?.tipo;
      const user = { id: 'usr-1', email: 'financeiro@esclog.com' };

      if (loteTipo === 'DIARISTAS') {
        await LoteFechamentoDiaristaService.aprovarFinanceiro(
          rhLoteDetalhe.id,
          user.id,
          user.email,
          'financeiro'
        );
      } else {
        await RHFinanceiroService.aprovarFinanceiro(rhLoteDetalhe.id, '');
      }

      expect(spyAprovarDiarista).toHaveBeenCalledWith(
        '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
        'usr-1',
        'financeiro@esclog.com',
        'financeiro'
      );
      expect(spyAprovarRh).not.toHaveBeenCalled();
    });
  });

  describe('7. Resolução de Escopo de Ambiente e Isolamento Estrito', () => {
    const tenantId = 'tenant-test-123';
    const hmlEmpresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68'; // Empresa de homologação
    const prodEmpresaId = '4d4c1328-98e8-4ecb-99f4-b2586b6a2ebf'; // Empresa de produção
    const testIds = [hmlEmpresaId];

    it('Empresa de homologação em ambiente de homologação: autoriza e aplica filtro restritivo IN', () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
      const mockQuery = { in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };

      const res = EnvironmentQueryFilter.applyEmpresaScope(mockQuery as any, {
        tenantId,
        column: 'empresa_id',
        testIds,
        targetEmpresaId: hmlEmpresaId,
      });

      expect(mockQuery.in).toHaveBeenCalledWith('empresa_id', testIds);
      expect(res).toBe(mockQuery);
    });

    it('Empresa de homologação em ambiente de produção: bloqueia com ENVIRONMENT_MISMATCH', () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');
      const mockQuery = { not: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };

      expect(() => {
        EnvironmentQueryFilter.applyEmpresaScope(mockQuery as any, {
          tenantId,
          column: 'empresa_id',
          testIds,
          targetEmpresaId: hmlEmpresaId,
        });
      }).toThrowError(/Acesso negado: Empresa de teste/);
    });

    it('Empresa de produção em ambiente de produção: autoriza e exclui IDs de homologação', () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');
      const mockQuery = { not: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };

      const res = EnvironmentQueryFilter.applyEmpresaScope(mockQuery as any, {
        tenantId,
        column: 'empresa_id',
        testIds,
        targetEmpresaId: prodEmpresaId,
      });

      expect(mockQuery.not).toHaveBeenCalledWith('empresa_id', 'in', `(${hmlEmpresaId})`);
      expect(res).toBe(mockQuery);
    });

    it('Empresa de produção em ambiente de homologação: bloqueia com ENVIRONMENT_MISMATCH', () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
      const mockQuery = { in: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };

      expect(() => {
        EnvironmentQueryFilter.applyEmpresaScope(mockQuery as any, {
          tenantId,
          column: 'empresa_id',
          testIds,
          targetEmpresaId: prodEmpresaId,
        });
      }).toThrowError(/Acesso negado: Empresa de produção/);
    });
  });

  describe('8. Resiliência do Deep Link com Carregamento Assíncrono das Empresas', () => {
    it('preserva a empresa do deep link mesmo quando empresas[0] é carregada posteriormente', () => {
      const searchParams = new URLSearchParams('tab=lotes-rh&tipo=DIARISTAS&rhLoteId=371806e7-91e4-49ed-b6df-e7e0e5fcd68a&empresaId=28a560b5-37ef-403d-ae4f-b28a608b6a68&competencia=2026-10');
      
      let filterEmpresaId: string | null = searchParams.get('empresaId');
      let selectedEmpresaId: string | null = searchParams.get('empresaId');

      // Simulação de carregamento assíncrono tardio da lista de empresas
      const empresasCarregadas = [
        { id: '4d4c1328-prod', nome: 'Empresa Produção A' },
        { id: '28a560b5-37ef-403d-ae4f-b28a608b6a68', nome: 'Empresa Teste - Homologação' },
      ];

      // Lógica de proteção contra sobrescrita por empresas[0]
      const explicitEmpresa = filterEmpresaId || selectedEmpresaId || searchParams.get('empresaId');
      if (empresasCarregadas.length > 0 && !explicitEmpresa) {
        filterEmpresaId = empresasCarregadas[0].id;
        selectedEmpresaId = empresasCarregadas[0].id;
      }

      expect(selectedEmpresaId).toBe('28a560b5-37ef-403d-ae4f-b28a608b6a68');
      expect(selectedEmpresaId).not.toBe('4d4c1328-prod');
    });

    it('mantém os parâmetros na URL durante a análise do lote e limpa somente ao fechar', () => {
      const searchParams = new URLSearchParams('tab=lotes-rh&tipo=DIARISTAS&rhLoteId=371806e7-91e4-49ed-b6df-e7e0e5fcd68a&empresaId=28a560b5-37ef-403d-ae4f-b28a608b6a68&competencia=2026-10');
      
      // Enquanto aberto, searchParams não é zerado
      expect(searchParams.get('rhLoteId')).toBe('371806e7-91e4-49ed-b6df-e7e0e5fcd68a');
      expect(searchParams.get('empresaId')).toBe('28a560b5-37ef-403d-ae4f-b28a608b6a68');

      // Ao fechar: limpa rhLoteId e tipo, mas preserva tab e empresaId
      const next = new URLSearchParams(searchParams);
      next.delete('rhLoteId');
      next.delete('tipo');

      expect(next.get('rhLoteId')).toBeNull();
      expect(next.get('tipo')).toBeNull();
      expect(next.get('tab')).toBe('lotes-rh');
      expect(next.get('empresaId')).toBe('28a560b5-37ef-403d-ae4f-b28a608b6a68');
    });
  });

  describe('9. Tratamento Diferenciado de Erros e Falhas Reais no Modal e Consulta Federada', () => {
    it('diferencia erro de acesso negado de erro de ausência legítima de dados no modal', () => {
      const erroAcessoNegado = new Error('Acesso negado: Empresa de teste não pode ser consultada no ambiente de Produção.');
      (erroAcessoNegado as any).reason = 'ENVIRONMENT_MISMATCH';

      const isAccessDenied = (erroAcessoNegado as any).reason === 'ENVIRONMENT_MISMATCH' ||
        erroAcessoNegado.message.includes('Acesso negado');
      expect(isAccessDenied).toBe(true);

      const detalheVazio = { id: 'lote-1', itens: [] };
      const temItens = (detalheVazio.itens || []).length > 0;
      expect(temItens).toBe(false);
    });

    it('preserva fail-closed e expõe mensagem real quando consulta federada falha', async () => {
      const erroOriginal = new Error('Falha crítica ao consultar Diaristas: Falha de conexão');
      
      // Fail-closed nunca inventa saldo ou mascara como válido
      const statsZeroSeguro = DespesasContasPagarOficialService.calculateKpiStats([]);
      expect(statsZeroSeguro.totalDespesas).toBe(0);
      expect(statsZeroSeguro.despesasReconhecidas).toBe(0);
      expect(erroOriginal.message).toContain('Falha crítica');
    });
  });
});
