import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildServicosExtrasPipeline,
  resolveServicoExtraModalidade,
} from '@/contexts/OperationalPipelineContext';

describe('GATE SE-06-B — Correção do Contexto Financeiro na Linha do Tempo de Serviços Extras', () => {
  const aprovacoesPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
  const aprovacoesContent = fs.readFileSync(aprovacoesPath, 'utf-8');

  it('1. Serviço Extra com Pix / CAIXA_IMEDIATO resolve corretamente modalidade Caixa Imediato e CTA', () => {
    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-10',
      empresa: 'Empresa Teste - Homologação',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'CAIXA_IMEDIATO',
      registroId: 'add948f0-1674-49e1-8c62-65541da9f1fe',
      descricao: 'Consertar palete',
      valor: 40,
      data: '2026-10-24',
    });

    expect(pipeline.context.empresa).toBe('Empresa Teste - Homologação');
    expect(pipeline.context.modalidade).toBe('CAIXA_IMEDIATO');
    expect(pipeline.context.modalidade_financeira).toBe('CAIXA_IMEDIATO');
    expect(pipeline.context.valor).toBe(40);
    expect(pipeline.context.competencia).toBe('2026-10');
    expect(pipeline.context.isModalidadeValida).toBe(true);

    // Próxima ação definida para Caixa Imediato
    expect(pipeline.nextAction).toBeDefined();
    expect(pipeline.nextAction?.label).toContain('Caixa Imediato');
    expect(pipeline.nextAction?.route).toBe('/financeiro/receitas?tab=CAIXA_IMEDIATO&origem=SERVICO_EXTRA');
  });

  it('2. Empresa aparece pelo nome legível e não como "—" ou indefinida', () => {
    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-10',
      empresa: 'Empresa Teste - Homologação',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'CAIXA_IMEDIATO',
      registroId: 'add948f0-1674-49e1-8c62-65541da9f1fe',
      descricao: 'Consertar palete',
      valor: 40,
      data: '2026-10-24',
    });

    expect(pipeline.context.empresa).not.toBe('—');
    expect(pipeline.context.empresa).not.toBe('');
    expect(pipeline.context.empresa).toBe('Empresa Teste - Homologação');
  });

  it('3. Valor de R$ 40,00 é estritamente preservado', () => {
    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-10',
      empresa: 'Empresa Teste - Homologação',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'CAIXA_IMEDIATO',
      registroId: 'add948f0-1674-49e1-8c62-65541da9f1fe',
      descricao: 'Consertar palete',
      valor: 40,
      data: '2026-10-24',
    });

    expect(pipeline.context.valor).toBe(40);
  });

  it('4. Competência permanece 2026-10 e data 2026-10-24', () => {
    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-10',
      empresa: 'Empresa Teste - Homologação',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'CAIXA_IMEDIATO',
      registroId: 'add948f0-1674-49e1-8c62-65541da9f1fe',
      descricao: 'Consertar palete',
      valor: 40,
      data: '2026-10-24',
    });

    expect(pipeline.context.competencia).toBe('2026-10');
    expect(pipeline.context.data).toBe('2026-10-24');
  });

  it('5. O falso alerta de destino financeiro desaparece para modalidade válida', () => {
    const res = resolveServicoExtraModalidade('CAIXA_IMEDIATO');
    expect(res.isValid).toBe(true);
    expect(res.description).not.toContain('não pôde ser determinado');
  });

  it('6. Modalidade ausente ou inválida preserva o alerta legítimo (sem fallback silencioso)', () => {
    const resNull = resolveServicoExtraModalidade(null);
    expect(resNull.isValid).toBe(false);
    expect(resNull.modalidade).toBeNull();
    expect(resNull.description).toContain('Destino financeiro não pôde ser determinado');

    const resInvalida = resolveServicoExtraModalidade('OUTRO_TIPO_DESCONHECIDO');
    expect(resInvalida.isValid).toBe(false);
    expect(resInvalida.modalidade).toBeNull();
    expect(resInvalida.description).toContain('Destino financeiro não pôde ser determinado');

    const pipelineInvalido = buildServicosExtrasPipeline({
      competencia: '2026-10',
      empresa: 'Empresa Teste - Homologação',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: null,
      registroId: 'add948f0-1674-49e1-8c62-65541da9f1fe',
      descricao: 'Consertar palete',
      valor: 40,
      data: '2026-10-24',
    });
    expect(pipelineInvalido.context.isModalidadeValida).toBe(false);
    expect(pipelineInvalido.nextAction).toBeUndefined();
  });

  it('7. Caminhos de Boleto (DUPLICATA) e Faturamento Mensal (FATURAMENTO_MENSAL) funcionam consistentemente', () => {
    // Boleto
    const pipeBoleto = buildServicosExtrasPipeline({
      competencia: '2026-10',
      empresa: 'Empresa Teste - Homologação',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'DUPLICATA',
      registroId: 'add948f0-1674-49e1-8c62-65541da9f1fe',
      descricao: 'Consertar palete',
      valor: 40,
      data: '2026-10-24',
    });
    expect(pipeBoleto.context.modalidade).toBe('DUPLICATA');
    expect(pipeBoleto.nextAction?.route).toBe('/financeiro/receitas?tab=DUPLICATA&origem=SERVICO_EXTRA');

    // Faturamento Mensal
    const pipeMensal = buildServicosExtrasPipeline({
      competencia: '2026-10',
      empresa: 'Empresa Teste - Homologação',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'FATURAMENTO_MENSAL',
      registroId: 'add948f0-1674-49e1-8c62-65541da9f1fe',
      descricao: 'Consertar palete',
      valor: 40,
      data: '2026-10-24',
    });
    expect(pipeMensal.context.modalidade).toBe('FATURAMENTO_MENSAL');
    expect(pipeMensal.nextAction?.route).toBe('/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA');
  });

  it('8. Inspeção estática de AprovacoesRh.tsx confirma que os campos canônicos são passados em openServicoExtraContinuity e aprovarMutation', () => {
    // openServicoExtraContinuity
    const openContinuityBlock = aprovacoesContent.substring(
      aprovacoesContent.indexOf('const openServicoExtraContinuity = async'),
      aprovacoesContent.indexOf('const aprovarMutation = useMutation')
    );
    expect(openContinuityBlock).toContain('competencia: effectiveCompetencia');
    expect(openContinuityBlock).toContain('empresa: nomeEmpresa');
    expect(openContinuityBlock).toContain('modalidade_financeira: modalidade');
    expect(openContinuityBlock).toContain('empresas(nome)');
    expect(openContinuityBlock).not.toContain('modalidade: (seData as any).modalidade_financeira || "CAIXA_IMEDIATO"');
    expect(openContinuityBlock).not.toContain('empresaId:');
    expect(openContinuityBlock).not.toContain('valorTotal:');

    // aprovarMutation
    const aprovarSeBlock = aprovacoesContent.substring(
      aprovacoesContent.indexOf('if (item.tipo === "SERVIÇO EXTRA")'),
      aprovacoesContent.indexOf('// 6. OPERAÇÃO')
    );
    expect(aprovarSeBlock).toContain('competencia: effectiveCompetencia');
    expect(aprovarSeBlock).toContain('empresa: nomeEmpresa');
    expect(aprovarSeBlock).toContain('modalidade_financeira: result?.modalidade_financeira ?? null');
    expect(aprovarSeBlock).toContain('empresas(nome)');
    expect(aprovarSeBlock).not.toContain('modalidade: (updated as any)?.modalidade_financeira || "CAIXA_IMEDIATO"');
    expect(aprovarSeBlock).not.toContain('empresaId:');
    expect(aprovarSeBlock).not.toContain('valorTotal:');
  });

  it('9. Preserva intactos os demais 5 fluxos de aprovação em AprovacoesRh.tsx (sem regressão)', () => {
    expect(aprovacoesContent).toContain('// 1. DIARISTA');
    expect(aprovacoesContent).toContain('LoteFechamentoDiaristaService.validarPeriodo(');

    expect(aprovacoesContent).toContain('// 2. INTERMITENTE');
    expect(aprovacoesContent).toContain('IntermitentesLoteService.validarLote(');

    expect(aprovacoesContent).toContain('// 3. PONTO');
    expect(aprovacoesContent).toContain('status_processamento: "PROCESSADO"');

    expect(aprovacoesContent).toContain('// 4. CUSTO EXTRA');
    expect(aprovacoesContent).toContain('rpc_custo_extra_transicionar');

    expect(aprovacoesContent).toContain('// 6. OPERAÇÃO');
    expect(aprovacoesContent).toContain('rpc_rh_aprovar_operacao');
  });
});
