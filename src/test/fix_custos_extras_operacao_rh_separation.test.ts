import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getRouteAccessRule,
  canAccessModule,
  buildPresetPermissions,
} from '../lib/access-control';

describe('FIX — CUSTOS EXTRAS: RESTAURAÇÃO DA ESTEIRA ADMIN E SEGREGAÇÃO', () => {
  describe('1. Portal Operacional (Encarregado)', () => {
    it('CustosExtrasLancamento deve usar fallback /producao em useContextualReturn', () => {
      const filePath = path.resolve(__dirname, '../pages/Producao/CustosExtrasLancamento.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useContextualReturn("/producao")');
      expect(content).not.toContain('useContextualReturn("/operacional/custos-extras")');
    });
  });

  describe('2. Semântica Operacional em CustosExtrasTableBlock', () => {
    const tableBlockPath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
    const tableContent = fs.readFileSync(tableBlockPath, 'utf-8');

    it('getPipelineStatusConfig não deve conter referências hardcoded a RH ou CNAB', () => {
      const fnStartIndex = tableContent.indexOf('const getPipelineStatusConfig =');
      const fnEndIndex = tableContent.indexOf('const buildEditForm =', fnStartIndex);
      const fnCode = tableContent.substring(fnStartIndex, fnEndIndex);

      expect(fnCode).not.toContain('RH');
      expect(fnCode).not.toContain('CNAB');
      expect(fnCode).toContain('Em validação operacional');
      expect(fnCode).toContain('Aprovado Operação');
      expect(fnCode).toContain('Enviado ao Financeiro');
    });

    it('botão Devolver deve passar o objeto item completo para handleDevolvePipeline', () => {
      expect(tableContent).toContain('handleDevolvePipeline(item)');
      expect(tableContent).not.toMatch(/handleDevolvePipeline\(\s*item\.id\s*\)/);
    });
  });

  describe('3. Restauração de CustosExtrasRecebidos como Inbox do Admin', () => {
    it('CustosExtrasRecebidos deve funcionar como Inbox administrativo puro sob AppShell', () => {
      const pagePath = path.resolve(__dirname, '../pages/Operacional/CustosExtrasRecebidos.tsx');
      const pageContent = fs.readFileSync(pagePath, 'utf-8');

      expect(pageContent).not.toContain('isApprovalView');
      expect(pageContent).not.toContain('Custos Extras — Validação & Aprovação');
      expect(pageContent).toContain('title="Custos Extras Recebidos"');
      expect(pageContent).toContain('badge="ENTRADAS / CAPTURA"');
      expect(pageContent).toContain('<CustosExtrasTableBlock data={custosExtras} />');
    });
  });

  describe('4. Restauração da Mesa Canônica de Aprovação (AprovacoesRh)', () => {
    it('App.tsx deve apontar /custos-extras/aprovacoes para AprovacoesRh com CUSTO EXTRA travado', () => {
      const appPath = path.resolve(__dirname, '../App.tsx');
      const appContent = fs.readFileSync(appPath, 'utf-8');

      expect(appContent).toContain('path="/custos-extras/aprovacoes" element={<AuthGuard><AprovacoesRh flowType="CUSTO EXTRA" lockedFlow={true} /></AuthGuard>}');
      expect(appContent).not.toContain('path="/custos-extras/aprovacoes" element={<AuthGuard><CustosExtrasRecebidos');
    });

    it('Sidebar.tsx deve associar Aprovações de Custos Extras a processamento_rh (coerente com a mesa de aprovação)', () => {
      const sidebarPath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');
      const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

      const custosExtrasIndex = sidebarContent.indexOf('id: "custos_extras"');
      const nextSectionIndex = sidebarContent.indexOf('// --- MÓDULOS TRANSVERSAIS', custosExtrasIndex);
      const custosExtrasBlock = sidebarContent.substring(custosExtrasIndex, nextSectionIndex);

      expect(custosExtrasBlock).toContain('{ icon: Shield, label: "Aprovações", to: "/custos-extras/aprovacoes", module: "processamento_rh" }');
    });
  });

  describe('5. Segregação de Acesso às Rotas (Encarregado vs Admin)', () => {
    const encarregadoPerms = buildPresetPermissions('encarregado');
    const adminPerms = buildPresetPermissions('admin');

    it('ENCARREGADO: permitido no Portal Operacional (/producao/*)', () => {
      const rule = getRouteAccessRule('/producao/custos-extras');
      expect(rule).toBeDefined();
      expect(rule?.module).toBe('central_operacional');
      expect(canAccessModule(encarregadoPerms, rule!.module, rule?.action || 'ver')).toBe(true);

      const ruleServicos = getRouteAccessRule('/producao/servicos-extras');
      expect(ruleServicos).toBeDefined();
      expect(canAccessModule(encarregadoPerms, ruleServicos!.module, ruleServicos?.action || 'ver')).toBe(true);
    });

    it('ENCARREGADO: BLOQUEADO nas telas administrativas de Custos Extras', () => {
      // /custos-extras/lancamentos
      const ruleLancamentos = getRouteAccessRule('/custos-extras/lancamentos');
      expect(ruleLancamentos).toBeDefined();
      expect(canAccessModule(encarregadoPerms, ruleLancamentos!.module, ruleLancamentos?.action || 'ver')).toBe(false);

      // /custos-extras/aprovacoes
      const ruleAprovacoes = getRouteAccessRule('/custos-extras/aprovacoes');
      expect(ruleAprovacoes).toBeDefined();
      expect(ruleAprovacoes?.module).toBe('processamento_rh');
      expect(canAccessModule(encarregadoPerms, ruleAprovacoes!.module, ruleAprovacoes?.action || 'ver')).toBe(false);

      // /operacional/custos-extras
      const ruleOperacional = getRouteAccessRule('/operacional/custos-extras');
      expect(ruleOperacional).toBeDefined();
      expect(canAccessModule(encarregadoPerms, ruleOperacional!.module, ruleOperacional?.action || 'ver')).toBe(false);
    });

    it('ENCARREGADO: BLOQUEADO nas telas administrativas equivalentes de Serviços Extras', () => {
      // /servicos-extras/lancamentos
      const ruleLancamentos = getRouteAccessRule('/servicos-extras/lancamentos');
      expect(ruleLancamentos).toBeDefined();
      expect(canAccessModule(encarregadoPerms, ruleLancamentos!.module, ruleLancamentos?.action || 'ver')).toBe(false);

      // /servicos-extras/aprovacoes
      const ruleAprovacoes = getRouteAccessRule('/servicos-extras/aprovacoes');
      expect(ruleAprovacoes).toBeDefined();
      expect(ruleAprovacoes?.module).toBe('processamento_rh');
      expect(canAccessModule(encarregadoPerms, ruleAprovacoes!.module, ruleAprovacoes?.action || 'ver')).toBe(false);

      // /operacional/servicos-extras
      const ruleOperacional = getRouteAccessRule('/operacional/servicos-extras');
      expect(ruleOperacional).toBeDefined();
      expect(canAccessModule(encarregadoPerms, ruleOperacional!.module, ruleOperacional?.action || 'ver')).toBe(false);
    });

    it('ADMIN: ACESSO TOTAL permitido a todas as rotas operacionais e administrativas', () => {
      const routes = [
        '/custos-extras/lancamentos',
        '/custos-extras/aprovacoes',
        '/operacional/custos-extras',
        '/servicos-extras/lancamentos',
        '/servicos-extras/aprovacoes',
        '/producao/custos-extras',
      ];

      for (const route of routes) {
        const rule = getRouteAccessRule(route);
        expect(rule).toBeDefined();
        // Admin permissions allow all modules
        expect(canAccessModule(adminPerms, rule!.module, rule?.action || 'ver')).toBe(true);
      }
    });
  });
});
