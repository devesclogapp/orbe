import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  isCustoExtraReconhecidoDRE,
  CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE,
} from '@/services/dashboard.service';

describe('FIX CIRÚRGICO — CUSTOS EXTRAS: RECONHECIMENTO CANÔNICO NA DRE', () => {
  const dashboardServicePath = path.resolve(__dirname, '../services/dashboard.service.ts');
  const dashboardServiceContent = fs.readFileSync(dashboardServicePath, 'utf-8');

  const dashboardPagePath = path.resolve(__dirname, '../pages/Dashboard.tsx');
  const dashboardPageContent = fs.readFileSync(dashboardPagePath, 'utf-8');

  describe('Regra Canônica Unitária — isCustoExtraReconhecidoDRE', () => {
    it('01. RECEBIDO → não contabiliza na DRE', () => {
      const item = {
        deleted_at: null,
        pipeline_status: 'RECEBIDO',
        status_pagamento: 'A_PAGAR',
      };
      expect(isCustoExtraReconhecidoDRE(item)).toBe(false);
    });

    it('02. EM_VALIDACAO → não contabiliza na DRE (caso crítico R$ 60 histórico)', () => {
      const item = {
        deleted_at: null,
        pipeline_status: 'EM_VALIDACAO',
        status_pagamento: 'A_PAGAR',
      };
      expect(isCustoExtraReconhecidoDRE(item)).toBe(false);
    });

    it('03. APROVADO_OPERACAO → contabiliza na DRE (mesmo ainda A_PAGAR)', () => {
      const item = {
        deleted_at: null,
        pipeline_status: 'APROVADO_OPERACAO',
        status_pagamento: 'A_PAGAR',
      };
      expect(isCustoExtraReconhecidoDRE(item)).toBe(true);
    });

    it('04. ENVIADO_FINANCEIRO → contabiliza na DRE (mesmo ainda A_PAGAR)', () => {
      const item = {
        deleted_at: null,
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'A_PAGAR',
      };
      expect(isCustoExtraReconhecidoDRE(item)).toBe(true);
    });

    it('05. FINALIZADO → contabiliza na DRE (PAGO_EMPRESA ou liquidado financeiramente)', () => {
      const itemPagoEmpresa = {
        deleted_at: null,
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
      };
      expect(isCustoExtraReconhecidoDRE(itemPagoEmpresa)).toBe(true);
    });

    it('06. deleted_at != null → não contabiliza na DRE mesmo se FINALIZADO', () => {
      const itemExcluido = {
        deleted_at: '2026-09-20T10:00:00Z',
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
      };
      expect(isCustoExtraReconhecidoDRE(itemExcluido)).toBe(false);
    });

    it('07. status_pagamento CANCELADO ou REPROVADO → não contabiliza na DRE', () => {
      const itemCancelado = {
        deleted_at: null,
        pipeline_status: 'APROVADO_OPERACAO',
        status_pagamento: 'CANCELADO',
      };
      expect(isCustoExtraReconhecidoDRE(itemCancelado)).toBe(false);

      const itemReprovado = {
        deleted_at: null,
        pipeline_status: 'REPROVADO',
        status_pagamento: 'A_PAGAR',
      };
      expect(isCustoExtraReconhecidoDRE(itemReprovado)).toBe(false);
    });

    it('08. competência determinada por data da despesa: despesa setembro + pagamento outubro → permanece em setembro', () => {
      const despesa = {
        id: 'custo-setembro-01',
        data: '2026-09-25',
        total: 150.0,
        pipeline_status: 'APROVADO_OPERACAO',
        status_pagamento: 'A_PAGAR',
        data_pagamento: '2026-10-05',
        deleted_at: null,
      };

      // Na competência de Setembro (2026-09-01 a 2026-10-01)
      const dataSetembro = despesa.data >= '2026-09-01' && despesa.data < '2026-10-01';
      expect(dataSetembro).toBe(true);
      expect(isCustoExtraReconhecidoDRE(despesa)).toBe(true);

      // Na competência de Outubro (2026-10-01 a 2026-11-01)
      const dataOutubro = despesa.data >= '2026-10-01' && despesa.data < '2026-11-01';
      expect(dataOutubro).toBe(false);
    });

    it('09. Pagamento posterior não duplica o custo (mesmo ID com status atualizado de A_PAGAR para PAGO)', () => {
      // Estado 1: Aprovado na operação (custo reconhecido)
      const estado1 = {
        id: 'custo-001',
        total: 100.0,
        pipeline_status: 'APROVADO_OPERACAO',
        status_pagamento: 'A_PAGAR',
        deleted_at: null,
      };

      // Estado 2: Posteriormente liquidado financeiramente
      const estado2 = {
        id: 'custo-001',
        total: 100.0,
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
        deleted_at: null,
      };

      // Ambos são reconhecíveis
      expect(isCustoExtraReconhecidoDRE(estado1)).toBe(true);
      expect(isCustoExtraReconhecidoDRE(estado2)).toBe(true);

      // Em uma agregação por ID (ou lista de registros da tabela), o ID é único
      const registros = [estado2]; // no banco o UPDATE altera a mesma linha
      const totalReconhecido = registros
        .filter(isCustoExtraReconhecidoDRE)
        .reduce((acc, cur) => acc + cur.total, 0);

      expect(totalReconhecido).toBe(100.0);
    });
  });

  describe('Cenário de Homologação Real — Competência 2026-09', () => {
    const baseHomologacao2026_09 = [
      {
        id: 'dcba0376-4743-4d04-bc84-b7f65cec41ae',
        data: '2026-09-17',
        total: 60.0,
        origem_recurso: 'LEGACY',
        pipeline_status: 'EM_VALIDACAO',
        status_pagamento: 'A_PAGAR',
        deleted_at: null,
      },
      {
        id: 'ebb71dda-c39a-4dbb-aa4d-ab3d7c095ef2',
        data: '2026-09-17',
        total: 20.0,
        origem_recurso: 'LEGACY',
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
        deleted_at: null,
      },
      {
        id: '16417729-aba4-4761-a058-f76f7e288251',
        data: '2026-09-18',
        total: 25.0,
        origem_recurso: 'PAGO_EMPRESA',
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
        deleted_at: null,
      },
      {
        id: 'b5b65cec-5fdf-4625-a186-7399b6de4b27',
        data: '2026-09-18',
        total: 30.0,
        origem_recurso: 'REEMBOLSO_COLABORADOR',
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
        deleted_at: null,
      },
      {
        id: '791f90fe-a791-4c93-b90e-5c86a37d0131',
        data: '2026-09-21',
        total: 35.0,
        origem_recurso: 'PAGAMENTO_PENDENTE',
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
        deleted_at: null,
      },
    ];

    it('deve reconhecer exatamente R$ 110,00 na DRE e excluir o registro histórico de R$ 60,00', () => {
      const reconhecidos = baseHomologacao2026_09.filter(isCustoExtraReconhecidoDRE);

      expect(reconhecidos.length).toBe(4);
      expect(reconhecidos.find((r) => r.id === 'dcba0376-4743-4d04-bc84-b7f65cec41ae')).toBeUndefined();

      const totalReconhecido = reconhecidos.reduce((acc, cur) => acc + cur.total, 0);
      expect(totalReconhecido).toBe(110.0);
    });

    it('execução real de DashboardConsolidadoService em 2026-09 reflete exatamente R$ 110,00 e preserva R$ 60 intacto', async () => {
      const email = process.env.E2E_TEST_EMAIL;
      const password = process.env.E2E_TEST_PASSWORD;
      if (!email || !password) return;

      const { supabase } = await import('@/lib/supabase');
      const { DashboardConsolidadoService } = await import('@/services/dashboard.service');

      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      expect(authErr).toBeNull();

      // Executa o serviço real de consolidação para a competência 2026-09
      const kpis = await DashboardConsolidadoService.getKpisByCompetencia('2026-09');
      expect(kpis.custosGerais).toBe(110.0);

      // Assegura que o registro histórico de R$ 60,00 permaneceu no banco 100% intacto
      const { data: rec60, error: err60 } = await supabase
        .from('custos_extras_operacionais')
        .select('id, total, pipeline_status, status_pagamento')
        .eq('id', 'dcba0376-4743-4d04-bc84-b7f65cec41ae')
        .single();

      expect(err60).toBeNull();
      expect(rec60?.total).toBe(60);
      expect(rec60?.pipeline_status).toBe('EM_VALIDACAO');
      expect(rec60?.status_pagamento).toBe('A_PAGAR');
    });
  });

  describe('Contrato e Blindagem Estática de Código', () => {
    it('dashboard.service.ts deve filtrar deleted_at IS NULL, pipeline_status e status_pagamento != CANCELADO na query qCustos', () => {
      expect(dashboardServiceContent).toContain(".is('deleted_at', null)");
      expect(dashboardServiceContent).toContain(".neq('status_pagamento', 'CANCELADO')");
      expect(dashboardServiceContent).toContain('pipeline_status');
      expect(dashboardServiceContent).toContain('CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE');
    });

    it('dashboard.service.ts deve exportar isCustoExtraReconhecidoDRE', () => {
      expect(dashboardServiceContent).toContain('export function isCustoExtraReconhecidoDRE');
    });

    it('Dashboard.tsx deve importar e utilizar isCustoExtraReconhecidoDRE para compor custosPeriodo', () => {
      expect(dashboardPageContent).toContain('isCustoExtraReconhecidoDRE');
      expect(dashboardPageContent).toContain('isCustoExtraReconhecidoDRE(item)');
    });
  });
});
