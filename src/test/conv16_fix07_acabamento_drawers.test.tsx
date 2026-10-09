import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'fs';
import path from 'path';
import {
    DrawerReaberturaDiarista,
    DrawerEdicaoDiarista,
    DrawerFechamentoDiarista,
} from '@/components/diaristas/drawers';
import DevDiaristasDrawersPreview from '@/pages/Dev/DevDiaristasDrawersPreview';

vi.mock("@/components/layout/AppShell", () => ({
    AppShell: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'usr-dev-01', email: 'auditor@esclog.com.br' },
        perfil: { id: 'prf-dev-01', full_name: 'Auditor de Homologação UI/UX', role: 'admin' },
        role: 'admin',
        permissoes: [],
    }),
}));

vi.mock('@/contexts/TenantContext', () => ({
    useTenant: () => ({
        tenant: { id: 'tenant-001', name: 'ESC Logística' },
        currentTenant: { id: 'tenant-001', name: 'ESC Logística' },
    }),
}));

vi.mock('@/contexts/AccessControlContext', () => ({
    useAccessControl: () => ({
        can: () => true,
        role: 'admin',
        isSuperAdmin: true,
        permissions: [],
    }),
}));

vi.mock('@/contexts/OperationalPipelineContext', () => ({
    useOperationalPipeline: () => ({
        openPipeline: vi.fn(),
        closePipeline: vi.fn(),
        isOpen: false,
    }),
}));

describe('CONV-16 — FIX 07: Refinamento Visual, Legibilidade e Padronização dos Drawers', () => {

    // ──────────────────────────────────────────────────────────────────────────
    // 1. NOME COMPLETO DO COLABORADOR (Correção A — Edição)
    // ──────────────────────────────────────────────────────────────────────────
    describe('1. Legibilidade do Nome do Colaborador (DrawerEdicaoDiarista)', () => {
        const mockLancamentoLongo = {
            id: 'lanc-hml-nome-longo',
            nome_colaborador: 'Carlos Eduardo da Silva dos Santos Pereira Júnior (Diarista HML)',
            funcao_colaborador: 'Conferente de Carga e Descarga',
            status: 'EM_ABERTO',
            data_lancamento: '2026-10-07',
            codigo_marcacao: 'P',
            quantidade_diaria: 1.0,
            valor_diaria_base: 140.00,
            valor_calculado: 140.00,
            observacao: 'Turno integral',
        };

        it('1.1 Renderiza o nome completo sem classe truncate, com quebra de linha (break-words)', () => {
            render(
                <DrawerEdicaoDiarista
                    isOpen={true}
                    onClose={vi.fn()}
                    lancamento={mockLancamentoLongo}
                    valorAnterior={140.00}
                    onConfirm={vi.fn()}
                    isSimulation={true}
                />
            );

            // Nome completo deve estar presente integralmente no DOM
            const elNome = screen.getByText('Carlos Eduardo da Silva dos Santos Pereira Júnior (Diarista HML)');
            expect(elNome).toBeInTheDocument();
            // Garante que não possui a classe truncate que causava reticências
            expect(elNome.className).not.toContain('truncate');
            expect(elNome.className).toContain('break-words');
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 2. ACESSIBILIDADE DA JUSTIFICATIVA & INTEGRIDADE DO RODAPÉ (Correção B)
    // ──────────────────────────────────────────────────────────────────────────
    describe('2. Acessibilidade da Justificativa e Integridade do Rodapé', () => {
        const mockLancamento = {
            id: 'lanc-hml-01',
            nome_colaborador: 'João da Silva',
            status: 'EM_ABERTO',
            data_lancamento: '2026-10-07',
            codigo_marcacao: 'P',
            quantidade_diaria: 1.0,
            valor_diaria_base: 140.00,
            valor_calculado: 140.00,
        };

        it('2.1 Campo de justificativa possui rótulo, foco, indicador de validação e margem inferior segura (pb-8)', () => {
            const { container } = render(
                <DrawerEdicaoDiarista
                    isOpen={true}
                    onClose={vi.fn()}
                    lancamento={mockLancamento}
                    valorAnterior={140.00}
                    onConfirm={vi.fn()}
                    isSimulation={true}
                />
            );

            expect(screen.getByText(/Motivo da Alteração Administrativa/i)).toBeInTheDocument();
            expect(screen.getByText(/Mínimo 5 caracteres/i)).toBeInTheDocument();

            const textarea = screen.getByPlaceholderText(/Justificativa obrigatória para auditoria/i);
            expect(textarea).toBeInTheDocument();

            // Ao preencher com 5+ caracteres, o indicador visual muda para "Válido"
            fireEvent.change(textarea, { target: { value: 'Ajuste regular' } });
            expect(screen.getByText('Válido')).toBeInTheDocument();

            // Contêiner possui padding inferior para evitar encobrimento pelo rodapé fixo
            const scrollContainer = document.body.querySelector('.space-y-4.pb-8');
            expect(scrollContainer).toBeInTheDocument();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 3. PRESERVAÇÃO DA CONFIRMAÇÃO CRÍTICA "FECHAR" (Correção Alinhamento)
    // ──────────────────────────────────────────────────────────────────────────
    describe('3. Padrão de Confirmação Crítica (DrawerFechamentoDiarista)', () => {
        it('3.1 Campo de confirmação possui alinhamento oficial, destaque da palavra-chave e bloqueio pré-digitação', () => {
            const handleConfirm = vi.fn();
            render(
                <DrawerFechamentoDiarista
                    isOpen={true}
                    onClose={vi.fn()}
                    empresaNome="ESC Logística Homologação"
                    periodoInicio="2026-10-05"
                    periodoFim="2026-10-11"
                    totalEmAberto={6}
                    onConfirm={handleConfirm}
                    isSimulation={true}
                />
            );

            expect(screen.getByText('Confirmação Textual Obrigatória')).toBeInTheDocument();
            expect(screen.getByText('Palavra-chave de segurança:')).toBeInTheDocument();

            const input = screen.getByPlaceholderText('FECHAR');
            expect(input).toBeInTheDocument();
            expect(input.className).toContain('font-mono');

            const btnConfirmar = screen.getByRole('button', { name: /Confirmar e Fechar/i });
            expect(btnConfirmar).toBeDisabled();

            // Digitar FECHAR
            fireEvent.change(input, { target: { value: 'FECHAR' } });
            expect(btnConfirmar).not.toBeDisabled();

            fireEvent.click(btnConfirmar);
            expect(handleConfirm).toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 4. MENSAGENS DIFERENCIADAS PRODUÇÃO VS PREVIEW (Trilha de Governança)
    // ──────────────────────────────────────────────────────────────────────────
    describe('4. Trilha de Governança e Comunicação do Preview', () => {
        const mockLote = {
            id: 'lote-demo-01',
            periodo_inicio: '2026-10-05',
            periodo_fim: '2026-10-11',
            total_registros: 10,
            valor_total: 1400.00,
            status: 'AGUARDANDO_VALIDACAO_RH',
            empresa: { nome: 'ESC Logística' },
        };

        it('4.1 No modo preview (isSimulation=true), informa explicitamente que é demonstrativo e sem persistência', () => {
            render(
                <DrawerReaberturaDiarista
                    isOpen={true}
                    onClose={vi.fn()}
                    lote={mockLote}
                    usuarioNome="Admin"
                    onConfirm={vi.fn()}
                    isSimulation={true}
                />
            );

            expect(screen.getByText(/Ambiente demonstrativo de homologação: nenhuma ação ou justificativa será gravada/i)).toBeInTheDocument();
        });

        it('4.2 No modo produção (isSimulation=false), informa a gravação real nos logs imutáveis', () => {
            render(
                <DrawerReaberturaDiarista
                    isOpen={true}
                    onClose={vi.fn()}
                    lote={mockLote}
                    usuarioNome="Flavio Santos"
                    onConfirm={vi.fn()}
                    isSimulation={false}
                />
            );

            expect(screen.getByText(/Esta ação será registrada com data, hora, usuário \(Flavio Santos\)/i)).toBeInTheDocument();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 5. RESUMO FINANCEIRO (Correção C — Identificação de Prévia)
    // ──────────────────────────────────────────────────────────────────────────
    describe('5. Resumo Financeiro com Identificação de Prévia', () => {
        const mockLancamento = {
            id: 'lanc-demo-02',
            nome_colaborador: 'Pedro Henrique',
            status: 'EM_ABERTO',
            data_lancamento: '2026-10-07',
            codigo_marcacao: 'P',
            quantidade_diaria: 1.0,
            valor_diaria_base: 150.00,
            valor_calculado: 150.00,
        };

        it('5.1 Identifica claramente como "Prévia do Valor Calculado" sem sugerir persistência prematura', () => {
            render(
                <DrawerEdicaoDiarista
                    isOpen={true}
                    onClose={vi.fn()}
                    lancamento={mockLancamento}
                    valorAnterior={150.00}
                    onConfirm={vi.fn()}
                    isSimulation={true}
                />
            );

            expect(screen.getByText('Prévia do Valor Calculado')).toBeInTheDocument();
            expect(screen.getByText(/Cálculo preliminar em tempo real/i)).toBeInTheDocument();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 6. AUSÊNCIA DE REGRESSÃO E INTEGRAÇÃO DE COMPONENTES
    // ──────────────────────────────────────────────────────────────────────────
    describe('6. Ausência de Regressão Funcional', () => {
        it('6.1 Renderiza a página de preview DevDiaristasDrawersPreview com todos os refinamentos integrados', () => {
            const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
            render(
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter>
                        <DevDiaristasDrawersPreview />
                    </BrowserRouter>
                </QueryClientProvider>
            );

            expect(screen.getByText(/Pré-visualização Segura dos Drawers — Diaristas/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Abrir Drawer Reabertura/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Abrir Drawer Edição/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Abrir Drawer Fechamento/i })).toBeInTheDocument();
        });
    });
});
