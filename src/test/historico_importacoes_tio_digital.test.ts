import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CONTRATO HISTÓRICO DE IMPORTAÇÕES — ORIGEM TIO DIGITAL', () => {
  const MIGRATION_PATH = path.resolve(
    process.cwd(),
    'supabase/migrations/20260928183000_historico_importacoes_origem_tio_digital.sql'
  );
  const EDGE_FN_PATH = path.resolve(
    process.cwd(),
    'supabase/functions/importar-intermitentes-tio/index.ts'
  );
  const IMPORTOES_PAGE_PATH = path.resolve(
    process.cwd(),
    'src/pages/Importacoes.tsx'
  );

  // 1. Origem tio_digital aceita pelo contrato esperado e migração aditiva
  it('1. A migration aditiva define a constraint historico_importacoes_origem_check incluindo tio_digital', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    const content = fs.readFileSync(MIGRATION_PATH, 'utf-8');

    // Valida que remove a constraint restritiva anterior
    expect(content).toContain('DROP CONSTRAINT IF EXISTS historico_importacoes_origem_check;');

    // Valida que a nova constraint contém 'tio_digital'
    expect(content).toContain("'tio_digital'");
    expect(content).toContain("CHECK (origem IN ('manual', 'google_drive', 'api', 'rhid_api', 'tio_digital'))");
  });

  // 2. Origens anteriores estritamente preservadas (sem regressão de contratos existentes)
  it('2. A migration preserva integralmente as 4 origens pré-existentes', () => {
    const content = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    const origensPreExistentes = ['manual', 'google_drive', 'api', 'rhid_api'];

    origensPreExistentes.forEach((origem) => {
      expect(content).toContain(`'${origem}'`);
    });
  });

  // 3. Importações Intermitentes filtra e exibe 'tio_digital'
  it('3. Importacoes.tsx filtra especificamente origem tio_digital para o contexto de Intermitentes', () => {
    expect(fs.existsSync(IMPORTOES_PAGE_PATH)).toBe(true);
    const content = fs.readFileSync(IMPORTOES_PAGE_PATH, 'utf-8');

    // Valida que para isIntermitente filtra por origem tio_digital
    expect(content).toContain('.eq("origem", "tio_digital")');

    // Valida mapeamento amigável do label 'Tio Digital'
    expect(content).toContain('h.origem === "tio_digital" ? "Tio Digital"');
  });

  // 4. CLT / RHID não sofre regressão
  it('4. CLT / RHID permanece isolado via LogSincronizacaoService sem contaminação por tio_digital', () => {
    const content = fs.readFileSync(IMPORTOES_PAGE_PATH, 'utf-8');

    // Quando não é intermitente, chama LogSincronizacaoService.getWithEmpresa()
    expect(content).toContain('return LogSincronizacaoService.getWithEmpresa();');
  });

  // 5. Edge Function importar-intermitentes-tio: contrato, ordem e rastreabilidade explícita
  it('5. Edge Function importar-intermitentes-tio grava metadados completos e não silencia erro de histórico', () => {
    expect(fs.existsSync(EDGE_FN_PATH)).toBe(true);
    const content = fs.readFileSync(EDGE_FN_PATH, 'utf-8');

    // Criação do histórico com workflow e nome de arquivo
    expect(content).toContain("origem: 'tio_digital'");
    expect(content).toContain("workflow: 'importar-intermitentes-tio'");
    expect(content).toContain('nome_arquivo:');

    // Log crítico em caso de falha de histórico
    expect(content).toContain('[CRITICAL] Falha ao registrar historico_importacoes');

    // Retorno explícito do aviso_rastreabilidade e importacao_id
    expect(content).toContain('importacao_id: importacaoId || null');
    expect(content).toContain('aviso_rastreabilidade:');
  });
});
