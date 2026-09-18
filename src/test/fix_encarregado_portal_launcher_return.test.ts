import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  sanitizeReturnPath,
  isAllowedOperationalReturn,
} from '../hooks/useContextualReturn';
import {
  getRouteAccessRule,
  canAccessModule,
  buildPresetPermissions,
  getDefaultRouteForRole,
  getAccessDeniedFallbackRoute,
  isRouteForbiddenForRole,
} from '../lib/access-control';

describe('FIX UX — RETORNO PÓS-LANÇAMENTO E CANCELAMENTO DO ENCARREGADO', () => {
  describe('1. Rota Canônica do Launcher e Componente de Opções', () => {
    it('LancamentoProducao.tsx deve renderizar o OperationalShell com título Lançamento Operacional e fallback /producao', () => {
      const filePath = path.resolve(__dirname, '../pages/LancamentoProducao.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('title="Lançamento Operacional"');
      expect(content).toContain('useContextualReturn("/producao")');
      expect(content).not.toContain('useContextualReturn("/operacoes-volume")');
    });

    it('FormStepSelector.tsx deve conter exatamente os 6 cards do Passo 1 de Opções', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/lancamento/FormStepSelector.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // 1. Operação por Volume — À Vista
      expect(content).toContain('Operação por Volume — À Vista');
      expect(content).toContain('id: "operacao_padrao_vista"');

      // 2. Operação por Volume — Boleto/Faturamento
      expect(content).toContain('Operação por Volume — Boleto/Faturamento');
      expect(content).toContain('id: "operacao_padrao_prazo"');

      // 3. Serviços Extras
      expect(content).toContain('Serviços Extras');
      expect(content).toContain('id: "servicos_extras"');

      // 4. Custos / Despesas
      expect(content).toContain('Custos / Despesas');
      expect(content).toContain('id: "custos_operacionais"');

      // 5. Diaristas
      expect(content).toContain('Diaristas');
      expect(content).toContain('id: "diaristas"');

      // 6. Períodos Operacionais
      expect(content).toContain('Períodos Operacionais');
      expect(content).toContain('id: "servicos_especificos"');
    });
  });

  describe('2. Sanitização Centralizada em useContextualReturn (Guarda do Encarregado)', () => {
    const encarregadoRole = 'encarregado';
    const adminRole = 'admin';

    it('isAllowedOperationalReturn deve validar apenas rotas dentro de /producao', () => {
      expect(isAllowedOperationalReturn('/producao')).toBe(true);
      expect(isAllowedOperationalReturn('/producao/custos-extras')).toBe(true);
      expect(isAllowedOperationalReturn('/producao?competencia=2026-09')).toBe(true);

      // Rotas administrativas ou fora de /producao
      expect(isAllowedOperationalReturn('/operacional/custos-extras')).toBe(false);
      expect(isAllowedOperationalReturn('/custos-extras/lancamentos')).toBe(false);
      expect(isAllowedOperationalReturn('/central')).toBe(false);
      expect(isAllowedOperationalReturn('/operacoes-volume')).toBe(false);
      expect(isAllowedOperationalReturn('/rh/aprovacoes')).toBe(false);
      expect(isAllowedOperationalReturn('//evil.com')).toBe(false);
      expect(isAllowedOperationalReturn(null)).toBe(false);
    });

    it('ENCARREGADO: Deve sanitizar returnTo administrativo para /producao', () => {
      // Tentativas de desvio para AppShell administrativo
      const adminTargets = [
        '/operacional/custos-extras',
        '/custos-extras/lancamentos',
        '/custos-extras/aprovacoes',
        '/operacional/servicos-extras',
        '/servicos-extras/lancamentos',
        '/servicos-extras/aprovacoes',
        '/central',
        '/operacoes-volume',
        '/operacional/diaristas',
        '/rh/aprovacoes',
      ];

      for (const target of adminTargets) {
        const result = sanitizeReturnPath(encarregadoRole, target, undefined, '/producao');
        expect(result).toBe('/producao');
      }
    });

    it('ENCARREGADO: Deve sanitizar fallback administrativo para /producao', () => {
      // Se um código tentar passar fallback admin
      const result = sanitizeReturnPath(encarregadoRole, null, '/operacoes-volume', '/producao');
      expect(result).toBe('/producao');

      const resultDiaristas = sanitizeReturnPath(encarregadoRole, null, '/operacional/diaristas', '/producao');
      expect(resultDiaristas).toBe('/producao');
    });

    it('ENCARREGADO: Deve preservar returnTo operacional válido sob /producao', () => {
      const validTarget = '/producao?origem=wizard';
      const result = sanitizeReturnPath(encarregadoRole, validTarget, undefined, '/producao');
      expect(result).toBe('/producao?origem=wizard');
    });

    it('ADMIN: Deve preservar returnTo e fallbacks administrativos', () => {
      const adminTarget = '/custos-extras/lancamentos';
      const result = sanitizeReturnPath(adminRole, adminTarget, undefined, '/operacional/dashboard');
      expect(result).toBe('/custos-extras/lancamentos');

      const fallbackResult = sanitizeReturnPath(adminRole, null, '/operacional/custos-extras', '/operacional/dashboard');
      expect(fallbackResult).toBe('/operacional/custos-extras');
    });
  });

  describe('3. Auditoria dos Formulários do Portal do Encarregado', () => {
    it('CustosExtrasLancamento.tsx deve usar fallback /producao', () => {
      const filePath = path.resolve(__dirname, '../pages/Producao/CustosExtrasLancamento.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useContextualReturn("/producao")');
      expect(content).not.toContain('useContextualReturn("/operacional/custos-extras")');
    });

    it('ServicosExtrasLancamento.tsx deve usar fallback /producao e retornar no onSuccess', () => {
      const filePath = path.resolve(__dirname, '../pages/Producao/ServicosExtrasLancamento.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useContextualReturn("/producao")');
      expect(content).not.toContain('useContextualReturn("/operacional/servicos-extras")');
      expect(content).toContain('goBackUrl("/producao")');
    });

    it('DiaristasLancamento.tsx deve usar fallback /producao e showBack={true}', () => {
      const filePath = path.resolve(__dirname, '../pages/Producao/DiaristasLancamento.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useContextualReturn("/producao")');
      expect(content).not.toContain('useContextualReturn("/operacional/diaristas")');
      expect(content).toContain('showBack={true}');
    });

    it('ServicosEspecificosLancamento.tsx deve usar fallback /producao e showBack={true}', () => {
      const filePath = path.resolve(__dirname, '../pages/Producao/ServicosEspecificosLancamento.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useContextualReturn("/producao")');
      expect(content).toContain('navigate(\'/producao\')');
      expect(content).toContain('showBack={true}');
    });
  });

  describe('4. Governança: Encarregado permanece bloqueado nas telas administrativas', () => {
    const encarregadoPerms = buildPresetPermissions('encarregado');

    it('Encarregado NÃO pode acessar telas administrativas de Custos, Serviços e Operações', () => {
      const blockedRoutes = [
        '/custos-extras/lancamentos',
        '/custos-extras/aprovacoes',
        '/operacional/custos-extras',
        '/servicos-extras/lancamentos',
        '/servicos-extras/aprovacoes',
        '/operacional/servicos-extras',
        '/operacoes-volume',
        '/operacional/diaristas',
      ];

      for (const route of blockedRoutes) {
        const rule = getRouteAccessRule(route);
        expect(rule).toBeDefined();
        expect(canAccessModule(encarregadoPerms, rule!.module, rule?.action || 'ver')).toBe(false);
      }
    });

    it('Encarregado PODE acessar as rotas operacionais do launcher (/producao/*)', () => {
      const operationalRoutes = [
        '/producao',
        '/producao/custos-extras',
        '/producao/servicos-extras',
        '/producao/diaristas',
        '/producao/servicos-especificos',
      ];

      for (const route of operationalRoutes) {
        const rule = getRouteAccessRule(route);
        expect(rule).toBeDefined();
        expect(canAccessModule(encarregadoPerms, rule!.module, rule?.action || 'ver')).toBe(true);
      }
    });
  });

  describe('5. Decisão Canônica Centralizada de Destino por Perfil', () => {
    it('getDefaultRouteForRole: encarregado deve retornar estritamente /producao', () => {
      expect(getDefaultRouteForRole('encarregado')).toBe('/producao');
      expect(getDefaultRouteForRole('ENCARREGADO')).toBe('/producao');
    });

    it('getDefaultRouteForRole: demais perfis devem retornar /operacional/dashboard', () => {
      expect(getDefaultRouteForRole('admin')).toBe('/operacional/dashboard');
      expect(getDefaultRouteForRole('rh')).toBe('/operacional/dashboard');
      expect(getDefaultRouteForRole('financeiro')).toBe('/operacional/dashboard');
      expect(getDefaultRouteForRole('gestor')).toBe('/operacional/dashboard');
      expect(getDefaultRouteForRole('user')).toBe('/operacional/dashboard');
      expect(getDefaultRouteForRole(null)).toBe('/operacional/dashboard');
      expect(getDefaultRouteForRole(undefined)).toBe('/operacional/dashboard');
    });

    it('getAccessDeniedFallbackRoute: encarregado deve retornar estritamente /producao', () => {
      expect(getAccessDeniedFallbackRoute('encarregado')).toBe('/producao');
    });

    it('getAccessDeniedFallbackRoute: demais perfis devem retornar /central', () => {
      expect(getAccessDeniedFallbackRoute('admin')).toBe('/central');
      expect(getAccessDeniedFallbackRoute('rh')).toBe('/central');
      expect(getAccessDeniedFallbackRoute('financeiro')).toBe('/central');
      expect(getAccessDeniedFallbackRoute(null)).toBe('/central');
    });

    it('isRouteForbiddenForRole: /central e subrotas devem ser estritamente bloqueadas para encarregado', () => {
      expect(isRouteForbiddenForRole('encarregado', '/central')).toBe(true);
      expect(isRouteForbiddenForRole('encarregado', '/central/pendencias')).toBe(true);
      expect(isRouteForbiddenForRole('encarregado', '/producao')).toBe(false);
      expect(isRouteForbiddenForRole('encarregado', '/producao/custos-extras')).toBe(false);
    });

    it('isRouteForbiddenForRole: /central permanece acessível para admin e outros perfis', () => {
      expect(isRouteForbiddenForRole('admin', '/central')).toBe(false);
      expect(isRouteForbiddenForRole('admin', '/central/pendencias')).toBe(false);
      expect(isRouteForbiddenForRole('rh', '/central')).toBe(false);
      expect(isRouteForbiddenForRole('financeiro', '/central')).toBe(false);
    });
  });

  describe('6. Login Operacional e Rota Raiz Centralizada', () => {
    it('LoginOperacional.tsx deve navegar utilizando getDefaultRouteForRole("encarregado")', () => {
      const filePath = path.resolve(__dirname, '../pages/Auth/LoginOperacional.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('getDefaultRouteForRole("encarregado")');
    });

    it('App.tsx deve definir RootRedirect centralizado utilizando useAccessControl e getDefaultRouteForRole', () => {
      const filePath = path.resolve(__dirname, '../App.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('const RootRedirect: React.FC');
      expect(content).toContain('const destination = getDefaultRouteForRole(role);');
      expect(content).toContain('<Route path="/" element={<AuthGuard><RootRedirect /></AuthGuard>} />');
      expect(content).toContain('<Route path="/operacional" element={<AuthGuard><RootRedirect /></AuthGuard>} />');
    });
  });

  describe('7. OperacaoForm e OperationalPipelineModal Segregation', () => {
    it('OperacaoForm.tsx: apenas mode === "admin" deve disparar openPipeline com ações administrativas', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/lancamento/OperacaoForm.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Admin dispara pipeline modal nativo
      expect(content).toContain('if (mode === "admin" && !data?.isEdit && (form.getValues().tipo_lancamento === \'volume\' || !form.getValues().tipo_lancamento))');
      // No modo encarregado, deve apenas resetar para o passo 1
      expect(content).toContain('setEtapa(1);');
      expect(content).toContain('form.reset(DEFAULT_PRODUCTION_VALUES);');
    });

    it('OperationalPipelineModal.tsx: nextAction deve ser estritamente bloqueada para Encarregado fora de /producao', () => {
      const filePath = path.resolve(__dirname, '../components/layout/OperationalPipelineModal.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('!rawNextAction.route.startsWith("/producao")');
      expect(content).not.toContain('!rawNextAction.route.startsWith("/operacional/dashboard")');
    });
  });

  describe('8. Simulação de Navegação e Tentativas de Acesso (Matriz de Requisitos)', () => {
    const encarregadoPerms = buildPresetPermissions('encarregado');

    it('1. Login Encarregado → deve ir para /producao', () => {
      const destination = getDefaultRouteForRole('encarregado');
      expect(destination).toBe('/producao');
    });

    it('2. Encarregado acessa / → deve ser despachado para /producao', () => {
      const destination = getDefaultRouteForRole('encarregado');
      expect(destination).toBe('/producao');
    });

    it('3. Encarregado tenta acessar /central → deve ser bloqueado e redirecionado para /producao', () => {
      const isForbidden = isRouteForbiddenForRole('encarregado', '/central');
      expect(isForbidden).toBe(true);
      const fallback = getAccessDeniedFallbackRoute('encarregado');
      expect(fallback).toBe('/producao');
    });

    it('4. Encarregado tenta /custos-extras/aprovacoes → deve ter acesso negado e redirecionar para /producao', () => {
      const rule = getRouteAccessRule('/custos-extras/aprovacoes');
      expect(rule).toBeDefined();
      expect(rule!.module).toBe('processamento_rh');
      const canAccess = canAccessModule(encarregadoPerms, rule!.module, rule?.action || 'ver');
      expect(canAccess).toBe(false);

      const fallback = getAccessDeniedFallbackRoute('encarregado');
      expect(fallback).toBe('/producao');
    });

    it('5. Refresh em /producao → permissão concedida, não bloqueado, continua no launcher', () => {
      const isForbidden = isRouteForbiddenForRole('encarregado', '/producao');
      expect(isForbidden).toBe(false);

      const rule = getRouteAccessRule('/producao');
      expect(rule).toBeDefined();
      expect(canAccessModule(encarregadoPerms, rule!.module, 'ver')).toBe(true);
    });

    it('6. Admin acessa /central normalmente', () => {
      const isForbidden = isRouteForbiddenForRole('admin', '/central');
      expect(isForbidden).toBe(false);

      const adminPerms = buildPresetPermissions('admin');
      const rule = getRouteAccessRule('/central');
      expect(rule).toBeDefined();
      expect(canAccessModule(adminPerms, rule!.module, 'ver')).toBe(true);
    });
  });
});
