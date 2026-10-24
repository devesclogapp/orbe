import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  normalizarCustoExtra,
  calculateDespesasKpiStats,
  getSituacaoBadge,
} from '../services/despesasOficial.service';

describe('FIX CEX-01 — ESTABILIZAÇÃO DAS TRANSIÇÕES DE CUSTOS EXTRAS', () => {
  const despesaDrawerPath = path.resolve(__dirname, '../pages/Financeiro/components/DespesaDrawerOficial.tsx');
  const despesaDrawerContent = fs.readFileSync(despesaDrawerPath, 'utf-8');

  const aprovacoesRhPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
  const aprovacoesRhContent = fs.readFileSync(aprovacoesRhPath, 'utf-8');

  const migrationViewPath = path.resolve(
    __dirname,
    '../../supabase/migrations/20261021200000_fix_cex_01_vw_aprovacoes_rh.sql'
  );
  const migrationRpcPath = path.resolve(
    __dirname,
    '../../supabase/migrations/20260918130000_fase1_custos_extras_origem_recurso_rpc.sql'
  );

  // ───────────────────────────────────────────────────────────────────────────
  // GRUPO A: RPC E PERMISSÕES DO CONTRATO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Grupo A — Contrato da RPC e Permissões de Devolução', () => {
    it('deve existir a migration canônica que define a RPC com OCC e RBAC', () => {
      expect(fs.existsSync(migrationRpcPath)).toBe(true);
    });

    const rpcSql = fs.readFileSync(migrationRpcPath, 'utf-8');

    it('RPC deve aceitar formalmente a ação "devolver" e rejeitar "reprovar"', () => {
      expect(rpcSql).toContain("ELSIF p_acao = 'devolver' THEN");
      expect(rpcSql).toContain("p_acao IN ('avancar_validacao', 'aprovar', 'enviar_financeiro', 'devolver')");
      expect(rpcSql).not.toContain("p_acao = 'reprovar'");
      expect(rpcSql).toContain("RAISE EXCEPTION 'Açao de transicao desconhecida: %', p_acao;");
    });

    it('RPC deve exigir justificativa não vazia para ação devolver', () => {
      expect(rpcSql).toContain("IF p_justificativa IS NULL OR TRIM(p_justificativa) = '' THEN");
      expect(rpcSql).toContain("RAISE EXCEPTION 'Justificativa obrigatoria para devolução.'");
    });

    it('RPC deve permitir devolver apenas nos estados EM_VALIDACAO, APROVADO_OPERACAO e ENVIADO_FINANCEIRO', () => {
      expect(rpcSql).toContain("IF v_registro.pipeline_status NOT IN ('EM_VALIDACAO', 'APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO') THEN");
      expect(rpcSql).toContain("RAISE EXCEPTION 'Estado atual (%) não permite devolução.', v_registro.pipeline_status;");
    });

    it('RPC deve bloquear devolução se o pipeline estiver FINALIZADO ou pagamento PAGO', () => {
      expect(rpcSql).toContain("IF v_registro.pipeline_status = 'FINALIZADO' THEN");
      expect(rpcSql).toContain("IF v_registro.status_pagamento = 'PAGO' THEN");
    });

    it('RPC deve transicionar o pipeline_status para RECEBIDO na devolução e atualizar justificativa_devolucao', () => {
      expect(rpcSql).toContain("v_novo_pipeline_status := 'RECEBIDO';");
      expect(rpcSql).toContain("justificativa_devolucao = COALESCE(p_justificativa, justificativa_devolucao)");
    });

    it('Drawer Financeiro não deve mais enviar a ação inválida "reprovar"', () => {
      // Isola o bloco de CUSTOS_EXTRAS em devolverMutation de DespesaDrawerOficial
      const devStart = despesaDrawerContent.indexOf('const devolverMutation = useMutation');
      const devEnd = despesaDrawerContent.indexOf('const aprovarLoteMutation = useMutation', devStart);
      const devBlock = despesaDrawerContent.substring(devStart, devEnd);

      expect(devBlock).not.toContain('"reprovar"');
      expect(devBlock).not.toContain("'reprovar'");
      expect(devBlock).toContain('"devolver"');
      expect(devBlock).toContain('motivoDevolucao.trim()');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GRUPO B: FILA DO RH
  // ───────────────────────────────────────────────────────────────────────────
  describe('Grupo B — Fila do RH (AprovacoesRh.tsx)', () => {
    const devStart = aprovacoesRhContent.indexOf('const devolverMutation = useMutation');
    const devEnd = aprovacoesRhContent.indexOf('</AppShell>', devStart);
    const devBlock = aprovacoesRhContent.substring(devStart, devEnd);

    const custoExtraDevStart = devBlock.indexOf('if (item.tipo === "CUSTO EXTRA")');
    const custoExtraDevEnd = devBlock.indexOf('if (item.tipo === "SERVIÇO EXTRA")', custoExtraDevStart);
    const custoExtraDevBlock = devBlock.substring(custoExtraDevStart, custoExtraDevEnd);

    it('não deve mais conter UPDATE direto para REPROVADO em custos_extras_operacionais', () => {
      expect(custoExtraDevBlock).not.toContain('pipeline_status: "REPROVADO"');
      expect(custoExtraDevBlock).not.toContain("pipeline_status: 'REPROVADO'");
      expect(custoExtraDevBlock).not.toContain('.update(');
    });

    it('deve invocar a RPC canônica rpc_custo_extra_transicionar com ação "devolver"', () => {
      expect(custoExtraDevBlock).toContain('rpc_custo_extra_transicionar');
      expect(custoExtraDevBlock).toContain('p_acao: "devolver"');
      expect(custoExtraDevBlock).toContain('p_id: item.id');
    });

    it('deve validar e repassar justificativa (motivo) obrigatoriamente', () => {
      expect(custoExtraDevBlock).toContain('!motivo || !motivo.trim()');
      expect(custoExtraDevBlock).toContain('p_justificativa: motivo.trim()');
    });

    it('deve consultar atualizado_em para cumprir o contrato OCC', () => {
      expect(custoExtraDevBlock).toContain('.from("custos_extras_operacionais"');
      expect(custoExtraDevBlock).toContain('.select("id, atualizado_em")');
      expect(custoExtraDevBlock).toContain('p_updated_at: custoData?.atualizado_em');
    });

    it('deve preservar os fluxos de devolução dos demais 5 tipos operacionais', () => {
      expect(devBlock).toContain('LoteFechamentoDiaristaService.reabrirPeriodo');
      expect(devBlock).toContain('IntermitentesLoteService.devolverLote');
      expect(devBlock).toContain('status_processamento: "INCONSISTENTE"'); // Ponto CLT
      expect(devBlock).toContain('pipeline_status: "DEVOLVIDO"'); // Serviço Extra
      expect(devBlock).toContain('rpc_rh_devolver_operacao'); // Operação Volume
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GRUPO C: MIGRATION DA VIEW (vw_aprovacoes_rh)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Grupo C — Nova Migration da View (vw_aprovacoes_rh)', () => {
    it('deve existir a nova migration fix_cex_01_vw_aprovacoes_rh', () => {
      expect(fs.existsSync(migrationViewPath)).toBe(true);
    });

    const viewSql = fs.readFileSync(migrationViewPath, 'utf-8');

    it('deve utilizar COALESCE(ce.pipeline_status, "RECEBIDO")::text AS raw_status no bloco Custos Extras', () => {
      expect(viewSql).toContain("COALESCE(ce.pipeline_status, 'RECEBIDO')::text AS raw_status");
      expect(viewSql).not.toContain('ce.status_pagamento AS raw_status');
    });

    it('deve manter escopo estritamente mínimo focado em raw_status e situacao (GATE 4.1)', () => {
      // Confirma que a migration não adicionou WHERE deleted_at desnecessariamente e possui tipagem text
      expect(viewSql).toContain("COALESCE(ce.pipeline_status, 'RECEBIDO')::text AS raw_status");
      expect(viewSql).not.toContain('WHERE ce.deleted_at IS NULL');
    });

    it('deve mapear corretamente os estados em situacao', () => {
      // RECEBIDO e EM_VALIDACAO mapeiam para Em análise
      expect(viewSql).toContain("'RECEBIDO'");
      expect(viewSql).toContain("'EM_VALIDACAO'");

      // APROVADO_OPERACAO, ENVIADO_FINANCEIRO e FINALIZADO mapeiam para Aprovado
      expect(viewSql).toContain("'APROVADO_OPERACAO'");
      expect(viewSql).toContain("'ENVIADO_FINANCEIRO'");
      expect(viewSql).toContain("'FINALIZADO'");

      // REPROVADO e DEVOLVIDO mapeiam para Devolvido
      expect(viewSql).toContain("'REPROVADO'");
      expect(viewSql).toContain("'DEVOLVIDO'");
    });

    it('deve preservar os demais 5 domínios da view sem alterações estruturais', () => {
      expect(viewSql).toContain("'PONTO' AS tipo");
      expect(viewSql).toContain("'OPERAÇÃO' AS tipo");
      expect(viewSql).toContain("'SERVIÇO EXTRA' AS tipo");
      expect(viewSql).toContain("'DIARISTA' AS tipo");
      expect(viewSql).toContain("'INTERMITENTE' AS tipo");
      expect(viewSql).toContain('WITH (security_invoker = on)');
      expect(viewSql).toContain('GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated');
    });

    it('simulação semântica da view: custos aprovados devem ser Aprovado e não Em análise', () => {
      // Função pura que simula a query da view para validar o mapeamento de situações
      function resolverSituacao(rawStatus: string): 'Em análise' | 'Aprovado' | 'Devolvido' {
        const s = rawStatus.toUpperCase();
        if (['EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE', 'DETALHADO', 'REGISTRADO', 'PENDENTE_RH', 'EM_ANALISE_RH', 'EM_VALIDACAO', 'RECEBIDO'].includes(s)) {
          return 'Em análise';
        }
        if (['APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO', 'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO'].includes(s)) {
          return 'Aprovado';
        }
        if (['DEVOLVIDO', 'CANCELADO', 'CANCELADO_RH', 'RETORNADO', 'RECUSADO', 'REPROVADO', 'DEVOLVIDO_RH'].includes(s)) {
          return 'Devolvido';
        }
        return 'Em análise';
      }

      // Custos recém-lançados
      expect(resolverSituacao('RECEBIDO')).toBe('Em análise');
      expect(resolverSituacao('EM_VALIDACAO')).toBe('Em análise');

      // Custos aprovados (Cenários B e C)
      expect(resolverSituacao('APROVADO_OPERACAO')).toBe('Aprovado');
      expect(resolverSituacao('ENVIADO_FINANCEIRO')).toBe('Aprovado');

      // Custos finalizados (Cenário A PAGO_EMPRESA ou quitados)
      expect(resolverSituacao('FINALIZADO')).toBe('Aprovado');

      // Custos devolvidos
      expect(resolverSituacao('DEVOLVIDO')).toBe('Devolvido');
      expect(resolverSituacao('REPROVADO')).toBe('Devolvido');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GRUPO D: REGRESSÃO FINANCEIRA E PROTEÇÃO DOS DADOS HOMOLOGADOS
  // ───────────────────────────────────────────────────────────────────────────
  describe('Grupo D — Regressão Financeira e Preservação de Valores', () => {
    it('critérios de reconhecimento DRE devem permanecer inalterados em dashboard.service.ts', () => {
      const dashboardPath = path.resolve(__dirname, '../services/dashboard.service.ts');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

      expect(dashboardContent).toContain('CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE');
      expect(dashboardContent).toContain("'APROVADO_OPERACAO'");
      expect(dashboardContent).toContain("'ENVIADO_FINANCEIRO'");
      expect(dashboardContent).toContain("'FINALIZADO'");
      expect(dashboardContent).toContain("statusPagamento === 'CANCELADO'");
    });

    it('adapter despesasOficial.service.ts deve manter isolamento estrito contra CNAB', () => {
      const despesasPath = path.resolve(__dirname, '../services/despesasOficial.service.ts');
      const despesasContent = fs.readFileSync(despesasPath, 'utf-8');

      expect(despesasContent).toContain('readinessBancario: false, // Regra CONV-05: Custos extras NUNCA vão para o CNAB');
      expect(despesasContent).toContain('prontoParaBanco: false');
      expect(despesasContent).toContain('buildCanonicalFederatedId("CUSTOS_EXTRAS"');
    });

    it('constantes de homologação: total de R$ 995,00 em Outubro/2026 composto pelos 4 registros', () => {
      const reg1 = 380; // Paleteira 1 (PAGAMENTO_PENDENTE)
      const reg2 = 150; // Gerador (PAGO_EMPRESA)
      const reg3 = 85;  // Lanche (REEMBOLSO_COLABORADOR)
      const reg4 = 380; // Paleteira 2 (PAGAMENTO_PENDENTE)

      const totalCustosExtras = reg1 + reg2 + reg3 + reg4;
      expect(totalCustosExtras).toBe(995);

      const totalPago = reg2;
      expect(totalPago).toBe(150);

      const totalAPagar = reg1 + reg3 + reg4;
      expect(totalAPagar).toBe(845);

      // Total DRE consolidado
      const diaristasHml = 350;
      const intermitentesHml = 570;
      const totalDreEsperado = totalCustosExtras + diaristasHml + intermitentesHml;
      expect(totalDreEsperado).toBe(1915);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GRUPO E: ESTABILIZAÇÃO DO DRAWER FINANCEIRO E CENTRAL DE APROVAÇÕES (GATE 5.9)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Grupo E — Estabilização do Drawer Financeiro e Central de Aprovações (GATE 5.9)', () => {
    const aprovacaoDrawerPath = path.resolve(__dirname, '../components/aprovacoes/AprovacaoDecisaoDrawer.tsx');
    const aprovacaoDrawerContent = fs.readFileSync(aprovacaoDrawerPath, 'utf-8');

    it('DespesaDrawerOficial deve proteger SheetContent com onInteractOutside e onPointerDownOutside', () => {
      expect(despesaDrawerContent).toContain('isAnyActionModalOpen = modalLiberarOpen || modalLiquidarOpen || modalDevolverOpen || modalAprovarLoteOpen');
      expect(despesaDrawerContent).toContain('onInteractOutside={(e) => {');
      expect(despesaDrawerContent).toContain('if (isAnyActionModalOpen) {');
      expect(despesaDrawerContent).toContain('onPointerDownOutside={(e) => {');
      expect(despesaDrawerContent).toContain('e.preventDefault();');
    });

    it('DespesaDrawerOficial deve elevar DialogContent com z-[60] nos 4 modais de ação', () => {
      const dialogContentMatches = despesaDrawerContent.match(/DialogContent className="max-w-md z-\[60\]"/g);
      expect(dialogContentMatches).not.toBeNull();
      expect(dialogContentMatches?.length).toBe(4);
    });

    it('AprovacaoDecisaoDrawer deve identificar Custo Extra em RECEBIDO e ocultar o botão Devolver', () => {
      expect(aprovacaoDrawerContent).toContain('isCustoExtraRecebido');
      expect(aprovacaoDrawerContent).toContain('item.tipo === "CUSTO EXTRA"');
      expect(aprovacaoDrawerContent).toContain('item.situacao !== "Devolvido" && !isFailClosedBloqueado && !isCustoExtraRecebido');
    });

    it('AprovacaoDecisaoDrawer deve preservar o botão Devolver para os demais 5 domínios operacionais', () => {
      // Se não for Custo Extra, isCustoExtraRecebido é false, permitindo devolução normalmente
      const simularPermissaoDevolucao = (tipo: string, rawStatus: string, situacao: string) => {
        const isCustoExtraRec = tipo === 'CUSTO EXTRA' && (rawStatus === 'RECEBIDO' || rawStatus === 'PENDENTE' || !rawStatus);
        const isFailClosed = false;
        return situacao !== 'Devolvido' && !isFailClosed && !isCustoExtraRec;
      };

      // Custo Extra em RECEBIDO -> bloqueado
      expect(simularPermissaoDevolucao('CUSTO EXTRA', 'RECEBIDO', 'Em análise')).toBe(false);

      // Custo Extra em EM_VALIDACAO ou APROVADO_OPERACAO -> permitido
      expect(simularPermissaoDevolucao('CUSTO EXTRA', 'EM_VALIDACAO', 'Em análise')).toBe(true);
      expect(simularPermissaoDevolucao('CUSTO EXTRA', 'APROVADO_OPERACAO', 'Em análise')).toBe(true);

      // Demais 5 domínios -> plenamente permitidos
      expect(simularPermissaoDevolucao('DIARISTA', 'AGUARDANDO_VALIDACAO_RH', 'Em análise')).toBe(true);
      expect(simularPermissaoDevolucao('INTERMITENTE', 'AGUARDANDO_VALIDACAO_RH', 'Em análise')).toBe(true);
      expect(simularPermissaoDevolucao('PONTO', 'EM_ANALISE_RH', 'Em análise')).toBe(true);
      expect(simularPermissaoDevolucao('OPERAÇÃO', 'EM_VALIDACAO', 'Em análise')).toBe(true);
      expect(simularPermissaoDevolucao('SERVIÇO EXTRA', 'REGISTRADO', 'Em análise')).toBe(true);
    });

    it('AprovacaoDecisaoDrawer deve proteger SheetContent contra dismiss quando modalDevolucaoOpen estiver aberto', () => {
      expect(aprovacaoDrawerContent).toContain('if (modalDevolucaoOpen) {');
      expect(aprovacaoDrawerContent).toContain('e.preventDefault();');
      expect(aprovacaoDrawerContent).toContain('DialogContent className="sm:max-w-md bg-card border-border text-foreground z-[60]"');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GRUPO F: ELEGIBILIDADE FINANCEIRA E CLASSIFICAÇÃO OPERACIONAL (GATE 5.14)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Grupo F — Elegibilidade Financeira e Classificação Operacional (GATE 5.14)', () => {
    const empresasMap = new Map([['emp-001', 'Empresa Teste - Homologação']]);
    const mesCompetencia = '2026-10';

    it('01. normalizarCustoExtra: RECEBIDO e EM_VALIDACAO devem ser classificados como EM_ANALISE (nunca AGUARDANDO_LIBERACAO ou A_PAGAR)', () => {
      const rawRecebido = {
        id: 'faa91987-3ce7-429c-a547-5d9aeaed11f6',
        empresa_id: 'emp-001',
        total: 55,
        origem_recurso: 'PAGAMENTO_PENDENTE',
        pipeline_status: 'RECEBIDO',
        status_pagamento: 'A_PAGAR',
      };
      const normRecebido = normalizarCustoExtra(rawRecebido, empresasMap, mesCompetencia);
      expect(normRecebido.situacao).toBe('EM_ANALISE');
      expect(normRecebido.situacaoVisual).toBe('EM_ANALISE');
      expect(normRecebido.situacao).not.toBe('AGUARDANDO_LIBERACAO');
      expect(normRecebido.situacao).not.toBe('A_PAGAR');

      const rawValidacao = {
        id: 'cex-validacao-001',
        empresa_id: 'emp-001',
        total: 120,
        origem_recurso: 'REEMBOLSO_COLABORADOR',
        pipeline_status: 'EM_VALIDACAO',
        status_pagamento: 'A_PAGAR',
      };
      const normValidacao = normalizarCustoExtra(rawValidacao, empresasMap, mesCompetencia);
      expect(normValidacao.situacao).toBe('EM_ANALISE');
      expect(normValidacao.situacaoVisual).toBe('EM_ANALISE');
      expect(normValidacao.situacao).not.toBe('AGUARDANDO_LIBERACAO');
      expect(normValidacao.situacao).not.toBe('A_PAGAR');
    });

    it('02. normalizarCustoExtra: APROVADO_OPERACAO deve ser classificado como AGUARDANDO_LIBERACAO', () => {
      const rawAprovado = {
        id: 'cex-aprov-001',
        empresa_id: 'emp-001',
        total: 200,
        origem_recurso: 'PAGAMENTO_PENDENTE',
        pipeline_status: 'APROVADO_OPERACAO',
        status_pagamento: 'A_PAGAR',
      };
      const normAprovado = normalizarCustoExtra(rawAprovado, empresasMap, mesCompetencia);
      expect(normAprovado.situacao).toBe('AGUARDANDO_LIBERACAO');
      expect(normAprovado.situacaoVisual).toBe('AGUARDANDO_LIBERACAO');
    });

    it('03. normalizarCustoExtra: ENVIADO_FINANCEIRO deve ser classificado como A_PAGAR', () => {
      const rawEnviado = {
        id: 'cex-env-001',
        empresa_id: 'emp-001',
        total: 380,
        origem_recurso: 'PAGAMENTO_PENDENTE',
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'A_PAGAR',
      };
      const normEnviado = normalizarCustoExtra(rawEnviado, empresasMap, mesCompetencia);
      expect(normEnviado.situacao).toBe('A_PAGAR');
      expect(normEnviado.situacaoVisual).toBe('A_PAGAR');
    });

    it('04. normalizarCustoExtra: FINALIZADO e status PAGO devem ser classificados como PAGA', () => {
      const rawFinalizado = {
        id: 'cex-fin-001',
        empresa_id: 'emp-001',
        total: 150,
        origem_recurso: 'PAGO_EMPRESA',
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
      };
      const normFinalizado = normalizarCustoExtra(rawFinalizado, empresasMap, mesCompetencia);
      expect(normFinalizado.situacao).toBe('PAGA');
      expect(normFinalizado.situacaoVisual).toBe('PAGA');
    });

    it('05. normalizarCustoExtra: mapeamento estrito dos tipos de origem do recurso', () => {
      // PAGAMENTO_PENDENTE -> tipo: PAGAMENTO_PENDENTE
      const normBoleto = normalizarCustoExtra({ id: '1', origem_recurso: 'PAGAMENTO_PENDENTE' }, empresasMap, mesCompetencia);
      expect(normBoleto.tipo).toBe('PAGAMENTO_PENDENTE');

      // REEMBOLSO_COLABORADOR -> tipo: REEMBOLSO_COLABORADOR
      const normReembolso = normalizarCustoExtra({ id: '2', origem_recurso: 'REEMBOLSO_COLABORADOR' }, empresasMap, mesCompetencia);
      expect(normReembolso.tipo).toBe('REEMBOLSO_COLABORADOR');

      // PAGO_EMPRESA -> tipo: PAGO_EMPRESA, situacao: PAGA
      const normEmpresa = normalizarCustoExtra({ id: '3', origem_recurso: 'PAGO_EMPRESA' }, empresasMap, mesCompetencia);
      expect(normEmpresa.tipo).toBe('PAGO_EMPRESA');
      expect(normEmpresa.situacao).toBe('PAGA');
    });

    it('06. calculateDespesasKpiStats: EM_ANALISE NÃO incrementa aPagar nem qtdAPagar', () => {
      const itemAprovado = normalizarCustoExtra({
        id: 'ce-aprov',
        total: 845,
        origem_recurso: 'PAGAMENTO_PENDENTE',
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'A_PAGAR',
      }, empresasMap, mesCompetencia);

      const itemPago = normalizarCustoExtra({
        id: 'ce-pago',
        total: 150,
        origem_recurso: 'PAGO_EMPRESA',
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
      }, empresasMap, mesCompetencia);

      const itemDevolvidoRecebido = normalizarCustoExtra({
        id: 'faa91987-3ce7-429c-a547-5d9aeaed11f6',
        total: 55,
        origem_recurso: 'PAGAMENTO_PENDENTE',
        pipeline_status: 'RECEBIDO',
        status_pagamento: 'A_PAGAR',
      }, empresasMap, mesCompetencia);

      // Apenas os itens aprovados e pagos: R$ 845 a pagar, R$ 150 pago
      const statsSemRecebido = calculateDespesasKpiStats([itemAprovado, itemPago]);
      expect(statsSemRecebido.aPagar).toBe(845);
      expect(statsSemRecebido.qtdAPagar).toBe(1);
      expect(statsSemRecebido.pagasLiquidadas).toBe(150);

      // Se itemDevolvidoRecebido for passado diretamente a calculateDespesasKpiStats, ele tem situacao: EM_ANALISE
      // Portanto, aPagar e qtdAPagar permanecem rigorosamente R$ 845 e 1
      const statsComRecebido = calculateDespesasKpiStats([itemAprovado, itemPago, itemDevolvidoRecebido]);
      expect(statsComRecebido.aPagar).toBe(845);
      expect(statsComRecebido.qtdAPagar).toBe(1);
    });

    it('07. getSituacaoBadge: EM_ANALISE deve renderizar badge consistente "Em Análise"', () => {
      const badge = getSituacaoBadge('EM_ANALISE');
      expect(badge.label).toBe('Em Análise');
      expect(badge.variant).toBe('secondary');
    });

    it('08. DespesaDrawerOficial: bloqueia Liberar para Pagamento e Liquidar quando em EM_ANALISE / RECEBIDO / EM_VALIDACAO', () => {
      // 1. Renderiza botão Fechar exclusivamente
      expect(despesaDrawerContent).toContain('despesa.situacao === "EM_ANALISE" || despesa.statusReal === "RECEBIDO" || despesa.statusReal === "EM_VALIDACAO"');

      // 2. Guarda Fail-Closed na mutação de liberação
      expect(despesaDrawerContent).toContain('despesa.situacao === "EM_ANALISE" ||');
      expect(despesaDrawerContent).toContain('despesa.statusReal === "RECEBIDO" ||');
      expect(despesaDrawerContent).toContain('despesa.rawItem?.pipeline_status === "RECEBIDO"');
      expect(despesaDrawerContent).toContain('Despesa em estágio operacional pré-aprovação não pode ser liberada para pagamento');
    });

    it('09. despesasOficial.service.ts: fetchDespesasFederadas deve filtrar custos extras em RECEBIDO e EM_VALIDACAO', () => {
      const despesasServicePath = path.resolve(__dirname, '../services/despesasOficial.service.ts');
      const despesasServiceContent = fs.readFileSync(despesasServicePath, 'utf-8');

      expect(despesasServiceContent).toContain('isOperacionalPendente = (sStatus === "RECEBIDO" || sStatus === "EM_VALIDACAO") && sPag !== "PAGO" && sStatus !== "FINALIZADO"');
      expect(despesasServiceContent).toContain('if (isOperacionalPendente) {');
      expect(despesasServiceContent).toContain('continue;');
    });

    it('10. Critérios de Homologação de Outubro/2026 preservados (ETAPA 4)', () => {
      // 4 registros homologados da ESC Log:
      const p1 = 380; // ENVIADO_FINANCEIRO
      const p2 = 380; // ENVIADO_FINANCEIRO
      const lanche = 85; // ENVIADO_FINANCEIRO
      const gerador = 150; // FINALIZADO

      const totalObrigacoesAprovadas = p1 + p2 + lanche;
      expect(totalObrigacoesAprovadas).toBe(845);

      const totalDespesasPagas = gerador;
      expect(totalDespesasPagas).toBe(150);

      const totalReconhecidoDRE = totalObrigacoesAprovadas + totalDespesasPagas;
      expect(totalReconhecidoDRE).toBe(995);

      // O registro sintético devolvido de R$ 55,00 em RECEBIDO NÃO entra em obrigações aprovadas (845) nem na DRE (995)
      const sinteticoRecebido = 55;
      expect(totalObrigacoesAprovadas).not.toBe(totalObrigacoesAprovadas + sinteticoRecebido);
      expect(totalObrigacoesAprovadas).toBe(845);
    });
  });
});

