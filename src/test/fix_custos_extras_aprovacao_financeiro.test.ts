import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FIX CIRÚRGICO — CUSTOS EXTRAS: APROVAÇÃO OPERACIONAL E LINK FINANCEIRO', () => {
  const aprovacoesRhPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
  const aprovacoesRhContent = fs.readFileSync(aprovacoesRhPath, 'utf-8');

  const sidebarPath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

  describe('1. Aprovação de CUSTO EXTRA em AprovacoesRh', () => {
    const aprovarStart = aprovacoesRhContent.indexOf('const aprovarMutation = useMutation');
    const aprovarEnd = aprovacoesRhContent.indexOf('const devolverMutation = useMutation', aprovarStart);
    const aprovarMutationCode = aprovacoesRhContent.substring(aprovarStart, aprovarEnd);

    const custoExtraStart = aprovarMutationCode.indexOf('if (item.tipo === "CUSTO EXTRA")');
    const custoExtraEnd = aprovarMutationCode.indexOf('if (item.tipo === "SERVIÇO EXTRA")', custoExtraStart);
    const custoExtraBlock = aprovarMutationCode.substring(custoExtraStart, custoExtraEnd);

    it('não deve mais conter update direto com pipeline_status: "EM_VALIDACAO"', () => {
      expect(custoExtraBlock).not.toContain('pipeline_status: "EM_VALIDACAO"');
      expect(custoExtraBlock).not.toContain("pipeline_status: 'EM_VALIDACAO'");
      expect(custoExtraBlock).not.toContain('.update(');
    });

    it('deve chamar rpc_custo_extra_transicionar com p_acao: "aprovar"', () => {
      expect(custoExtraBlock).toContain('rpc_custo_extra_transicionar');
      expect(custoExtraBlock).toContain('p_acao: "aprovar"');
      expect(custoExtraBlock).toContain('p_id: item.id');
      expect(custoExtraBlock).toContain('p_updated_at:');
    });

    it('deve buscar atualizado_em do registro para cumprir o OCC da RPC', () => {
      expect(custoExtraBlock).toContain('.from("custos_extras_operacionais"');
      expect(custoExtraBlock).toContain('.select("id, atualizado_em")');
      expect(custoExtraBlock).toContain('.eq("id", item.id)');
    });
  });

  describe('2. Preservação dos Demais Fluxos em AprovacoesRh', () => {
    it('DIARISTA deve continuar validando via diaristas_lotes_fechamento', () => {
      expect(aprovacoesRhContent).toContain('diaristas_lotes_fechamento');
      expect(aprovacoesRhContent).toContain('status: "VALIDADO_RH"');
    });

    it('INTERMITENTE deve continuar chamando IntermitentesLoteService.validarLote', () => {
      expect(aprovacoesRhContent).toContain('IntermitentesLoteService.validarLote(item.id');
    });

    it('PONTO deve continuar atualizando status_processamento para PROCESSADO', () => {
      expect(aprovacoesRhContent).toContain('registros_ponto');
      expect(aprovacoesRhContent).toContain('status_processamento: "PROCESSADO"');
    });

    it('SERVIÇO EXTRA deve continuar atualizando pipeline_status para APROVADO_OPERACAO', () => {
      expect(aprovacoesRhContent).toContain('servicos_extras_operacionais');
      expect(aprovacoesRhContent).toContain('pipeline_status: "APROVADO_OPERACAO"');
    });

    it('OPERAÇÃO deve continuar chamando rpc_rh_aprovar_operacao com checagem de horários', () => {
      expect(aprovacoesRhContent).toContain('rpc_rh_aprovar_operacao');
      expect(aprovacoesRhContent).toContain('opData?.status === "EM_RESTRICAO"');
    });
  });

  describe('3. Rota Canônica no Sidebar para Pagamentos de Custos Extras', () => {
    it('item Pagamentos / Contas a Pagar em Custos Extras deve apontar para /financeiro?tab=custos-extras', () => {
      const custosExtrasIndex = sidebarContent.indexOf('id: "custos_extras"');
      const nextSectionIndex = sidebarContent.indexOf('// --- MÓDULOS TRANSVERSAIS', custosExtrasIndex);
      const custosExtrasBlock = sidebarContent.substring(custosExtrasIndex, nextSectionIndex);

      expect(custosExtrasBlock).toContain(
        '{ icon: Banknote, label: "Pagamentos / Contas a Pagar", to: "/financeiro?tab=custos-extras", module: "pagamentos_remessas" }'
      );
      expect(custosExtrasBlock).not.toContain('/financeiro/contas-bancarias');
    });

    it('ContasBancarias.tsx deve permanecer inalterado como módulo bancário', () => {
      const contasBancariasPath = path.resolve(__dirname, '../pages/Financeiro/ContasBancarias.tsx');
      expect(fs.existsSync(contasBancariasPath)).toBe(true);

      const appPath = path.resolve(__dirname, '../App.tsx');
      const appContent = fs.readFileSync(appPath, 'utf-8');
      expect(appContent).toContain('path="/financeiro/contas-bancarias" element={<AuthGuard><ContasBancarias /></AuthGuard>}');
    });
  });

  describe('4. Deep-link e Sincronização de Tabs na CentralFinanceira', () => {
    const centralFinanceiraPath = path.resolve(__dirname, '../pages/CentralFinanceira.tsx');
    const centralFinanceiraContent = fs.readFileSync(centralFinanceiraPath, 'utf-8');

    it('deve listar custos-extras entre as tabs válidas', () => {
      expect(centralFinanceiraContent).toContain('"custos-extras"');
      expect(centralFinanceiraContent).toContain('VALID_FINANCEIRO_TABS');
    });

    it('deve inicializar activeTab com o query param tab quando presente e válido', () => {
      expect(centralFinanceiraContent).toContain('searchParams.get("tab")');
      expect(centralFinanceiraContent).toContain('const initialTab');
      expect(centralFinanceiraContent).toContain('useState<FinanceiroTabValue>(initialTab)');
    });

    it('deve sincronizar activeTab via useEffect quando searchParams mudar', () => {
      expect(centralFinanceiraContent).toContain('const tabUrl = searchParams.get("tab")');
      expect(centralFinanceiraContent).toContain('setActiveTab(tabUrl as FinanceiroTabValue)');
    });

    it('deve usar handleTabChange no Tabs para sincronizar mudanças de aba com a URL', () => {
      expect(centralFinanceiraContent).toContain('<Tabs value={activeTab} onValueChange={handleTabChange}');
      expect(centralFinanceiraContent).toContain('next.set("tab", valid)');
    });
  });
});

