import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CONV-16 — ETAPA 02B: Convergência Funcional dos Modais para Drawers Contextuais', () => {
  const painelPath = path.resolve(__dirname, '../pages/Rh/RhDiaristasPainel.tsx');
  const content = fs.readFileSync(painelPath, 'utf8');

  const reaberturaPath = path.resolve(__dirname, '../components/diaristas/drawers/DrawerReaberturaDiarista.tsx');
  const reaberturaContent = fs.readFileSync(reaberturaPath, 'utf8');

  const edicaoPath = path.resolve(__dirname, '../components/diaristas/drawers/DrawerEdicaoDiarista.tsx');
  const edicaoContent = fs.readFileSync(edicaoPath, 'utf8');

  const fechamentoPath = path.resolve(__dirname, '../components/diaristas/drawers/DrawerFechamentoDiarista.tsx');
  const fechamentoContent = fs.readFileSync(fechamentoPath, 'utf8');

  // 1. Arquitetura de Drawers
  it('1. Implementa DrawerPrimarioShell oficial da camada de continuidade', () => {
    // Painel conecta os 3 Drawers modulares
    expect(content).toContain('<DrawerReaberturaDiarista');
    expect(content).toContain('<DrawerEdicaoDiarista');
    expect(content).toContain('<DrawerFechamentoDiarista');

    // Cada um dos 3 Drawers implementa DrawerPrimarioShell
    expect(reaberturaContent).toContain('<DrawerPrimarioShell');
    expect(edicaoContent).toContain('<DrawerPrimarioShell');
    expect(fechamentoContent).toContain('<DrawerPrimarioShell');
  });

  // 2. Drawer de Reabertura
  it('2. Drawer de Reabertura: contexto, modalidades, justificativa obrigatória e mutação segura', () => {
    // Conexão no Painel
    expect(content).toContain('isOpen={openReabertura && !!loteParaReabrir}');
    expect(content).toContain('lote={loteParaReabrir}');
    expect(content).toContain('reabrirMutation.mutate(data)');

    // Estrutura e detalhes no Drawer modular
    expect(reaberturaContent).toContain('title="Reabrir Período Operacional"');
    expect(reaberturaContent).toContain('Reabertura de Ciclo');
    expect(reaberturaContent).toContain('Contexto do Lote Selecionado');
    expect(reaberturaContent).toContain('lote.total_registros');
    expect(reaberturaContent).toContain('lote.valor_total');
    expect(reaberturaContent).toContain("setTipoReabertura('operacional')");
    expect(reaberturaContent).toContain("setTipoReabertura('administrativa')");
    expect(reaberturaContent).toContain('Modo Administrativo Restrito');
    expect(reaberturaContent).toContain('!motivoReabertura.trim()');

    // Cancelamento limpo
    expect(content).toContain('setOpenReabertura(false)');
    expect(content).toContain('setMotivoReabertura("")');
    expect(content).toContain("setTipoReabertura('operacional')");
    expect(content).toContain('setLoteParaReabrir(null)');
  });

  // 3. Drawer de Edição Administrativa
  it('3. Drawer de Edição Administrativa: snapshot, campos, recálculo seguro e justificativa de auditoria', () => {
    // Conexão no Painel
    expect(content).toContain('isOpen={openEdicao && !!lancamentoEditando}');
    expect(content).toContain('lancamento={lancamentoEditando}');
    expect(content).toContain('editarMutation.mutate(formData)');

    // Estrutura e campos no Drawer modular
    expect(edicaoContent).toContain('title="Edição Administrativa de Lançamento"');
    expect(edicaoContent).toContain('lancamento.nome_colaborador');
    expect(edicaoContent).toContain('codigo_marcacao');
    expect(edicaoContent).toContain('quantidade_diaria');
    expect(edicaoContent).toContain('data_lancamento');
    expect(edicaoContent).toContain('valor_diaria_base');
    expect(edicaoContent).toContain('recalcularValor');
    expect(edicaoContent).toContain('motivo_edicao');
    expect(edicaoContent).toContain('!isMotivoValido');
  });

  // 4. Drawer de Fechamento de Período
  it('4. Drawer de Fechamento: confirmação textual "FECHAR", bloqueios e envio para RH', () => {
    // Conexão no Painel
    expect(content).toContain('isOpen={openFechamento}');
    expect(content).toContain('totalEmAberto={rawEmAberto}');
    expect(content).toContain('fecharMutation.mutate()');

    // Estrutura e validações no Drawer modular
    expect(fechamentoContent).toContain('title="Confirmar Fechamento de Período"');
    expect(fechamentoContent).toContain('totalEmAberto');
    expect(fechamentoContent).toContain('AGUARDANDO_VALIDACAO_RH');
    expect(fechamentoContent).toContain('FECHAR');
    expect(fechamentoContent).toContain('isConfirmDisabled');

    // Cancelamento limpo
    expect(content).toContain('setOpenFechamento(false)');
    expect(content).toContain('setConfirmText("")');
    expect(content).toContain('setObsLote("")');
  });

  // 5. PEND-03 — Orientação Contextual em Por Diarista
  it('5. PEND-03: Orientação contextual e bloqueio de engrenagem para lotes liquidados ou usuários sem permissão', () => {
    expect(content).toContain('Registros liquidados — edição bloqueada pela política financeira.');
    expect(content).toContain('Visualização de conferência — edição administrativa restrita ao RH/Admin.');
    expect(content).toContain('Clique no ícone de engrenagem para realizar edição administrativa autorizada.');
    expect(content).toContain('Registro liquidado — edição bloqueada');
  });

  // 6. Não quebrou os modais funcionais pré-existentes
  it('6. Garante que as mutations de negócio e contratos de serviço foram 100% preservados', () => {
    expect(content).toContain('LancamentoDiaristaService.updateAdmin');
    expect(content).toContain('LoteFechamentoDiaristaService.fecharPeriodo');
    expect(content).toContain('LoteFechamentoDiaristaService.validarPeriodo');
    expect(content).toContain('LoteFechamentoDiaristaService.reabrirPeriodo');
    expect(content).toContain('DiaristaCicloService.getRegraFechamento');
    expect(content).toContain('diaristas_logs_fechamento');
  });
});
