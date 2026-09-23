import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('UX-2B.4 — Correção Pontual da View public.vw_aprovacoes_rh', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260922180000_fix_vw_aprovacoes_rh_em_validacao.sql'
  );

  it('1. Arquivo de migration foi criado no caminho canônico e é legível', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('CREATE OR REPLACE VIEW public.vw_aprovacoes_rh AS');
    expect(content).toContain('GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated;');
  });

  it('2. Cláusula SQL da migration mapeia EM_VALIDACAO para "Em análise"', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    
    // Localizar bloco CASE WHEN upper(c.raw_status)
    const caseIndex = content.indexOf('CASE');
    expect(caseIndex).toBeGreaterThan(-1);
    const caseEnd = content.indexOf('END AS situacao', caseIndex);
    expect(caseEnd).toBeGreaterThan(caseIndex);
    const caseBlock = content.substring(caseIndex, caseEnd);

    // Extrair o bloco de "Em análise"
    const emAnaliseStart = caseBlock.indexOf("THEN 'Em análise'");
    expect(emAnaliseStart).toBeGreaterThan(-1);
    const emAnaliseClause = caseBlock.substring(0, emAnaliseStart);

    // Deve conter 'EM_VALIDACAO' no bloco 'Em análise'
    expect(emAnaliseClause).toContain("'EM_VALIDACAO'");
    expect(emAnaliseClause).toContain("'PENDENTE'");
    expect(emAnaliseClause).toContain("'EM_ABERTO'");
    expect(emAnaliseClause).toContain("'AGUARDANDO_VALIDACAO_RH'");
  });

  it('3. Cláusula SQL da migration NÃO inclui EM_VALIDACAO no bloco "Aprovado"', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    const caseIndex = content.indexOf('CASE');
    const caseEnd = content.indexOf('END AS situacao', caseIndex);
    const caseBlock = content.substring(caseIndex, caseEnd);

    const aprovadoStart = caseBlock.indexOf("THEN 'Em análise'") + "THEN 'Em análise'".length;
    const aprovadoEnd = caseBlock.indexOf("THEN 'Aprovado'");
    expect(aprovadoEnd).toBeGreaterThan(aprovadoStart);
    const aprovadoClause = caseBlock.substring(aprovadoStart, aprovadoEnd);

    // NÃO deve conter 'EM_VALIDACAO'
    expect(aprovadoClause).not.toContain("'EM_VALIDACAO'");
    // DEVE conter 'APROVADO_OPERACAO'
    expect(aprovadoClause).toContain("'APROVADO_OPERACAO'");
    expect(aprovadoClause).toContain("'APROVADO'");
    expect(aprovadoClause).toContain("'CONCLUIDO'");
    expect(aprovadoClause).toContain("'VALIDADO_RH'");
  });

  it('4. Cláusula SQL da migration preserva o bloco "Devolvido"', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    const caseIndex = content.indexOf('CASE');
    const caseEnd = content.indexOf('END AS situacao', caseIndex);
    const caseBlock = content.substring(caseIndex, caseEnd);

    const devolvidoStart = caseBlock.indexOf("THEN 'Aprovado'") + "THEN 'Aprovado'".length;
    const devolvidoEnd = caseBlock.indexOf("THEN 'Devolvido'");
    expect(devolvidoEnd).toBeGreaterThan(devolvidoStart);
    const devolvidoClause = caseBlock.substring(devolvidoStart, devolvidoEnd);

    expect(devolvidoClause).toContain("'DEVOLVIDO'");
    expect(devolvidoClause).toContain("'CANCELADO'");
    expect(devolvidoClause).toContain("'RECUSADO'");
    expect(devolvidoClause).toContain("'REPROVADO'");
  });

  it('5. Migration preserva todas as 6 uniões operacionais (Anti-regressão)', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain("'PONTO' AS tipo");
    expect(content).toContain("'OPERAÇÃO' AS tipo");
    expect(content).toContain("'CUSTO EXTRA' AS tipo");
    expect(content).toContain("'SERVIÇO EXTRA' AS tipo");
    expect(content).toContain("'DIARISTA' AS tipo");
    expect(content).toContain("'INTERMITENTE' AS tipo");

    // Validar que SERVIÇO EXTRA extrai raw_status de se.pipeline_status
    expect(content).toContain('se.pipeline_status AS raw_status');
    expect(content).toContain('FROM servicos_extras_operacionais se');
  });

  it('6. Emulação da regra SQL classifica corretamente os status de Serviço Extra', () => {
    // Parser emulador fiel à regra do SQL:
    const evaluateSqlCaseSituacao = (rawStatus?: string | null): string => {
      if (!rawStatus) return 'Em análise';
      const s = rawStatus.toUpperCase();
      const emAnalise = [
        'EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE',
        'DETALHADO', 'REGISTRADO', 'PENDENTE_RH', 'EM_ANALISE_RH', 'EM_VALIDACAO'
      ];
      if (emAnalise.includes(s)) return 'Em análise';

      const aprovado = [
        'APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO',
        'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO',
        'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO'
      ];
      if (aprovado.includes(s)) return 'Aprovado';

      const devolvido = [
        'DEVOLVIDO', 'CANCELADO', 'CANCELADO_RH', 'RETORNADO',
        'RECUSADO', 'REPROVADO', 'DEVOLVIDO_RH'
      ];
      if (devolvido.includes(s)) return 'Devolvido';

      return 'Em análise';
    };

    // Cenários de Serviços Extras:
    expect(evaluateSqlCaseSituacao('PENDENTE')).toBe('Em análise');
    expect(evaluateSqlCaseSituacao('EM_VALIDACAO')).toBe('Em análise');
    expect(evaluateSqlCaseSituacao('APROVADO_OPERACAO')).toBe('Aprovado');
    expect(evaluateSqlCaseSituacao('CONCLUIDO')).toBe('Aprovado');
    expect(evaluateSqlCaseSituacao('DEVOLVIDO')).toBe('Devolvido');

    // Afirmação central: EM_VALIDACAO NÃO é Aprovado
    expect(evaluateSqlCaseSituacao('EM_VALIDACAO')).not.toBe('Aprovado');
  });

  it('7. AprovacoesRh mapeia corretamente a aba "fila" para "Em análise" e "aprovados" para "Aprovado"', () => {
    const aprovacoesPath = path.resolve(process.cwd(), 'src/pages/Rh/AprovacoesRh.tsx');
    const content = fs.readFileSync(aprovacoesPath, 'utf-8');

    // Verifica que activeTab === "fila" busca "Em análise"
    expect(content).toContain('const mappedSituacao: SituacaoItem = activeTab === "fila" ? "Em análise" : (activeTab === "aprovados" ? "Aprovado" : "Devolvido");');
  });

  it('8. AprovacoesService.getKpis calcula card de pendências com situacao = "Em análise"', () => {
    const servicePath = path.resolve(process.cwd(), 'src/services/domain/aprovacoes.service.ts');
    const content = fs.readFileSync(servicePath, 'utf-8');

    // Confirma que o card SERVIÇOS EXTRAS busca tipo SERVIÇO EXTRA com situacao "Em análise"
    expect(content).toContain("baseQuery().eq('situacao', 'Em análise').eq('tipo', 'SERVIÇO EXTRA')");
  });
});
