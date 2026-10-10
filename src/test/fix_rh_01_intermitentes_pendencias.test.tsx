import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ERP ORBE — FIX-RH-01: Resolução Efetiva de Pendências de Lotes Intermitentes', () => {
  const servicePath = path.resolve(__dirname, '../services/domain/intermitentes.service.ts');
  const drawerPath = path.resolve(__dirname, '../components/aprovacoes/AprovacaoDecisaoDrawer.tsx');
  const colaboradoresPath = path.resolve(__dirname, '../pages/Colaboradores.tsx');
  const aprovacoesRhPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');

  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
  const colaboradoresContent = fs.readFileSync(colaboradoresPath, 'utf-8');
  const aprovacoesRhContent = fs.readFileSync(aprovacoesRhPath, 'utf-8');

  describe('1. ETAPA 01 — Diagnóstico da Causa Raiz & Contratos de Serviço', () => {
    it('1.1 IntermitentesLoteService deve exportar as interfaces PendenciaCompletudeLoteItem e CompletudeLoteResult', () => {
      expect(serviceContent).toContain('export interface PendenciaCompletudeLoteItem');
      expect(serviceContent).toContain('export interface CompletudeLoteResult');
      expect(serviceContent).toContain('itensPendentes?: PendenciaCompletudeLoteItem[]');
    });

    it('1.2 verificarCompletudeLote deve auditar dados cadastrais, remuneração e bancários com Fail-Closed', () => {
      expect(serviceContent).toContain('verificarCompletudeLote');
      expect(serviceContent).toContain('getColaboradorCompletudeDetailed');
      expect(serviceContent).toContain('podeAprovar: pendencias.length === 0');
    });

    it('1.3 PendenciaCompletudeLoteItem deve conter identificadores e rotas corretivas oficiais', () => {
      expect(serviceContent).toContain('colaboradorId: c.id');
      expect(serviceContent).toContain("moduloDestino: 'Cadastros / Colaboradores'");
      expect(serviceContent).toContain("rotaDestino: '/colaboradores'");
      expect(serviceContent).toContain('proximaAcao');
      expect(serviceContent).toContain('detalhes:');
    });
  });

  describe('2. ETAPA 02 — Diagnóstico Visível no Drawer (Problema -> Diagnóstico -> Impacto -> Ação -> Destino)', () => {
    it('2.1 AprovacaoDecisaoDrawer deve manter bloqueio Fail-Closed estrito quando houver pendências', () => {
      expect(drawerContent).toContain('const isIntermitenteIncompleto = item.tipo === "INTERMITENTE" && valData?.podeAprovar === false;');
      expect(drawerContent).toContain('const isFailClosedBloqueado = isOperacaoRestrita || isIntermitenteIncompleto;');
      expect(drawerContent).toContain('Decisão Bloqueada por Pendência Cadastral/Operacional (Fail-Closed)');
    });

    it('2.2 Drawer deve exibir a estrutura sequencial: PROBLEMA -> DIAGNÓSTICO -> IMPACTO -> PRÓXIMA AÇÃO -> DESTINO', () => {
      expect(drawerContent).toContain('Diagnóstico Factual:');
      expect(drawerContent).toContain('Impacto:');
      expect(drawerContent).toContain('Próxima Ação:');
      expect(drawerContent).toContain('Destino:');
      expect(drawerContent).toContain('Lote impedido de gerar despesa financeira e remessa CNAB.');
    });

    it('2.3 Diagnóstico deve discriminar campos ausentes sem expor dados sensíveis', () => {
      expect(drawerContent).toContain('p.detalhes?.operacional');
      expect(drawerContent).toContain('p.detalhes?.rh');
      expect(drawerContent).toContain('p.detalhes?.financeiro');
      expect(drawerContent).toContain('Identificação Pessoal:');
      expect(drawerContent).toContain('Remuneração & Regra RH:');
      expect(drawerContent).toContain('Dados Bancários para Pagamento:');
    });

    it('2.4 Checklist de Integridade & Regras de Negócio deve conter validação explícita de Intermitentes', () => {
      expect(drawerContent).toContain('item.tipo === "INTERMITENTE"');
      expect(drawerContent).toContain('Completude Cadastral & Bancária');
      expect(drawerContent).toContain('Pendente (Fail-Closed)');
      expect(drawerContent).toContain('Conforme');
    });
  });

  describe('3. ETAPA 03 — CTA Corretivo Real (Eliminação do Ciclo de Navegação Circular)', () => {
    it('3.1 Drawer deve possuir CTA corretivo que navega diretamente para o cadastro do colaborador', () => {
      expect(drawerContent).toContain('handleResolverPendenciaColaborador');
      expect(drawerContent).toContain('navigate("/colaboradores"');
      expect(drawerContent).toContain('openEditId: colaboradorId');
      expect(drawerContent).toContain('returnTo: "/rh/aprovacoes"');
      expect(drawerContent).toContain('loteId: item.id');
    });

    it('3.2 Não deve direcionar para /intermitentes/lotes como meio de resolver cadastro do colaborador', () => {
      expect(drawerContent).toContain('Resolver Cadastro de');
      expect(drawerContent).not.toContain('onClick={handleAbrirModuloEspecialista}>Resolver no Módulo Especialista');
    });
  });

  describe('4. ETAPA 04 — Retorno, Contexto e Revalidação', () => {
    it('4.1 Colaboradores.tsx deve capturar e reter returnContext vindo de /rh/aprovacoes', () => {
      expect(colaboradoresContent).toContain('const [returnContext, setReturnContext] = useState');
      expect(colaboradoresContent).toContain('const [pendingEditId, setPendingEditId] = useState');
      expect(colaboradoresContent).toContain('returnTo: location.state.returnTo');
      expect(colaboradoresContent).toContain('loteId: location.state.loteId');
    });

    it('4.2 Colaboradores.tsx deve exibir banner contextual de regularização para aprovação RH', () => {
      expect(colaboradoresContent).toContain('Regularização Cadastral para Aprovação RH');
      expect(colaboradoresContent).toContain('returnContext.loteRef || returnContext.loteId');
    });

    it('4.3 createMutation.onSuccess deve disparar retorno fluído com toast de ação', () => {
      expect(colaboradoresContent).toContain('if (returnContext?.returnTo)');
      expect(colaboradoresContent).toContain('Retornando à Central de Aprovações RH...');
      expect(colaboradoresContent).toContain('navigate(dest, { state: { loteId } })');
    });

    it('4.4 AprovacaoDecisaoDrawer deve fornecer ação imediata de revalidação de integridade', () => {
      expect(drawerContent).toContain('refetch: refetchCompletude');
      expect(drawerContent).toContain('isFetching: isFetchingCompletude');
      expect(drawerContent).toContain('Revalidar Integridade');
    });
  });

  describe('5. Auditoria de Não-Regressão nos 6 Domínios Canônicos', () => {
    it('5.1 Preserva os 6 domínios e seus tipos no Drawer', () => {
      expect(drawerContent).toContain('type TipoItem = "PONTO" | "DIARISTA" | "INTERMITENTE" | "CUSTO EXTRA" | "SERVIÇO EXTRA" | "OPERAÇÃO";');
      expect(drawerContent).toContain('case "OPERAÇÃO":');
      expect(drawerContent).toContain('case "DIARISTA":');
      expect(drawerContent).toContain('case "INTERMITENTE":');
      expect(drawerContent).toContain('case "CUSTO EXTRA":');
      expect(drawerContent).toContain('case "SERVIÇO EXTRA":');
      expect(drawerContent).toContain('case "PONTO":');
    });

    it('5.2 Preserva integrações em AprovacoesRh.tsx', () => {
      expect(aprovacoesRhContent).toContain('IntermitentesLoteService.validarLote');
      expect(aprovacoesRhContent).toContain('rpc_rh_aprovar_operacao');
      expect(aprovacoesRhContent).toContain('rpc_custo_extra_transicionar');
    });
  });
});
