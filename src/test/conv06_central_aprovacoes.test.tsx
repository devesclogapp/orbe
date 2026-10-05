import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('CONV-06 — Central de Aprovações: Convergência Oficial UX08', () => {
  const aprovacoesPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
  const drawerPath = path.resolve(__dirname, '../components/aprovacoes/AprovacaoDecisaoDrawer.tsx');
  const appPath = path.resolve(__dirname, '../App.tsx');

  const aprovacoesContent = fs.readFileSync(aprovacoesPath, 'utf-8');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  describe('1. Rota e Integração Oficial', () => {
    it('1.1 App.tsx deve registrar a rota oficial /rh/aprovacoes apontando para AprovacoesRh', () => {
      expect(appContent).toContain('path="/rh/aprovacoes"');
      expect(appContent).toContain('<AprovacoesRh />');
    });

    it('1.2 App.tsx deve suportar deep-links travados (ex: /custos-extras/aprovacoes)', () => {
      expect(appContent).toContain('path="/custos-extras/aprovacoes"');
      expect(appContent).toContain('flowType="CUSTO EXTRA"');
      expect(appContent).toContain('lockedFlow={true}');
    });

    it('1.3 AprovacoesRh não deve conter dados mockados locais em sua renderização oficial', () => {
      expect(aprovacoesContent).not.toContain('MOCK_ITENS_APROVACOES');
      expect(aprovacoesContent).not.toContain('MOCK_EMPRESAS_APROVACOES');
    });

    it('1.4 AprovacoesRh deve buscar dados da fonte real AprovacoesService e vw_aprovacoes_rh', () => {
      expect(aprovacoesContent).toContain('AprovacoesService.getAprovacoesRh');
      expect(aprovacoesContent).toContain('queryKey: ["aprovacoes-rh"');
    });
  });

  describe('2. Preservação dos 6 Domínios Canônicos e Handlers', () => {
    it('2.1 Suporta exatamente os 6 domínios homologados', () => {
      expect(drawerContent).toContain('type TipoItem = "PONTO" | "DIARISTA" | "INTERMITENTE" | "CUSTO EXTRA" | "SERVIÇO EXTRA" | "OPERAÇÃO";');
      expect(aprovacoesContent).toContain('DOMINIOS_TABS');
      expect(aprovacoesContent).toContain('SERVIÇO EXTRA');
      expect(aprovacoesContent).toContain('CUSTO EXTRA');
      expect(aprovacoesContent).toContain('DIARISTA');
      expect(aprovacoesContent).toContain('INTERMITENTE');
      expect(aprovacoesContent).toContain('OPERAÇÃO');
      expect(aprovacoesContent).toContain('PONTO');
    });

    it('2.2 aprovarMutation preserva handler de OPERAÇÃO com rpc_rh_aprovar_operacao e guarda de restrição', () => {
      expect(aprovacoesContent).toContain('item.tipo === "OPERAÇÃO"');
      expect(aprovacoesContent).toContain('rpc_rh_aprovar_operacao');
      expect(aprovacoesContent).toContain('EM_RESTRICAO');
    });

    it('2.3 aprovarMutation preserva handler de SERVIÇO EXTRA', () => {
      expect(aprovacoesContent).toContain('item.tipo === "SERVIÇO EXTRA"');
      expect(aprovacoesContent).toContain('servicos_extras_operacionais');
      expect(aprovacoesContent).toContain('APROVADO_OPERACAO');
    });

    it('2.4 aprovarMutation preserva handler de CUSTO EXTRA com OCC e rpc_custo_extra_transicionar', () => {
      expect(aprovacoesContent).toContain('item.tipo === "CUSTO EXTRA"');
      expect(aprovacoesContent).toContain('custos_extras_operacionais');
      expect(aprovacoesContent).toContain('rpc_custo_extra_transicionar');
    });

    it('2.5 aprovarMutation preserva handler de DIARISTA com lote_fechamento e lancamentos', () => {
      expect(aprovacoesContent).toContain('item.tipo === "DIARISTA"');
      expect(aprovacoesContent).toContain('diaristas_lotes_fechamento');
      expect(aprovacoesContent).toContain('lancamentos_diaristas');
      expect(aprovacoesContent).toContain('VALIDADO_RH');
    });

    it('2.6 aprovarMutation preserva handler de INTERMITENTE via IntermitentesLoteService.validarLote', () => {
      expect(aprovacoesContent).toContain('item.tipo === "INTERMITENTE"');
      expect(aprovacoesContent).toContain('IntermitentesLoteService.validarLote');
    });

    it('2.7 aprovarMutation preserva handler de PONTO com registros_ponto e status PROCESSADO', () => {
      expect(aprovacoesContent).toContain('item.tipo === "PONTO"');
      expect(aprovacoesContent).toContain('registros_ponto');
      expect(aprovacoesContent).toContain('status_processamento: "PROCESSADO"');
    });
  });

  describe('3. Fail-Closed e Proteção de Erro', () => {
    it('3.1 aprovarMutation opera Fail-Closed para tipos não reconhecidos', () => {
      expect(aprovacoesContent).toContain('throw new Error(`Não foi possível identificar o fluxo de aprovação');
    });

    it('3.2 devolverMutation opera Fail-Closed para tipos não reconhecidos', () => {
      expect(aprovacoesContent).toContain('throw new Error(`Não foi possível identificar o fluxo de devolução');
    });

    it('3.3 Anti-duplo clique: botões e ações são desabilitados durante execução de mutação', () => {
      expect(drawerContent).toContain('disabled={isAprovando || isDevolvendo}');
      expect(aprovacoesContent).toContain('disabled={aprovarMutation.isPending}');
      expect(aprovacoesContent).toContain('disabled={devolverMutation.isPending}');
    });
  });

  describe('4. KPIs e Contexto Macro', () => {
    it('4.1 Implementa os 4 KPIs operacionais UX08', () => {
      expect(aprovacoesContent).toContain('Aguardando Decisão');
      expect(aprovacoesContent).toContain('Mais Antigo na Fila');
      expect(aprovacoesContent).toContain('Devolvidos');
      expect(aprovacoesContent).toContain('Impacto Financeiro');
    });

    it('4.2 KPIs são calculados a partir de aprovacoesContextuais e não dos filtros exploratórios', () => {
      expect(aprovacoesContent).toContain('const kpis = useMemo(');
      expect(aprovacoesContent).toContain('[aprovacoesContextuais]');
    });

    it('4.3 Impacto Financeiro soma apenas registros com valor monetário real', () => {
      expect(aprovacoesContent).toContain('pendentes.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)');
    });

    it('4.4 Mais Antigo não inventa SLA e expressa antiguidade factual (tempo decorrido e data de recebimento)', () => {
      expect(aprovacoesContent).not.toContain('SLA EXCEDIDO');
      expect(aprovacoesContent).toContain('getMaisAntigoInfo');
      expect(aprovacoesContent).toContain('{kpis.maisAntigo.valor}');
      expect(aprovacoesContent).toContain('{kpis.maisAntigo.descricao}');
    });
  });

  describe('5. Navegação, Filtros e Fila Dominante', () => {
    it('5.1 Suporta filtro rápido clicável nos cards de KPI', () => {
      expect(aprovacoesContent).toContain('setFiltroRapidoKpi');
      expect(aprovacoesContent).toContain('filtroRapidoKpi === "aguardando_decisao"');
      expect(aprovacoesContent).toContain('filtroRapidoKpi === "mais_antigos"');
      expect(aprovacoesContent).toContain('filtroRapidoKpi === "devolvidos"');
    });

    it('5.2 Restaurar Fila Padrão preserva o domínio se lockedFlow for verdadeiro', () => {
      expect(aprovacoesContent).toContain('Restaurar Fila Padrão');
      expect(aprovacoesContent).toContain('if (!isLocked) setDominioFiltro("TODAS")');
    });

    it('5.3 Coluna data_recebimento usa snake_case canônico e fmtDate', () => {
      expect(aprovacoesContent).not.toContain('{item.dataRecebimento}');
      expect(aprovacoesContent).toContain('fmtDate(item.data_recebimento)');
    });
  });

  describe('6. Drawer Decisório e Despacho Especialista', () => {
    it('6.1 Drawer possui rotas reais de despacho para todos os 6 domínios', () => {
      expect(drawerContent).toContain('case "OPERAÇÃO":');
      expect(drawerContent).toContain('return "/operacoes-volume"');
      expect(drawerContent).toContain('case "SERVIÇO EXTRA":');
      expect(drawerContent).toContain('return "/operacional/servicos-extras"');
      expect(drawerContent).toContain('case "CUSTO EXTRA":');
      expect(drawerContent).toContain('return "/operacional/custos-extras"');
      expect(drawerContent).toContain('case "DIARISTA":');
      expect(drawerContent).toContain('return "/producao/diaristas"');
      expect(drawerContent).toContain('case "INTERMITENTE":');
      expect(drawerContent).toContain('return "/intermitentes/lotes"');
      expect(drawerContent).toContain('case "PONTO":');
      expect(drawerContent).toContain('return "/clt/pontos"');
    });

    it('6.2 Edição inline de diarista foi removida do Drawer e substituída por navegação ao especialista', () => {
      expect(drawerContent).not.toContain('setEditingDiarista');
      expect(drawerContent).not.toContain('updateAdminWithRecalculate');
      expect(drawerContent).toContain('Ver no Módulo Especialista');
    });

    it('6.3 Justificativa obrigatória no modal de devolução', () => {
      expect(drawerContent).toContain('Justificativa Obrigatória');
      expect(drawerContent).toContain('disabled={!motivoDevolucao.trim()');
    });
  });
});
