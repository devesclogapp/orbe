import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FIX-RET-06: Eliminação de MAX(UUID) e Vínculo Determinístico do Espelho RH', () => {
  const mig06Path = path.resolve(
    process.cwd(),
    'supabase/migrations/20261016170000_fix_ret_06_compatibilidade_tipo_espelho.sql'
  );

  it('deve existir o arquivo da migration FIX-RET-06', () => {
    expect(fs.existsSync(mig06Path)).toBe(true);
  });

  it('não deve conter nenhuma chamada a MAX(rhl.id) ou MAX(UUID)', () => {
    const sql = fs.readFileSync(mig06Path, 'utf8');
    expect(sql).not.toMatch(/max\s*\(\s*rhl\.id\s*\)/i);
    expect(sql).not.toMatch(/max\s*\(\s*[a-zA-Z0-9_]+\.id\s*\)/i);
  });

  it('deve implementar contagem unívoca COUNT(DISTINCT rhl.id) antes da seleção de ID', () => {
    const sql = fs.readFileSync(mig06Path, 'utf8');
    expect(sql).toContain('COUNT(DISTINCT rhl.id)');
    expect(sql).toContain('v_espelho_count');
    expect(sql).toContain('IF v_espelho_count = 0 THEN');
    expect(sql).toContain('ELSIF v_espelho_count > 1 THEN');
  });

  it('deve selecionar rhl.id sem agregação após garantia de unívoco v_espelho_count = 1', () => {
    const sql = fs.readFileSync(mig06Path, 'utf8');
    expect(sql).toMatch(/SELECT\s+rhl\.id\s+INTO\s+v_espelho_candidato_id\s+FROM public\.rh_financeiro_lotes/i);
  });

  it('deve preservar estritamente a segregação de FK da FIX-RET-05 (lote_id = NULL e detalhes.intermitentes_lote_id)', () => {
    const sql = fs.readFileSync(mig06Path, 'utf8');
    expect(sql).toContain('v_remessa_lote_id, -- Respeita estritamente FK cnab_auditoria_bancaria_lote_id_fkey');
    expect(sql).toContain("'intermitentes_lote_id', v_remessa_intermitentes_id");
  });
});
