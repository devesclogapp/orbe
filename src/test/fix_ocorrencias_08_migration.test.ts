import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * FIX-OCORRÊNCIAS-08 — Análise estática da migration incremental.
 * Escopo: garante propriedades do SQL (não substitui teste autenticado de RLS,
 * que permanece PENDENTE no roteiro ORBE_FIX08_ROTEIRO_TESTES_RLS.md).
 */
const root = resolve(__dirname, '../..');
const MIG = resolve(root, 'supabase/migrations/20261105233000_fix_ocorrencias_08_seguranca_rls_tenant.sql');
const ORIGINAL = resolve(root, 'supabase/migrations/20261105220000_infracoes_catalogo_e_descontos_operacionais.sql');
const APLICAR = resolve(root, 'supabase/scripts/ORBE_FIX08_APLICAR.sql');
const PRECHECK = resolve(root, 'supabase/scripts/ORBE_FIX08_PRECHECK.sql');
const POSCHECK = resolve(root, 'supabase/scripts/ORBE_FIX08_POSCHECK.sql');

const stripComments = (sql: string) =>
  sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

const sql = stripComments(readFileSync(MIG, 'utf8'));

describe('FIX-OCORRÊNCIAS-08 — migration incremental', () => {
  it('é posterior à migration original e os scripts existem', () => {
    expect(existsSync(ORIGINAL)).toBe(true);
    expect(Number('20261105233000')).toBeGreaterThan(Number('20261105220000'));
    [APLICAR, PRECHECK, POSCHECK].forEach((f) => expect(existsSync(f)).toBe(true));
  });

  it('ORBE_FIX08_APLICAR.sql é idêntico à migration', () => {
    expect(readFileSync(APLICAR, 'utf8')).toBe(readFileSync(MIG, 'utf8'));
  });

  it('é transacional', () => {
    expect(sql).toMatch(/^\s*BEGIN;/m);
    expect(sql).toMatch(/^\s*COMMIT;/m);
  });

  it('não contém operações destrutivas sobre dados ou estruturas', () => {
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/\bUPDATE\s+public\./i);
    expect(sql).not.toMatch(/INSERT\s+INTO/i);
    expect(sql).not.toMatch(/CREATE\s+TABLE/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE[^;]*DROP\s+COLUMN/i);
  });

  it('não depende do claim JWT em nenhuma política', () => {
    expect(sql).not.toMatch(/auth\.jwt\(\)\s*->>\s*'tenant_id'/);
    // a única menção a jwt deve ser a auto-verificação (ILIKE '%jwt%')
    const mentions = sql.match(/jwt/gi) ?? [];
    expect(mentions.length).toBeGreaterThan(0);
    expect(sql).not.toMatch(/auth\.current_tenant_id/);
  });

  it('não usa fallback "OR current_tenant_id() IS NULL"', () => {
    expect(sql).not.toMatch(/current_tenant_id\(\)\s+IS\s+NULL/i);
  });

  it('cria políticas RESTRICTIVE FOR DELETE USING (false) nas 3 tabelas', () => {
    const matches = sql.match(/AS\s+RESTRICTIVE\s+FOR\s+DELETE\s+USING\s*\(\s*false\s*\)/gi) ?? [];
    expect(matches).toHaveLength(3);
  });

  it('não recria políticas FOR ALL', () => {
    expect(sql).not.toMatch(/CREATE\s+POLICY[\s\S]{0,200}?FOR\s+ALL/i);
  });

  it('toda política de escrita exige tenant = current_tenant_id() e perfil', () => {
    const writePolicies = sql.match(/CREATE POLICY fix08_\w+_(insert|update)[\s\S]*?;\n/g) ?? [];
    expect(writePolicies).toHaveLength(6);
    writePolicies.forEach((p) => {
      expect(p).toMatch(/tenant_id\s*=\s*public\.current_tenant_id\(\)/);
      expect(p).toMatch(/fn_ocorrencias_perfil_(gestao|financeiro)\(tenant_id\)/);
    });
  });

  it('Encarregado: catálogo restrito a ativos; decisões/eventos sem perfil operacional', () => {
    expect(sql).toMatch(/fix08_catalogo_select[\s\S]*?ativo\s*=\s*true\s+OR\s+public\.fn_ocorrencias_perfil_gestao/);
    expect(sql).not.toMatch(/encarregado/i);
  });

  it('decisões: escrita somente gestão; eventos: gestão + financeiro', () => {
    const dec = sql.match(/CREATE POLICY fix08_decisoes_(insert|update)[\s\S]*?;\n/g) ?? [];
    dec.forEach((p) => expect(p).not.toMatch(/perfil_financeiro/));
    const ev = sql.match(/CREATE POLICY fix08_eventos_(insert|update)[\s\S]*?;\n/g) ?? [];
    ev.forEach((p) => expect(p).toMatch(/perfil_financeiro/));
  });

  it('funções de perfil exigem p_tenant_id = current_tenant_id() e escopam user_permissions ao tenant', () => {
    expect(sql).toMatch(/p_tenant_id\s*=\s*public\.current_tenant_id\(\)/);
    expect(sql).toMatch(/up\.tenant_id\s*=\s*p_tenant_id/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_ocorrencias_perfil_gestao\(UUID\) FROM PUBLIC, anon/);
  });

  it('triggers impedem vínculo entre tenants e troca de tenant_id', () => {
    ['catalogo', 'decisoes', 'eventos'].forEach((n) =>
      expect(sql).toMatch(new RegExp(`CREATE TRIGGER trg_fix08_${n}_tenant`)),
    );
    expect(sql).toMatch(/tenant_id é imutável/);
    expect(sql).toMatch(/public\.operacoes_producao WHERE id = NEW\.operacao_id/);
    expect(sql).toMatch(/v_empresa IS DISTINCT FROM NEW\.empresa_id/);
    expect(sql).toMatch(/v_dec\.collaborator_id IS DISTINCT FROM NEW\.collaborator_id/);
  });

  it('possui verificações prévias com falha explícita e é reexecutável', () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'FIX08 BLOQUEADO/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION/);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS/);
  });

  it('não altera status canônicos nem regras financeiras', () => {
    expect(sql).not.toMatch(/PENDENTE_PROCESSAMENTO/);
    expect(sql).not.toMatch(/rh_financeiro|lancamentos_diaristas|lancamentos_intermitentes|cnab/i);
  });

  it('PRECHECK e POSCHECK são somente leitura e produzem um único SELECT consolidado', () => {
    [PRECHECK, POSCHECK].forEach((f) => {
      const s = stripComments(readFileSync(f, 'utf8'));
      expect(s).not.toMatch(/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b\s+(TABLE|POLICY|FUNCTION|TRIGGER|INTO|FROM public|ON)/i);
      expect(s).toMatch(/99\. VEREDITO/);
      expect(s).toMatch(/ORDER BY "Verificação", "Objeto";\s*$/);
    });
  });
});
