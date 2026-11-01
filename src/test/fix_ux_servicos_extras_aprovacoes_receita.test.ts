import { describe, it, expect } from 'vitest';
import { formatDateTime, formatDateOnly } from '../utils/financeiro';
import fs from 'fs';
import path from 'path';

describe('FIX UX — SERVIÇOS EXTRAS / APROVAÇÕES / RECEITA', () => {
  describe('1. Aprovações Contextualizadas & Context Mode', () => {
    it('deve ter rotas contextuais com flowType e lockedFlow configurados no App.tsx', () => {
      const appContent = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
      
      // Serviços Extras -> SERVIÇO EXTRA travado
      expect(appContent).toContain('path="/servicos-extras/aprovacoes"');
      expect(appContent).toContain('flowType="SERVIÇO EXTRA"');
      
      // Custos Extras -> CUSTO EXTRA travado
      expect(appContent).toContain('path="/custos-extras/aprovacoes"');
      expect(appContent).toContain('flowType="CUSTO EXTRA"');
      
      // Diaristas -> DIARISTA travado
      expect(appContent).toContain('path="/diaristas/aprovacoes"');
      expect(appContent).toContain('flowType="DIARISTA"');
      
      // RH -> Global sem trava
      expect(appContent).toMatch(/path="\/rh\/aprovacoes"\s+element=\{<AuthGuard><AprovacoesRh\s*\/>/);
    });

    it('deve ter links contextuais na Sidebar para cada submódulo', () => {
      const sidebarContent = fs.readFileSync(path.resolve(__dirname, '../components/layout/Sidebar.tsx'), 'utf-8');
      
      expect(sidebarContent).toContain('to: "/servicos-extras/aprovacoes"');
      expect(sidebarContent).toContain('to: "/custos-extras/aprovacoes"');
      expect(sidebarContent).toContain('to: "/diaristas/aprovacoes"');
      expect(sidebarContent).toContain('to: "/rh/aprovacoes"');
    });

    it('AprovacoesRh deve sincronizar filterType e ocultar seleção de pills em modo travado', () => {
      const aprovacoesContent = fs.readFileSync(path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx'), 'utf-8');
      
      // Suporte a useSearchParams e props
      expect(aprovacoesContent).toContain('useSearchParams');
      expect(aprovacoesContent).toContain('const isLocked = lockedFlow ?? (searchParams.get("locked") === "true" || !!effectiveFlowType);');
      expect(aprovacoesContent).toContain('!isLocked && (');
      expect(aprovacoesContent).toContain('Aprovações — ${currentTypeLabel}');
    });
  });

  describe('2. Aprovação Individual × Lote', () => {
    it('o botão em lote deve estar nomeado como "Aprovar Selecionados"', () => {
      const aprovacoesContent = fs.readFileSync(path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx'), 'utf-8');
      
      expect(aprovacoesContent).toContain('Aprovar Selecionados');
      expect(aprovacoesContent).not.toContain('Validar Selecionados');
    });

    it('ambos individual e lote devem convergir para a mesma aprovarMutation', () => {
      const aprovacoesContent = fs.readFileSync(path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx'), 'utf-8');
      
      // Batch chama aprovarMutation.mutateAsync
      expect(aprovacoesContent).toContain('await aprovarMutation.mutateAsync(item);');
      // Individual chama aprovarMutation.mutate
      expect(aprovacoesContent).toContain('aprovarMutation.mutate(activeItem');
    });
  });

  describe('3. Timestamp do Drawer em Formato Humano', () => {
    it('formatDateTime deve formatar timestamp ISO respeitando fuso operacional', () => {
      // Data ISO real de teste homologado
      const isoTimestamp = '2026-09-17T14:02:40.227295+00:00';
      const formatted = formatDateTime(isoTimestamp);
      
      // Em timezone operacional UTC-3 (Horário de Brasília): 14:02 UTC = 11:02 local
      expect(formatted).toMatch(/^17\/09\/2026 às \d{2}:\d{2}$/);
      // Se executado em fuso BRT (-03:00):
      const d = new Date(isoTimestamp);
      const expectedHour = d.getHours().toString().padStart(2, '0');
      const expectedMin = d.getMinutes().toString().padStart(2, '0');
      expect(formatted).toBe(`17/09/2026 às ${expectedHour}:${expectedMin}`);
    });

    it('formatDateTime deve tratar valores nulos ou inválidos graciosamente', () => {
      expect(formatDateTime(null)).toBe('-');
      expect(formatDateTime(undefined)).toBe('-');
      expect(formatDateTime('')).toBe('-');
    });

    it('drawer deve renderizar "Recebido em" utilizando formatDateTime', () => {
      const aprovacoesContent = fs.readFileSync(path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx'), 'utf-8');
      expect(aprovacoesContent).toContain('label="Recebido em" value={formatDateTime((item as any).dataRecebimento || item.data_recebimento)}');
    });
  });

  describe('4. PDF — Serviço Extra: Coluna Neutra e Data Real', () => {
    it('deve usar cabeçalho neutro "Descrição" no lugar de "Descrição da Operação"', () => {
      const pdfContent = fs.readFileSync(path.resolve(__dirname, '../utils/pdfCobranca.ts'), 'utf-8');
      expect(pdfContent).toContain('head: [["Data", "Descrição", "Qtd", "V. Unitário", "Subtotal"]]');
      expect(pdfContent).not.toContain('head: [["Data", "Descrição da Operação", "Qtd", "V. Unitário", "Subtotal"]]');
    });

    it('deve usar se.data || se.data_servico para exibir a data real do Serviço Extra', () => {
      const pdfContent = fs.readFileSync(path.resolve(__dirname, '../utils/pdfCobranca.ts'), 'utf-8');
      expect(pdfContent).toContain('const dataSeStr = formatDateOnly(se.data || se.data_servico);');
    });

    it('formatDateOnly deve formatar a data real do Serviço Extra sem timezone drift', () => {
      const seMock = { data: '2026-09-17', data_servico: null };
      const formatted = formatDateOnly(seMock.data || seMock.data_servico);
      expect(formatted).toBe('17/09/2026');
    });
  });

  describe('5. CTA Sequencial da Receita (Antes e Depois da Emissão)', () => {
    it('ModalReceitaOperacional deve computar hasDocumentoGerado a partir do estado canônico ou histórico', () => {
      const modalContent = fs.readFileSync(path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'), 'utf-8');
      expect(modalContent).toContain("const hasDocumentoGerado = receita.status === 'cobranca_gerada' || Boolean(historico?.some((h: any) => h.acao === 'GERAR_COBRANCA' || h.acao === 'Cobrança Gerada'));");
    });

    it('handleConfirmGerarCobranca deve registrar GERAR_COBRANCA no histórico sem mutar para cobranca_gerada', () => {
      const modalContent = fs.readFileSync(path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'), 'utf-8');
      expect(modalContent).toContain("acao: 'GERAR_COBRANCA'");
      expect(modalContent).not.toContain("updateStatusMutation.mutate('cobranca_gerada',");
    });

    it('ReceitasPipeline deve normalizar cobranca_gerada para a coluna de cobrança gerada', () => {
      const pipelineContent = fs.readFileSync(path.resolve(__dirname, '../pages/Financeiro/ReceitasPipeline.tsx'), 'utf-8');
      expect(pipelineContent).toContain("if (st === 'cobranca_gerada') {");
      expect(pipelineContent).toContain("st = 'pendente_cobranca';");
    });
  });
});
