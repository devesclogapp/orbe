import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CONV-16 — FIX 04: Descoberta de Ações, Ajuda Contextual e Homologação Segura dos Drawers', () => {
  const painelPath = path.resolve(__dirname, '../pages/Rh/RhDiaristasPainel.tsx');
  const content = fs.readFileSync(painelPath, 'utf8');

  // 1. Tooltips Padronizados e Import Oficial
  it('1. Reutiliza o componente oficial de Tooltip (@/components/ui/tooltip) sem bibliotecas externas', () => {
    expect(content).toContain('import {');
    expect(content).toContain('Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,');
    expect(content).toContain('} from "@/components/ui/tooltip";');
  });

  // 2. Ação A: Fechamento de Período
  it('2. Fechamento de período: exibição no local previsto para autorizados, Tooltip padronizado com impedimento real e bloqueio', () => {
    // Preservação do botão para perfis autorizados
    expect(content).toContain('const podeFecharPerfil = isAdmin || isRh;');
    expect(content).toContain('if (!podeFecharPerfil) return null;');

    // Detecção das causas de impedimento
    expect(content).toContain('const isBloqueadoPeriodo = periodoBloqueado;');
    expect(content).toContain('const isSemRegistros = rawEmAberto === 0;');
    expect(content).toContain('const isFechamentoDesabilitado = isBloqueadoPeriodo || isSemRegistros;');

    // Mensagens contextuais claras
    expect(content).toContain('Fechamento indisponível: este período já possui lote homologado ou em processamento financeiro.');
    expect(content).toContain('Fechamento indisponível: não existem apontamentos em aberto para este período.');
    expect(content).toContain('Fechar período operacional e consolidar lote para validação do RH.');

    // Wrapper acessível e botão desabilitado sem permitir abertura
    expect(content).toContain('disabled={isFechamentoDesabilitado}');
    expect(content).toContain('onClick={() => !isFechamentoDesabilitado && setOpenFechamento(true)}');
  });

  // 3. Ação B: Reabertura de Período
  it('3. Reabertura de período: preservação da coluna Ações, exibição desabilitada com Tooltip contextual para lote pago ou em remessa', () => {
    // Segregação de perfis autorizados
    expect(content).toContain('const podeReabrirPerfil = isAdmin || isRh;');
    expect(content).toContain('if (!podeReabrirPerfil) return null;');

    // Distinção de status elegíveis vs bloqueados
    expect(content).toContain('const isStatusReabrivel = ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status);');

    // Mensagens contextuais para bloqueio financeiro
    expect(content).toContain('Reabertura indisponível: lote liquidado financeiramente.');
    expect(content).toContain('Reabertura indisponível: lote em processamento ou remessa bancária.');

    // Tooltip padronizado com wrapper acessível tabIndex={0}
    expect(content).toContain('<span tabIndex={0} className="inline-flex cursor-not-allowed">');
    expect(content).toContain('<RefreshCw className="h-3 w-3 mr-1" />Reabrir');
  });

  // 4. Ação C: Edição Administrativa
  it('4. Edição administrativa: preserva o botão na tabela para autorizados, estado desabilitado com Tooltip quando pago', () => {
    // Segregação de perfis autorizados
    expect(content).toContain('const podeEditarPerfil = isAdmin || isRh;');
    expect(content).toContain('if (!podeEditarPerfil) return null;');

    // Bloqueio para registro liquidado
    expect(content).toContain('Edição indisponível: registro pertencente a lote pago.');
    expect(content).toContain('Editar lançamento administrativamente com recálculo e justificativa.');

    // Botão Settings no padrão da tabela com acessibilidade
    expect(content).toContain('<Settings className="h-3.5 w-3.5" />');
  });

  // 5. Preservação Arquitetural e Inexistência de Mutações Forçadas
  it('5. Preserva integralmente os 3 Drawers e seus contratos de cancelamento limpo sem mutação', () => {
    expect(content).toContain('<DrawerReaberturaDiarista');
    expect(content).toContain('<DrawerEdicaoDiarista');
    expect(content).toContain('<DrawerFechamentoDiarista');

    // Cancelamento Reabertura
    expect(content).toContain('setOpenReabertura(false)');
    expect(content).toContain('setLoteParaReabrir(null)');

    // Cancelamento Edição
    expect(content).toContain('setOpenEdicao(false)');
    expect(content).toContain('setLancamentoEditando(null)');

    // Cancelamento Fechamento
    expect(content).toContain('setOpenFechamento(false)');
    expect(content).toContain('setConfirmText("")');
  });
});
