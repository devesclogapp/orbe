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

// Mocks dos contextos necessários para a página de preview
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

describe('CONV-16 — FIX 06: Pré-visualização Segura dos Drawers para Homologação UI/UX', () => {

    // ──────────────────────────────────────────────────────────────────────────
    // 1. DRAWER REABERTURA DE PERÍODO
    // ──────────────────────────────────────────────────────────────────────────
    describe('1. DrawerReaberturaDiarista (Componente Real Modular)', () => {
        const mockLote = {
            id: 'lote-hml-12345678',
            periodo_inicio: '2026-10-05',
            periodo_fim: '2026-10-11',
            empresa: { nome: 'ESC Logística Homologação' },
            total_registros: 14,
            valor_total: 1960.00,
            status: 'AGUARDANDO_VALIDACAO_RH',
        };

        it('1.1 Renderiza os dados de contexto do lote e valida estado desabilitado da confirmação', () => {
            const handleClose = vi.fn();
            const handleConfirm = vi.fn();

            render(
                <DrawerReaberturaDiarista
                    isOpen={true}
                    onClose={handleClose}
                    lote={mockLote}
                    usuarioNome="Auditor de Teste"
                    onConfirm={handleConfirm}
                    isSimulation={true}
                />
            );

            expect(screen.getByText('Reabrir Período Operacional')).toBeInTheDocument();
            expect(screen.getAllByText('ESC Logística Homologação').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText(/14 registros/i)).toBeInTheDocument();

            // Botão de confirmação deve iniciar desabilitado porque não há motivo digitado
            const btnConfirmar = screen.getByRole('button', { name: /Confirmar Reabertura Operacional/i });
            expect(btnConfirmar).toBeDisabled();

            // Clicar em Cancelar deve chamar onClose
            const btnCancelar = screen.getByRole('button', { name: /Cancelar/i });
            fireEvent.click(btnCancelar);
            expect(handleClose).toHaveBeenCalled();
        });

        it('1.2 Permite alternar modalidade para Administrativa e confirma com motivo válido', () => {
            const handleClose = vi.fn();
            const handleConfirm = vi.fn();

            render(
                <DrawerReaberturaDiarista
                    isOpen={true}
                    onClose={handleClose}
                    lote={mockLote}
                    usuarioNome="Auditor de Teste"
                    onConfirm={handleConfirm}
                    isSimulation={true}
                />
            );

            // Alternar para modalidade Administrativa
            const cardAdmin = screen.getByText('Administrativa');
            fireEvent.click(cardAdmin);

            expect(screen.getByText(/Modo Administrativo Restrito:/i)).toBeInTheDocument();

            // Preencher o motivo
            const textarea = screen.getByPlaceholderText(/Descreva a justificativa operacional/i);
            fireEvent.change(textarea, { target: { value: 'Ajuste solicitado pelo RH para conferência' } });

            // Botão agora deve estar habilitado
            const btnConfirmarAdmin = screen.getByRole('button', { name: /Confirmar Reabertura Administrativa/i });
            expect(btnConfirmarAdmin).not.toBeDisabled();

            fireEvent.click(btnConfirmarAdmin);
            expect(handleConfirm).toHaveBeenCalledWith({
                loteId: 'lote-hml-12345678',
                motivo: 'Ajuste solicitado pelo RH para conferência',
                tipo: 'administrativa',
            });
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 2. DRAWER EDIÇÃO ADMINISTRATIVA
    // ──────────────────────────────────────────────────────────────────────────
    describe('2. DrawerEdicaoDiarista (Componente Real Modular)', () => {
        const mockLancamento = {
            id: 'lanc-hml-98765',
            nome_colaborador: 'Carlos Eduardo da Silva',
            funcao_colaborador: 'Conferente',
            status: 'EM_ABERTO',
            data_lancamento: '2026-10-07',
            codigo_marcacao: 'P',
            quantidade_diaria: 1.0,
            valor_diaria_base: 140.00,
            valor_calculado: 140.00,
            observacao: 'Turno padrão',
            lote_fechamento_id: 'lote-ctx-001',
        };

        const mockLoteContext = {
            id: 'lote-ctx-001',
            periodo_inicio: '2026-10-05',
            periodo_fim: '2026-10-11',
        };

        it('2.1 Renderiza os dados do colaborador e bloqueia confirmação com motivo menor que 5 caracteres', () => {
            const handleClose = vi.fn();
            const handleConfirm = vi.fn();

            render(
                <DrawerEdicaoDiarista
                    isOpen={true}
                    onClose={handleClose}
                    lancamento={mockLancamento}
                    loteContext={mockLoteContext}
                    valorAnterior={140.00}
                    onConfirm={handleConfirm}
                    isSimulation={true}
                />
            );

            expect(screen.getByText('Edição Administrativa de Lançamento')).toBeInTheDocument();
            expect(screen.getByText('Carlos Eduardo da Silva')).toBeInTheDocument();
            expect(screen.getByText('Conferente')).toBeInTheDocument();

            const btnConfirmar = screen.getByRole('button', { name: /Confirmar Alteração/i });
            expect(btnConfirmar).toBeDisabled();

            // Digitar motivo com menos de 5 caracteres
            const textarea = screen.getByPlaceholderText(/Justificativa obrigatória para auditoria/i);
            fireEvent.change(textarea, { target: { value: 'aj' } });
            expect(btnConfirmar).toBeDisabled();

            // Digitar motivo válido com mais de 5 caracteres
            fireEvent.change(textarea, { target: { value: 'Ajuste autorizado pelo encarregado' } });
            expect(btnConfirmar).not.toBeDisabled();

            fireEvent.click(btnConfirmar);
            expect(handleConfirm).toHaveBeenCalledWith(expect.objectContaining({
                id: 'lanc-hml-98765',
                motivo_edicao: 'Ajuste autorizado pelo encarregado',
            }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 3. DRAWER FECHAMENTO DE PERÍODO
    // ──────────────────────────────────────────────────────────────────────────
    describe('3. DrawerFechamentoDiarista (Componente Real Modular)', () => {
        it('3.1 Exige digitação exata da palavra "FECHAR" para autorizar a confirmação', () => {
            const handleClose = vi.fn();
            const handleConfirm = vi.fn();

            render(
                <DrawerFechamentoDiarista
                    isOpen={true}
                    onClose={handleClose}
                    empresaNome="ESC Logística Homologação"
                    periodoInicio="2026-10-05"
                    periodoFim="2026-10-11"
                    totalEmAberto={8}
                    onConfirm={handleConfirm}
                    isSimulation={true}
                />
            );

            expect(screen.getByText('Confirmar Fechamento de Período')).toBeInTheDocument();
            expect(screen.getByText(/8 registro\(s\)/i)).toBeInTheDocument();

            const btnConfirmar = screen.getByRole('button', { name: /Confirmar e Fechar/i });
            expect(btnConfirmar).toBeDisabled();

            const inputConfirm = screen.getByPlaceholderText('FECHAR');
            // Digitar incorreto
            fireEvent.change(inputConfirm, { target: { value: 'SIM' } });
            expect(btnConfirmar).toBeDisabled();

            // Digitar "FECHAR"
            fireEvent.change(inputConfirm, { target: { value: 'FECHAR' } });
            expect(btnConfirmar).not.toBeDisabled();

            fireEvent.click(btnConfirmar);
            expect(handleConfirm).toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 4. AMBIENTE DE PRÉ-VISUALIZAÇÃO SEGURO & ROTA ISOLADA
    // ──────────────────────────────────────────────────────────────────────────
    describe('4. Ambiente de Pré-visualização Isolado (/dev/diaristas-drawers)', () => {
        it('4.1 Renderiza a página DevDiaristasDrawersPreview com os 3 cards de cenários e banner de isolamento', () => {
            const queryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            });
            render(
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter>
                        <DevDiaristasDrawersPreview />
                    </BrowserRouter>
                </QueryClientProvider>
            );

            expect(screen.getByText(/Pré-visualização Segura dos Drawers — Diaristas/i)).toBeInTheDocument();
            expect(screen.getByText(/Garantia de Não-Interferência com Produção/i)).toBeInTheDocument();
            expect(screen.getByText(/Cenário A/i)).toBeInTheDocument();
            expect(screen.getByText(/Cenário B/i)).toBeInTheDocument();
            expect(screen.getByText(/Cenário C/i)).toBeInTheDocument();

            // Botões de acionamento dos 3 Drawers
            expect(screen.getByRole('button', { name: /Abrir Drawer Reabertura/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Abrir Drawer Edição/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Abrir Drawer Fechamento/i })).toBeInTheDocument();
        });

        it('4.2 Garante que DevDiaristasDrawersPreview NÃO possui chamadas diretas de escrita ao Supabase ou banco', () => {
            const pagePath = path.resolve(__dirname, '../pages/Dev/DevDiaristasDrawersPreview.tsx');
            const pageContent = fs.readFileSync(pagePath, 'utf8');

            // Zero queries de escrita
            expect(pageContent).not.toContain('.insert(');
            expect(pageContent).not.toContain('.update(');
            expect(pageContent).not.toContain('.delete(');
            expect(pageContent).not.toContain('.rpc(');
            expect(pageContent).not.toContain('supabase.');
        });

        it('4.3 Garante que a rota em App.tsx está condicionada estritamente a import.meta.env.DEV', () => {
            const appPath = path.resolve(__dirname, '../App.tsx');
            const appContent = fs.readFileSync(appPath, 'utf8');

            expect(appContent).toContain('import.meta.env.DEV');
            expect(appContent).toContain('path="/dev/diaristas-drawers"');
        });

        it('4.4 Garante que RhDiaristasPainel.tsx utiliza os mesmos componentes extraídos', () => {
            const painelPath = path.resolve(__dirname, '../pages/Rh/RhDiaristasPainel.tsx');
            const painelContent = fs.readFileSync(painelPath, 'utf8');

            expect(painelContent).toContain('<DrawerReaberturaDiarista');
            expect(painelContent).toContain('<DrawerEdicaoDiarista');
            expect(painelContent).toContain('<DrawerFechamentoDiarista');
        });
    });
});
