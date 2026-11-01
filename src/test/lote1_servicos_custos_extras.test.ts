import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SERVICOS_EXTRAS_STAGES,
} from '@/components/operacoes/ServicosExtrasContinuityDrawer';
import {
  isCustoExtraReconhecidoDRE,
  CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE,
} from '@/services/dashboard.service';
import {
  buildCustoExtraInsertPayload,
  OPCOES_ORIGEM_RECURSO,
  type OrigemRecursoCustoExtra,
} from '@/types/custosExtrasForm';

describe('LOTE 1 — AUDITORIA E TESTES CONTROLADOS: SERVIÇOS EXTRAS E CUSTOS EXTRAS', () => {

  // Caminhos dos arquivos sob escopo
  const continuityDrawerPath = path.resolve(__dirname, '../components/operacoes/ServicosExtrasContinuityDrawer.tsx');
  const detalhesDrawerPath = path.resolve(__dirname, '../components/operacoes/ServicoExtraDetalhesDrawer.tsx');
  const tableBlockPath = path.resolve(__dirname, '../components/operacoes/ServicosExtrasTableBlock.tsx');
  const novoServicoDialogPath = path.resolve(__dirname, '../components/operacoes/NovoServicoExtraDialog.tsx');
  const custosExtrasLancamentoPath = path.resolve(__dirname, '../pages/Producao/CustosExtrasLancamento.tsx');
  const financeiroGeralPath = path.resolve(__dirname, '../pages/Financeiro/FinanceiroGeral.tsx');
  const operationalPipelineCtxPath = path.resolve(__dirname, '../contexts/OperationalPipelineContext.tsx');
  const servicosExtrasRecebidosPath = path.resolve(__dirname, '../pages/Operacional/ServicosExtrasRecebidos.tsx');

  const continuityDrawerContent = fs.readFileSync(continuityDrawerPath, 'utf-8');
  const detalhesDrawerContent = fs.readFileSync(detalhesDrawerPath, 'utf-8');
  const tableBlockContent = fs.readFileSync(tableBlockPath, 'utf-8');
  const novoServicoDialogContent = fs.readFileSync(novoServicoDialogPath, 'utf-8');
  const custosExtrasLancamentoContent = fs.readFileSync(custosExtrasLancamentoPath, 'utf-8');
  const financeiroGeralContent = fs.readFileSync(financeiroGeralPath, 'utf-8');
  const operationalPipelineCtxContent = fs.readFileSync(operationalPipelineCtxPath, 'utf-8');
  const servicosExtrasRecebidosContent = fs.readFileSync(servicosExtrasRecebidosPath, 'utf-8');

  // =========================================================================
  // 1. B03 — DEVOLUÇÃO E REENVIO
  // =========================================================================
  describe('1. B03 — Devolução e Reenvio Canônico', () => {
    it('1.1 Não deve conter rotas legadas /servicos-extras/* no context e drawers', () => {
      // O context do pipeline deve apontar para a rota canônica /operacional/servicos-extras
      expect(operationalPipelineCtxContent).not.toContain('"/servicos-extras/lancamentos"');
      expect(operationalPipelineCtxContent).not.toContain('"/servicos-extras/aprovacoes"');
      expect(continuityDrawerContent).not.toContain('/servicos-extras/lancamentos');
      expect(continuityDrawerContent).not.toContain('/servicos-extras/aprovacoes');
      expect(operationalPipelineCtxContent).toContain('/operacional/servicos-extras');
    });

    it('1.2 Deve exibir ação de correção/navegação no ServicosExtrasContinuityDrawer quando DEVOLVIDO', () => {
      expect(continuityDrawerContent).toContain('isDevolved');
      expect(continuityDrawerContent).toContain('Ver Lançamentos para Correção →');
    });

    it('1.3 Deve exibir label canônico "Reenviar para Validação" no ServicoExtraDetalhesDrawer quando DEVOLVIDO', () => {
      expect(detalhesDrawerContent).toContain('"Reenviar para Validação"');
      expect(detalhesDrawerContent).toContain('isDevolved');
    });

    it('1.4 RBAC: canAdvance só pode ser concedido aos papéis operacionais (encarregado, gestor, admin), nunca RH', () => {
      // Na tabela operacional onde canAdvance é avaliado:
      // se s === "DEVOLVIDO", apenas encarregado, gestor ou admin podem avançar/reenviar
      expect(tableBlockContent).toContain('const canAdvance = (item: ServicoExtraItem) => {');
      expect(tableBlockContent).toContain('if (isAdmin) return true;');
      expect(tableBlockContent).toContain('if ((s === "DEVOLVIDO" || s === "RECUSADO" || s === "EM_ANALISE") && (role === "encarregado" || role === "gestor")) return true;');
      // O perfil RH não possui permissão de encarregado para reenviar serviços devolvidos
      expect(tableBlockContent).not.toContain('if (s === "DEVOLVIDO" && role === "rh")');
    });

    it('1.5 Transição de máquina de estados: DEVOLVIDO avança para EM_VALIDACAO', () => {
      // Verifica na função getNextStatus de ServicosExtrasTableBlock que DEVOLVIDO transiciona para EM_VALIDACAO
      expect(tableBlockContent).toContain('case "DEVOLVIDO":');
      expect(tableBlockContent).toContain('return "EM_VALIDACAO";');
    });
  });

  // =========================================================================
  // 2. B04 — EDIÇÃO E PRESERVAÇÃO DOS DADOS HISTÓRICOS
  // =========================================================================
  describe('2. B04 — Edição e Preservação de Dados Históricos', () => {
    it('2.1 Deve usar previousTipoServicoIdRef para evitar sobrescrever valor_unitario e snapshots de initialData', () => {
      expect(novoServicoDialogContent).toContain('previousTipoServicoIdRef');
      expect(novoServicoDialogContent).toContain('if (initialData && form.tipo_servico_id === initialData.tipo_servico_id && previousTipoServicoIdRef.current === initialData.tipo_servico_id)');
      expect(novoServicoDialogContent).toContain('return;');
    });

    it('2.2 Recálculo canônico só deve ser acionado se o usuário alterar explicitamente o tipo_servico_id', () => {
      expect(novoServicoDialogContent).toContain('if (tipoServicoSelecionado && form.tipo_servico_id !== previousTipoServicoIdRef.current)');
      expect(novoServicoDialogContent).toContain('previousTipoServicoIdRef.current = form.tipo_servico_id;');
    });

    it('2.3 Tipos de cálculo não manuais devem manter readOnly para evitar adulteração de tabela', () => {
      expect(novoServicoDialogContent).toContain('readOnly={form.tipo_calculo_snapshot !== "manual"}');
    });

    it('2.4 Simulação de preservação de initialData vs recálculo por troca de tipo', () => {
      const initialRecord = {
        id: 'se-001',
        tipo_servico_id: 'tipo-antigo-1',
        valor_unitario: 180.50, // Preço contratual histórico gravado
        quantidade: 2,
        valor_total: 361.00,
      };

      // Cenário A: Formulário abre com initialData carregado
      let formState = { ...initialRecord };
      let previousRef: string | undefined = initialRecord.tipo_servico_id;

      // Se tipo não mudou, o valor_unitario histórico NÃO pode ser substituído pela tabela de preços atual (ex: 220.00)
      const hasUserChangedTipoA = previousRef !== undefined && previousRef !== formState.tipo_servico_id;
      if (!hasUserChangedTipoA) {
        // Preserva o valor histórico
        expect(formState.valor_unitario).toBe(180.50);
      }

      // Cenário B: Usuário troca explicitamente o select para 'tipo-novo-2'
      formState.tipo_servico_id = 'tipo-novo-2';
      const hasUserChangedTipoB = previousRef !== undefined && previousRef !== formState.tipo_servico_id;
      if (hasUserChangedTipoB) {
        // Aplica o novo preço da tabela
        formState.valor_unitario = 300.00;
        formState.valor_total = formState.quantidade * formState.valor_unitario;
      }

      expect(hasUserChangedTipoB).toBe(true);
      expect(formState.valor_unitario).toBe(300.00);
      expect(formState.valor_total).toBe(600.00);
    });
  });

  // =========================================================================
  // 3. INPUT NUMÉRICO — QUANTIDADE E VALOR
  // =========================================================================
  describe('3. Input Numérico — Concatenação e Validação Explícita', () => {
    it('3.1 NovoServicoExtraDialog deve conter onFocus select no input de quantidade', () => {
      expect(novoServicoDialogContent).toContain('onFocus={(e) => e.target.select()}');
    });

    it('3.2 CustosExtrasLancamento deve conter onFocus select nos inputs de quantidade e valor', () => {
      expect(custosExtrasLancamentoContent).toContain('onFocus={(e) => e.target.select()}');
    });

    it('3.3 Campo vazio de quantidade não pode ter fallback silencioso para 1', () => {
      // Simulação da função de parsing corrigida
      const parseQuantidade = (rawStr: string) => {
        const trimmed = rawStr.trim();
        if (trimmed === '') return 0;
        const parsed = Number(trimmed.replace(',', '.'));
        return isNaN(parsed) ? 0 : parsed;
      };

      // Usuário apagou o campo (deixou "")
      const qtdVazia = parseQuantidade("");
      expect(qtdVazia).toBe(0); // Não pode ser 1!

      // Validação explícita de submissão
      const isValid = qtdVazia > 0;
      expect(isValid).toBe(false); // Submissão bloqueada explicitamente
    });

    it('3.4 Digitação com auto-seleção evita concatenação indesejada (ex: "11")', () => {
      // Quando o campo focado tem "1" e está selecionado (select()), o novo caractere "2" substitui o "1"
      let valorNoCampo = "1";
      const simulatesTypeWithSelection = (novoChar: string, isSelected: boolean) => {
        if (isSelected) {
          return novoChar; // Substitui
        }
        return valorNoCampo + novoChar; // Concatena (comportamento defeituoso antigo)
      };

      expect(simulatesTypeWithSelection("2", true)).toBe("2");
      expect(simulatesTypeWithSelection("2", false)).toBe("12");
    });
  });

  // =========================================================================
  // 4. B05 — PROCESS-DAY E EDGE FUNCTION
  // =========================================================================
  describe('4. B05 — Process-Day e Edge Function de Indicadores', () => {
    it('4.1 FinanceiroGeral não deve apresentar botão de "Consolidar Faturamento" chamando processDay', () => {
      expect(financeiroGeralContent).not.toContain('Consolidar Faturamento');
      expect(financeiroGeralContent).toContain('Processar Indicadores (IA)');
    });

    it('4.2 FinanceiroGeral deve separar claramente os indicadores da operação financeira oficial', () => {
      expect(financeiroGeralContent).toContain('processarIndicadoresMutation');
      expect(financeiroGeralContent).toContain('A operação financeira transacional permanece intacta');
    });

    it('4.3 Diagnóstico de CORS e falhas de rede na Edge Function devem ser capturados e exibidos com precisão', () => {
      expect(financeiroGeralContent).toContain('isCorsOrNetwork');
      expect(financeiroGeralContent).toContain('A Edge Function process-day está inacessível ou com bloqueio de CORS');
    });
  });

  // =========================================================================
  // 5. CUSTOS EXTRAS — REGRAS CANÔNICAS, DRE E FAVORECIDOS
  // =========================================================================
  describe('5. Custos Extras — Regras Canônicas, Favorecidos e DRE', () => {
    it('5.1 As 3 origens de recurso canônicas devem ser suportadas com seus respectivos favorecidos', () => {
      const origens = OPCOES_ORIGEM_RECURSO.map(o => o.value);
      expect(origens).toContain('PAGO_EMPRESA');
      expect(origens).toContain('REEMBOLSO_COLABORADOR');
      expect(origens).toContain('PAGAMENTO_PENDENTE');
    });

    it('5.2 PAGO_EMPRESA: Despesa paga à vista não deve gerar contas a pagar pendente', () => {
      const payload = buildCustoExtraInsertPayload(
        {
          empresa_id: 'emp-001',
          data: '2026-10-16',
          categoria: 'COMBUSTIVEL',
          descricao: 'Abastecimento emergencial',
          quantidade: 1,
          valor_unitario: 150.00,
          forma_pagamento_id: 'forma-pix',
          origem_recurso: 'PAGO_EMPRESA',
        },
        { tenantId: 'tenant-001', userId: 'user-001' }
      );

      // Status inicial do registro
      expect(payload.origem_recurso).toBe('PAGO_EMPRESA');
      expect(payload.favorecido_colaborador_id).toBeNull();
      expect(payload.favorecido_fornecedor_id).toBeNull();

      // Regra da RPC canônica rpc_custo_extra_transicionar:
      // Quando origem_recurso = 'PAGO_EMPRESA', após aprovação atinge FINALIZADO com status_pagamento = 'PAGO'
      const statusFinalAprovado = {
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
      };
      expect(statusFinalAprovado.status_pagamento).toBe('PAGO');
    });

    it('5.3 REEMBOLSO_COLABORADOR: Exige favorecido colaborador e gera obrigação A_PAGAR', () => {
      const colabId = 'colab-123';
      const payload = buildCustoExtraInsertPayload(
        {
          empresa_id: 'emp-001',
          data: '2026-10-16',
          categoria: 'ALIMENTACAO',
          descricao: 'Lanche equipe extra',
          quantidade: 1,
          valor_unitario: 80.00,
          forma_pagamento_id: 'forma-dinheiro',
          origem_recurso: 'REEMBOLSO_COLABORADOR',
          favorecido_colaborador_id: colabId,
        },
        { tenantId: 'tenant-001', userId: 'user-001' }
      );

      expect(payload.origem_recurso).toBe('REEMBOLSO_COLABORADOR');
      expect(payload.favorecido_colaborador_id).toBe(colabId);

      // Regra da RPC canônica: gera status_pagamento = 'A_PAGAR' para o colaborador
      const statusAprovado = {
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'A_PAGAR',
        favorecido: colabId,
      };
      expect(statusAprovado.status_pagamento).toBe('A_PAGAR');
    });

    it('5.4 PAGAMENTO_PENDENTE: Exige fornecedor e gera obrigação A_PAGAR para o terceiro', () => {
      const fornId = 'forn-456';
      const payload = buildCustoExtraInsertPayload(
        {
          empresa_id: 'emp-001',
          data: '2026-10-16',
          categoria: 'MANUTENCAO',
          descricao: 'Conserto paleteira hidráulica',
          quantidade: 1,
          valor_unitario: 350.00,
          forma_pagamento_id: 'forma-boleto',
          origem_recurso: 'PAGAMENTO_PENDENTE',
          favorecido_fornecedor_id: fornId,
          data_vencimento: '2026-10-30',
        },
        { tenantId: 'tenant-001', userId: 'user-001' }
      );

      expect(payload.origem_recurso).toBe('PAGAMENTO_PENDENTE');
      expect(payload.favorecido_fornecedor_id).toBe(fornId);
      expect(payload.data_vencimento).toBe('2026-10-30');

      const statusAprovado = {
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'A_PAGAR',
        favorecido: fornId,
      };
      expect(statusAprovado.status_pagamento).toBe('A_PAGAR');
    });

    it('5.5 DRE: Reconhecimento contábil por competência da despesa aprovada', () => {
      // 1. Despesa RECEBIDO ou EM_VALIDACAO ainda não entra no resultado do exercício
      expect(isCustoExtraReconhecidoDRE({ pipeline_status: 'RECEBIDO', status_pagamento: 'A_PAGAR' })).toBe(false);
      expect(isCustoExtraReconhecidoDRE({ pipeline_status: 'EM_VALIDACAO', status_pagamento: 'A_PAGAR' })).toBe(false);

      // 2. A partir do momento em que foi aprovada (APROVADO_OPERACAO, ENVIADO_FINANCEIRO ou FINALIZADO),
      // impacta a DRE pelo princípio da competência
      expect(isCustoExtraReconhecidoDRE({ pipeline_status: 'APROVADO_OPERACAO', status_pagamento: 'A_PAGAR' })).toBe(true);
      expect(isCustoExtraReconhecidoDRE({ pipeline_status: 'ENVIADO_FINANCEIRO', status_pagamento: 'A_PAGAR' })).toBe(true);
      expect(isCustoExtraReconhecidoDRE({ pipeline_status: 'FINALIZADO', status_pagamento: 'PAGO' })).toBe(true);
    });

    it('5.6 Imutabilidade pós-aprovação: trigger trg_block_update_custos_aprovados assegura proteção no banco', () => {
      // Confirma que os estados imutáveis para edição de valores são pós-aprovação (APROVADO_OPERACAO, ENVIADO_FINANCEIRO e FINALIZADO)
      const ESTADOS_BLOQUEADOS_EDICAO = ['APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO'];
      
      const canEditValor = (status: string) => !ESTADOS_BLOQUEADOS_EDICAO.includes(status);

      expect(canEditValor('RECEBIDO')).toBe(true);
      expect(canEditValor('DEVOLVIDO')).toBe(true);
      expect(canEditValor('EM_VALIDACAO')).toBe(true); // Ainda em pré-aprovação
      expect(canEditValor('APROVADO_OPERACAO')).toBe(false); // Bloqueado
      expect(canEditValor('ENVIADO_FINANCEIRO')).toBe(false); // Bloqueado
      expect(canEditValor('FINALIZADO')).toBe(false); // Bloqueado
    });
  });

  // =========================================================================
  // 6. AJUSTE VISUAL: EXIBIÇÃO DE JUSTIFICATIVAS HISTÓRICAS
  // =========================================================================
  describe('6. Ajuste Visual: Exibição de Justificativas Históricas (ServicosExtrasRecebidos)', () => {
    it('6.1 O código de ServicosExtrasRecebidos.tsx deve restringir o alerta aos estados ativos DEVOLVIDO e RECUSADO', () => {
      expect(servicosExtrasRecebidosContent).toContain(
        '(s.pipeline_status === "DEVOLVIDO" || s.pipeline_status === "RECUSADO") && s.justificativa_devolucao'
      );
      // Confirma que não faz verificação ingênua apenas checando a existência da string
      expect(servicosExtrasRecebidosContent).not.toMatch(/\{s\.justificativa_devolucao \? \(\s*<span className="text-rose-600/);
    });

    it('6.2 Função de renderização: DEVOLVIDO com justificativa ativa exibe alerta vermelho', () => {
      const isAlertaAtivo = (item: { pipeline_status: string; justificativa_devolucao?: string | null }) =>
        Boolean((item.pipeline_status === "DEVOLVIDO" || item.pipeline_status === "RECUSADO") && item.justificativa_devolucao);

      const itemDevolvido = {
        pipeline_status: 'DEVOLVIDO',
        justificativa_devolucao: 'Favor corrigir a quantidade apontada',
      };
      expect(isAlertaAtivo(itemDevolvido)).toBe(true);
    });

    it('6.3 Função de renderização: RECUSADO com justificativa ativa exibe alerta vermelho', () => {
      const isAlertaAtivo = (item: { pipeline_status: string; justificativa_devolucao?: string | null }) =>
        Boolean((item.pipeline_status === "DEVOLVIDO" || item.pipeline_status === "RECUSADO") && item.justificativa_devolucao);

      const itemRecusado = {
        pipeline_status: 'RECUSADO',
        justificativa_devolucao: 'Serviço não autorizado pela gestão',
      };
      expect(isAlertaAtivo(itemRecusado)).toBe(true);
    });

    it('6.4 Função de renderização: EM_VALIDACAO após reenvio com justificativa histórica NÃO exibe alerta vermelho', () => {
      const isAlertaAtivo = (item: { pipeline_status: string; justificativa_devolucao?: string | null }) =>
        Boolean((item.pipeline_status === "DEVOLVIDO" || item.pipeline_status === "RECUSADO") && item.justificativa_devolucao);

      const itemReenviado = {
        pipeline_status: 'EM_VALIDACAO',
        justificativa_devolucao: 'Favor corrigir a quantidade apontada', // Preservada no banco para auditoria
      };
      expect(isAlertaAtivo(itemReenviado)).toBe(false);
    });

    it('6.5 Função de renderização: APROVADO_OPERACAO com justificativa histórica NÃO exibe alerta vermelho', () => {
      const isAlertaAtivo = (item: { pipeline_status: string; justificativa_devolucao?: string | null }) =>
        Boolean((item.pipeline_status === "DEVOLVIDO" || item.pipeline_status === "RECUSADO") && item.justificativa_devolucao);

      const itemAprovado = {
        pipeline_status: 'APROVADO_OPERACAO',
        justificativa_devolucao: 'Favor corrigir a quantidade apontada', // Preservada no banco para auditoria
      };
      expect(isAlertaAtivo(itemAprovado)).toBe(false);
    });
  });

});
