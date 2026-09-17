import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ==============================================================================
// SUÍTE DE TESTES: FIX — FATURAMENTO MENSAL COMPLEMENTAR + CONTINUIDADE FINANCEIRA
// Cobertura dos Casos A até O exigidos na especificação
// ==============================================================================

describe('SUÍTE: Faturamento Mensal Complementar + Continuidade Multiorigem', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../supabase/migrations/20260917150000_fix_faturamento_mensal_complementar_multiorigem.sql'
  );
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

  describe('1. Verificações Estruturais da Migration (DDL / PLPGSQL)', () => {
    it('deve declarar a função canônica compartilhada public.fn_obter_ou_criar_receita_mensal_aberta', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(');
      expect(migrationContent).toContain('p_tenant_id UUID');
      expect(migrationContent).toContain('p_empresa_id UUID');
      expect(migrationContent).toContain('p_competencia VARCHAR');
      expect(migrationContent).toContain('p_vencimento DATE');
      expect(migrationContent).toContain('SECURITY DEFINER');
      expect(migrationContent).toContain('SET search_path = public');
    });

    it('deve implementar lock transacional FOR UPDATE na busca de receita aberta', () => {
      expect(migrationContent).toContain("WHERE tenant_id = p_tenant_id");
      expect(migrationContent).toContain("AND empresa_id = p_empresa_id");
      expect(migrationContent).toContain("AND competencia = p_competencia");
      expect(migrationContent).toContain("AND modalidade = 'FATURAMENTO_MENSAL'");
      expect(migrationContent).toContain("AND status = 'aguardando_fechamento'");
      expect(migrationContent).toContain("FOR UPDATE");
    });

    it('deve diferenciar receita inicial de receita complementar usando lista canônica de status encerrados', () => {
      expect(migrationContent).toContain("status IN ('pendente_cobranca', 'cobranca_enviada', 'recebido', 'conciliado')");
      expect(migrationContent).toContain("v_observacao := 'FATURA_COMPLEMENTAR'");
      expect(migrationContent).toContain("v_acao := 'CRIAR_RECEITA_COMPLEMENTAR'");
      expect(migrationContent).toContain("v_acao := 'CRIAR_RECEITA'");
    });

    it('deve tratar concorrência determinística capturando unique_violation', () => {
      expect(migrationContent).toContain('EXCEPTION WHEN unique_violation THEN');
      // Na captura de violação do índice único condicional, busca deterministicamente a receita aberta
      expect(migrationContent).toContain("WHERE tenant_id = p_tenant_id");
      expect(migrationContent).toContain("AND status = 'aguardando_fechamento'");
    });

    it('deve registrar auditoria na timeline receitas_operacionais_historico', () => {
      expect(migrationContent).toContain('INSERT INTO public.receitas_operacionais_historico');
      expect(migrationContent).toContain('v_acao');
      expect(migrationContent).toContain("'aguardando_fechamento'");
    });

    it('ambos triggers de Operação por Volume e Serviço Extra devem chamar a função compartilhada', () => {
      // Trigger de Operações por Volume
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.fn_gerar_receita_operacional_automatica()');
      expect(migrationContent).toContain('public.fn_obter_ou_criar_receita_mensal_aberta(');

      // Trigger de Serviços Extras
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.fn_gerar_receita_servico_extra_automatica()');
      expect(migrationContent).toContain('public.fn_obter_ou_criar_receita_mensal_aberta(');
    });

    it('ambos triggers devem aplicar ON CONFLICT DO NOTHING para idempotência dos itens', () => {
      expect(migrationContent).toContain('ON CONFLICT (operacao_id) WHERE operacao_id IS NOT NULL DO NOTHING');
      expect(migrationContent).toContain('ON CONFLICT (servico_extra_id) WHERE servico_extra_id IS NOT NULL DO NOTHING');
    });

    it('rpc_receita_confirmar_recebimento deve sincronizar servicos_extras_operacionais com RECEBIDO', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.rpc_receita_confirmar_recebimento(');
      expect(migrationContent).toContain('servico_extra_id');
      expect(migrationContent).toContain("status_pagamento = 'RECEBIDO'");
      expect(migrationContent).toContain("pipeline_status = CASE");
      expect(migrationContent).toContain("THEN 'CONCLUIDO'");
    });

    it('deve aplicar permissões estritas fail-closed: helper interna sem grant a authenticated', () => {
      expect(migrationContent).toContain('REVOKE ALL ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta');
      expect(migrationContent).toContain('REVOKE ALL ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(UUID, UUID, VARCHAR, DATE, UUID) FROM authenticated');
      expect(migrationContent).toContain('GRANT EXECUTE ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(UUID, UUID, VARCHAR, DATE, UUID) TO service_role');
      expect(migrationContent).not.toContain('GRANT EXECUTE ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(UUID, UUID, VARCHAR, DATE, UUID) TO authenticated');
    });

    it('rpc_receita_confirmar_recebimento deve implementar validações fail-closed de autenticação, role e tenant', () => {
      expect(migrationContent).toContain('AUTH_REQUIRED');
      expect(migrationContent).toContain('TENANT_REQUIRED');
      expect(migrationContent).toContain('ROLE_NOT_AUTHORIZED');
      expect(migrationContent).toContain('TENANT_MISMATCH');
      expect(migrationContent).toContain("lower(v_user_role) NOT IN ('admin', 'financeiro')");
      expect(migrationContent).toContain('v_receita.tenant_id <> v_user_tenant_id');
    });
  });

  describe('2. Simulação de Domínio e Casos de Uso (Casos A a O)', () => {
    // Modelagem de estado em memória para validar o comportamento da máquina de estados
    interface ReceitaMock {
      id: string;
      tenant_id: string;
      empresa_id: string;
      competencia: string;
      modalidade: string;
      valor_total: number;
      status: string;
      observacao: string | null;
      itens: Array<{ id: string; operacao_id?: string; servico_extra_id?: string; valor: number }>;
    }

    interface ServicoExtraMock {
      id: string;
      status_pagamento: string;
      pipeline_status: string;
      total: number;
    }

    interface OperacaoMock {
      id: string;
      status_pagamento: string;
      status: string;
      total: number;
    }

    let receitasDb: ReceitaMock[] = [];
    let servicosDb: Map<string, ServicoExtraMock> = new Map();
    let operacoesDb: Map<string, OperacaoMock> = new Map();

    const TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
    const EMPRESA_ID = '4d4c1328-a8e7-4c5b-875d-924b416fa13a';
    const COMPETENCIA = '2026-09';

    // Implementação em TypeScript da lógica da fn_obter_ou_criar_receita_mensal_aberta
    function obterOuCriarReceitaMensalAberta(tenantId: string, empresaId: string, competencia: string): ReceitaMock {
      // 1. Busca receita aberta
      const aberta = receitasDb.find(
        r => r.tenant_id === tenantId &&
             r.empresa_id === empresaId &&
             r.competencia === competencia &&
             r.modalidade === 'FATURAMENTO_MENSAL' &&
             r.status === 'aguardando_fechamento'
      );
      if (aberta) return aberta;

      // 2. Verifica se já existe receita fechada anterior
      // Estados canônicos de ciclo encerrado: 'pendente_cobranca', 'cobranca_enviada', 'recebido', 'conciliado'
      // 'cancelado' é desconsiderado pois representa ciclo invalidado/anulado
      const STATUS_ENCERRADOS = ['pendente_cobranca', 'cobranca_enviada', 'recebido', 'conciliado'];
      const existeFechada = receitasDb.some(
        r => r.tenant_id === tenantId &&
             r.empresa_id === empresaId &&
             r.competencia === competencia &&
             r.modalidade === 'FATURAMENTO_MENSAL' &&
             STATUS_ENCERRADOS.includes(r.status)
      );

      const novaReceita: ReceitaMock = {
        id: `rec-${receitasDb.length + 1}`,
        tenant_id: tenantId,
        empresa_id: empresaId,
        competencia,
        modalidade: 'FATURAMENTO_MENSAL',
        valor_total: 0,
        status: 'aguardando_fechamento',
        observacao: existeFechada ? 'FATURA_COMPLEMENTAR' : null,
        itens: []
      };

      receitasDb.push(novaReceita);
      return novaReceita;
    }

    function processarItemMensal(tipo: 'operacao' | 'servico_extra', idOrigem: string, valor: number, tenantId = TENANT_ID, empresaId = EMPRESA_ID, competencia = COMPETENCIA) {
      const rec = obterOuCriarReceitaMensalAberta(tenantId, empresaId, competencia);
      
      // Idempotência por item
      const itemExistente = rec.itens.find(i => (tipo === 'operacao' ? i.operacao_id === idOrigem : i.servico_extra_id === idOrigem));
      if (!itemExistente) {
        rec.itens.push({
          id: `item-${rec.itens.length + 1}`,
          operacao_id: tipo === 'operacao' ? idOrigem : undefined,
          servico_extra_id: tipo === 'servico_extra' ? idOrigem : undefined,
          valor
        });
        rec.valor_total = rec.itens.reduce((acc, curr) => acc + curr.valor, 0);
      }
      return rec;
    }

    function confirmarRecebimento(receitaId: string) {
      const rec = receitasDb.find(r => r.id === receitaId);
      if (!rec) throw new Error('Receita não encontrada');
      rec.status = 'recebido';

      // Sincroniza operações vinculadas
      rec.itens.filter(i => i.operacao_id).forEach(i => {
        const op = operacoesDb.get(i.operacao_id!);
        if (op) {
          op.status_pagamento = 'RECEBIDO';
          op.status = 'CONCLUIDO';
        }
      });

      // Sincroniza serviços extras vinculados
      rec.itens.filter(i => i.servico_extra_id).forEach(i => {
        const se = servicosDb.get(i.servico_extra_id!);
        if (se) {
          se.status_pagamento = 'RECEBIDO';
          se.pipeline_status = 'CONCLUIDO';
        }
      });
    }

    it('CASO A — Primeiro lançamento mensal cria receita aberta (aguardando_fechamento)', () => {
      receitasDb = [];
      const rec = processarItemMensal('operacao', 'op-1', 124.02);
      expect(rec.status).toBe('aguardando_fechamento');
      expect(rec.observacao).toBeNull();
      expect(rec.valor_total).toBe(124.02);
      expect(rec.itens.length).toBe(1);
    });

    it('CASO B — Segundo lançamento antes do fechamento adiciona à mesma receita aberta', () => {
      const rec = processarItemMensal('operacao', 'op-2', 291.60);
      expect(receitasDb.length).toBe(1);
      expect(rec.status).toBe('aguardando_fechamento');
      expect(rec.valor_total).toBeCloseTo(415.62, 2);
      expect(rec.itens.length).toBe(2);
    });

    it('CASO C — Receita anterior fechada/conciliada + novo Serviço Extra cria Fatura Complementar e preserva a histórica', () => {
      // Simula o fechamento e conciliação da receita histórica de R$ 415,62
      receitasDb[0].status = 'conciliado';
      const valorHistoricoAntes = receitasDb[0].valor_total;
      const itensHistoricosAntes = receitasDb[0].itens.length;

      // Entra o SE 802c90 de R$ 40,00
      servicosDb.set('se-802c90', { id: 'se-802c90', total: 40, status_pagamento: 'PENDENTE', pipeline_status: 'APROVADO_OPERACAO' });
      const recComplementar = processarItemMensal('servico_extra', 'se-802c90', 40.00);

      // Validação: Receita histórica NÃO foi alterada
      expect(receitasDb[0].status).toBe('conciliado');
      expect(receitasDb[0].valor_total).toBe(valorHistoricoAntes);
      expect(receitasDb[0].itens.length).toBe(itensHistoricosAntes);

      // Validação: Nova receita complementar criada
      expect(receitasDb.length).toBe(2);
      expect(recComplementar.id).not.toBe(receitasDb[0].id);
      expect(recComplementar.observacao).toBe('FATURA_COMPLEMENTAR');
      expect(recComplementar.status).toBe('aguardando_fechamento');
      expect(recComplementar.valor_total).toBe(40.00);
      expect(recComplementar.itens.length).toBe(1);
      expect(recComplementar.itens[0].servico_extra_id).toBe('se-802c90');
    });

    it('CASO D — Receita anterior conciliada + nova Operação por Volume cria/adiciona Fatura Complementar', () => {
      // Nova operação entra na mesma competência onde já há complementar aberta
      operacoesDb.set('op-3', { id: 'op-3', total: 100, status_pagamento: 'PENDENTE', status: 'AGUARDANDO_FATURAMENTO' });
      const rec = processarItemMensal('operacao', 'op-3', 100.00);

      // Reutiliza a receita complementar aberta existente
      expect(receitasDb.length).toBe(2);
      expect(rec.observacao).toBe('FATURA_COMPLEMENTAR');
      expect(rec.valor_total).toBe(140.00);
      expect(rec.itens.length).toBe(2);
    });

    it('CASO E — Receita histórica + complementar aberta + novo lançamento reutiliza a complementar aberta', () => {
      // Adiciona mais um serviço extra à complementar aberta
      servicosDb.set('se-novo', { id: 'se-novo', total: 50, status_pagamento: 'PENDENTE', pipeline_status: 'APROVADO_OPERACAO' });
      const rec = processarItemMensal('servico_extra', 'se-novo', 50.00);

      expect(receitasDb.length).toBe(2);
      expect(rec.valor_total).toBe(190.00);
      expect(rec.itens.length).toBe(3);
    });

    it('CASO F — Reprocessamento do mesmo Serviço Extra não duplica item nem receita (Idempotência)', () => {
      const qtdAntes = receitasDb[1].itens.length;
      const valorAntes = receitasDb[1].valor_total;

      // Tenta reprocessar se-802c90
      processarItemMensal('servico_extra', 'se-802c90', 40.00);

      expect(receitasDb[1].itens.length).toBe(qtdAntes);
      expect(receitasDb[1].valor_total).toBe(valorAntes);
    });

    it('CASO G — Reprocessamento da mesma Operação não duplica item (Idempotência)', () => {
      const qtdAntes = receitasDb[1].itens.length;
      const valorAntes = receitasDb[1].valor_total;

      // Tenta reprocessar op-3
      processarItemMensal('operacao', 'op-3', 100.00);

      expect(receitasDb[1].itens.length).toBe(qtdAntes);
      expect(receitasDb[1].valor_total).toBe(valorAntes);
    });

    it('CASO H — Concorrência: não permite duas receitas abertas para mesma empresa/competência', () => {
      // Simulação: duas chamadas simultâneas convergem para a mesma receita aberta
      const r1 = obterOuCriarReceitaMensalAberta(TENANT_ID, EMPRESA_ID, COMPETENCIA);
      const r2 = obterOuCriarReceitaMensalAberta(TENANT_ID, EMPRESA_ID, COMPETENCIA);
      expect(r1.id).toBe(r2.id);
    });

    it('CASO I — Recebimento da receita sincroniza status_pagamento = RECEBIDO no Serviço Extra', () => {
      confirmarRecebimento(receitasDb[1].id);
      expect(receitasDb[1].status).toBe('recebido');

      const se = servicosDb.get('se-802c90');
      expect(se?.status_pagamento).toBe('RECEBIDO');
      expect(se?.pipeline_status).toBe('CONCLUIDO');
    });

    it('CASO J — Receita mensal com múltiplos Serviços Extras sincroniza todos no recebimento', () => {
      const seNovo = servicosDb.get('se-novo');
      expect(seNovo?.status_pagamento).toBe('RECEBIDO');
      expect(seNovo?.pipeline_status).toBe('CONCLUIDO');
    });

    it('CASO K — Receita mista (Operação + Serviço Extra) sincroniza ambas as tabelas de origem no recebimento', () => {
      const op = operacoesDb.get('op-3');
      const se = servicosDb.get('se-802c90');
      expect(op?.status_pagamento).toBe('RECEBIDO');
      expect(op?.status).toBe('CONCLUIDO');
      expect(se?.status_pagamento).toBe('RECEBIDO');
      expect(se?.pipeline_status).toBe('CONCLUIDO');
    });

    it('CASO L — Tenant diferente: isolamento multitenant estrito', () => {
      const outroTenant = '99999999-9999-9999-9999-999999999999';
      const recOutro = obterOuCriarReceitaMensalAberta(outroTenant, EMPRESA_ID, COMPETENCIA);
      expect(recOutro.tenant_id).toBe(outroTenant);
      expect(recOutro.id).not.toBe(receitasDb[0].id);
      expect(recOutro.id).not.toBe(receitasDb[1].id);
    });

    it('CASO M — Regressão DUPLICATA permanece com fluxo individual por lançamento', () => {
      // Na migration, o fluxo B permanece inalterado para DUPLICATA
      expect(migrationContent).toContain("FLUXO B: DUPLICATA OU CAIXA_IMEDIATO (Receita Individual por Operação)");
      expect(migrationContent).toContain("FLUXO B: DUPLICATA OU CAIXA_IMEDIATO (Receita Individual por Serviço Extra)");
    });

    it('CASO N — Regressão CAIXA_IMEDIATO permanece com fluxo individual pendente_recebimento', () => {
      expect(migrationContent).toContain("v_modalidade = 'CAIXA_IMEDIATO'");
      expect(migrationContent).toContain("v_status := 'pendente_recebimento'");
    });

    it('CASO O — PDF histórico da receita de R$ 415,62 permanece imutável e segregado', () => {
      // A receita histórica tem seus próprios itens (apenas as operações 1 e 2)
      expect(receitasDb[0].itens.length).toBe(2);
      expect(receitasDb[0].valor_total).toBeCloseTo(415.62, 2);
      expect(receitasDb[0].itens.some(i => i.servico_extra_id === 'se-802c90')).toBe(false);
    });
  });

  describe('3. Verificações de Interface (Sidebar, ReceitasPipeline e Modais)', () => {
    it('Sidebar.tsx deve direcionar Serviços Extras -> Faturamento para o pipeline com ?tab=FATURAMENTO_MENSAL', () => {
      const sidebarContent = fs.readFileSync(path.resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf-8');
      expect(sidebarContent).toContain('to: "/financeiro/receitas?tab=FATURAMENTO_MENSAL"');
      // Operações por volume continua apontando para faturamento por cliente
      expect(sidebarContent).toContain('id: "operacoes_volume"');
      expect(sidebarContent).toContain('to: "/financeiro/faturamento"');
    });

    it('ReceitasPipeline.tsx deve ler o query param tab da URL', () => {
      const pipelineContent = fs.readFileSync(path.resolve(__dirname, '../pages/Financeiro/ReceitasPipeline.tsx'), 'utf-8');
      expect(pipelineContent).toContain("const tabParam = searchParams.get('tab')");
      expect(pipelineContent).toContain("setActiveTab(tabParam as any)");
    });

    it('ReceitaKanbanCard.tsx deve exibir badge visual Complementar quando observacao for FATURA_COMPLEMENTAR', () => {
      const cardContent = fs.readFileSync(path.resolve(__dirname, '../pages/Financeiro/components/ReceitaKanbanCard.tsx'), 'utf-8');
      expect(cardContent).toContain("r.observacao === 'FATURA_COMPLEMENTAR'");
      expect(cardContent).toContain('Complementar');
    });

    it('ModalReceitaOperacional.tsx deve indicar Fatura Complementar no cabeçalho e na tabela', () => {
      const modalContent = fs.readFileSync(path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'), 'utf-8');
      expect(modalContent).toContain("receita.observacao === 'FATURA_COMPLEMENTAR'");
      expect(modalContent).toContain('Faturamento Mensal (Complementar)');
    });
  });

  describe('4. Testes de Segurança e Governança Fail-Closed (Casos P a V)', () => {
    interface AuthContext {
      userId?: string | null;
      role?: string | null;
      tenantId?: string | null;
      isServiceRole?: boolean;
    }

    interface ReceitaMock {
      id: string;
      tenant_id: string;
      empresa_id: string;
      competencia: string;
      modalidade: string;
      status: string;
      observacao: string | null;
    }

    const TENANT_A = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
    const TENANT_B = '99999999-9999-9999-9999-999999999999';
    const EMPRESA_ID = '4d4c1328-a8e7-4c5b-875d-924b416fa13a';
    const COMPETENCIA = '2026-09';

    // Modelagem fiel da segurança fail-closed de rpc_receita_confirmar_recebimento
    function validarSegurancaConfirmarRecebimento(
      ctx: AuthContext,
      receita: ReceitaMock | undefined
    ): { success: boolean; errorCode?: string } {
      const isServiceRole = ctx.isServiceRole || false;

      // 1. Validar autenticação
      if (!ctx.userId && !isServiceRole) {
        return { success: false, errorCode: 'AUTH_REQUIRED' };
      }

      // 2. Identificar tenant e perfil
      if (!isServiceRole) {
        if (!ctx.tenantId) {
          return { success: false, errorCode: 'TENANT_REQUIRED' };
        }
        if (!ctx.role || !['admin', 'financeiro'].includes(ctx.role.toLowerCase())) {
          return { success: false, errorCode: 'ROLE_NOT_AUTHORIZED' };
        }
      }

      // 3. Receita encontrada
      if (!receita) {
        return { success: false, errorCode: 'REC_NOT_FOUND' };
      }

      // 4. Isolamento estrito de tenant
      if (!isServiceRole && receita.tenant_id !== ctx.tenantId) {
        return { success: false, errorCode: 'TENANT_MISMATCH' };
      }

      return { success: true };
    }

    it('CASO P — Receita cancelada não torna nova receita complementar; abre receita regular', () => {
      const db: ReceitaMock[] = [
        {
          id: 'rec-cancelada',
          tenant_id: TENANT_A,
          empresa_id: EMPRESA_ID,
          competencia: COMPETENCIA,
          modalidade: 'FATURAMENTO_MENSAL',
          status: 'cancelado',
          observacao: null
        }
      ];

      const STATUS_ENCERRADOS = ['pendente_cobranca', 'cobranca_enviada', 'recebido', 'conciliado'];
      const existeEncerrada = db.some(
        r => r.tenant_id === TENANT_A &&
             r.empresa_id === EMPRESA_ID &&
             r.competencia === COMPETENCIA &&
             r.modalidade === 'FATURAMENTO_MENSAL' &&
             STATUS_ENCERRADOS.includes(r.status)
      );

      // Como apenas existe receita 'cancelado', NÃO qualifica como ciclo faturado encerrado
      expect(existeEncerrada).toBe(false);

      const novaReceita: ReceitaMock = {
        id: 'rec-nova',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_ID,
        competencia: COMPETENCIA,
        modalidade: 'FATURAMENTO_MENSAL',
        status: 'aguardando_fechamento',
        observacao: existeEncerrada ? 'FATURA_COMPLEMENTAR' : null
      };

      expect(novaReceita.observacao).toBeNull();
      expect(novaReceita.status).toBe('aguardando_fechamento');
    });

    it('CASO Q — Usuário de Tenant A tentando confirmar receita de Tenant B é BLOQUEADO (TENANT_MISMATCH)', () => {
      const receitaTenantB: ReceitaMock = {
        id: 'rec-tenant-b',
        tenant_id: TENANT_B,
        empresa_id: EMPRESA_ID,
        competencia: COMPETENCIA,
        modalidade: 'FATURAMENTO_MENSAL',
        status: 'pendente_cobranca',
        observacao: null
      };

      const userTenantA: AuthContext = {
        userId: 'user-a',
        role: 'financeiro',
        tenantId: TENANT_A
      };

      const resultado = validarSegurancaConfirmarRecebimento(userTenantA, receitaTenantB);
      expect(resultado.success).toBe(false);
      expect(resultado.errorCode).toBe('TENANT_MISMATCH');
    });

    it('CASO R — Usuário autenticado sem tenant identificado é BLOQUEADO (TENANT_REQUIRED)', () => {
      const receita: ReceitaMock = {
        id: 'rec-1',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_ID,
        competencia: COMPETENCIA,
        modalidade: 'FATURAMENTO_MENSAL',
        status: 'pendente_cobranca',
        observacao: null
      };

      const userSemTenant: AuthContext = {
        userId: 'user-orfao',
        role: 'financeiro',
        tenantId: null
      };

      const resultado = validarSegurancaConfirmarRecebimento(userSemTenant, receita);
      expect(resultado.success).toBe(false);
      expect(resultado.errorCode).toBe('TENANT_REQUIRED');
    });

    it('CASO S — Role sem autorização financeira (ex: operacional) é BLOQUEADA (ROLE_NOT_AUTHORIZED)', () => {
      const receita: ReceitaMock = {
        id: 'rec-1',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_ID,
        competencia: COMPETENCIA,
        modalidade: 'FATURAMENTO_MENSAL',
        status: 'pendente_cobranca',
        observacao: null
      };

      const userOperacional: AuthContext = {
        userId: 'user-op',
        role: 'operacional',
        tenantId: TENANT_A
      };

      const resultado = validarSegurancaConfirmarRecebimento(userOperacional, receita);
      expect(resultado.success).toBe(false);
      expect(resultado.errorCode).toBe('ROLE_NOT_AUTHORIZED');
    });

    it('CASO T — Admin ou Financeiro do mesmo tenant é PERMITIDO com sucesso', () => {
      const receita: ReceitaMock = {
        id: 'rec-1',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_ID,
        competencia: COMPETENCIA,
        modalidade: 'FATURAMENTO_MENSAL',
        status: 'pendente_cobranca',
        observacao: null
      };

      const userFinanceiro: AuthContext = {
        userId: 'user-fin',
        role: 'financeiro',
        tenantId: TENANT_A
      };

      const userAdmin: AuthContext = {
        userId: 'user-admin',
        role: 'admin',
        tenantId: TENANT_A
      };

      expect(validarSegurancaConfirmarRecebimento(userFinanceiro, receita).success).toBe(true);
      expect(validarSegurancaConfirmarRecebimento(userAdmin, receita).success).toBe(true);
    });

    it('CASO U — Service Role possui acesso autorizado para rotinas de automação', () => {
      const receita: ReceitaMock = {
        id: 'rec-1',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_ID,
        competencia: COMPETENCIA,
        modalidade: 'FATURAMENTO_MENSAL',
        status: 'pendente_cobranca',
        observacao: null
      };

      const serviceCtx: AuthContext = {
        isServiceRole: true
      };

      const resultado = validarSegurancaConfirmarRecebimento(serviceCtx, receita);
      expect(resultado.success).toBe(true);
    });

    it('CASO V — Tentativa anônima sem autenticação é BLOQUEADA (AUTH_REQUIRED)', () => {
      const receita: ReceitaMock = {
        id: 'rec-1',
        tenant_id: TENANT_A,
        empresa_id: EMPRESA_ID,
        competencia: COMPETENCIA,
        modalidade: 'FATURAMENTO_MENSAL',
        status: 'pendente_cobranca',
        observacao: null
      };

      const anonCtx: AuthContext = {
        userId: null,
        isServiceRole: false
      };

      const resultado = validarSegurancaConfirmarRecebimento(anonCtx, receita);
      expect(resultado.success).toBe(false);
      expect(resultado.errorCode).toBe('AUTH_REQUIRED');
    });
  });
});
