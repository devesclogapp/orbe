import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('FIX-SEC-01 — CONTENÇÃO P0 DE EXPOSIÇÃO ANÔNIMA NO SUPABASE', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261013010000_fix_sec_01_contencao_exposicao_anonima.sql'
  );

  const rollbackPathInMigrations = path.resolve(
    process.cwd(),
    'supabase/migrations/20261013010001_rollback_fix_sec_01.sql'
  );

  const contingencyPath = path.resolve(
    process.cwd(),
    'docs/procedimentos/contingencia_fix_sec_01.sql'
  );

  let migrationSql: string;

  beforeEach(() => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  // ============================================================================
  // BLOCO 1: INTEGRIDADE DO DIRETÓRIO E CONTINGÊNCIA FORA DE MIGRATIONS
  // ============================================================================
  describe('1. Isolamento Operacional e Diretório de Migrations', () => {
    it('1.1. Rollback NÃO deve existir dentro de supabase/migrations/', () => {
      expect(fs.existsSync(rollbackPathInMigrations)).toBe(false);
    });

    it('1.2. Procedimento de contingência existe em docs/procedimentos/ e mantém REVOKE anon', () => {
      expect(fs.existsSync(contingencyPath)).toBe(true);
      const contingencySql = fs.readFileSync(contingencyPath, 'utf-8');
      expect(contingencySql).toContain('REVOKE ALL ON public.lancamentos_diaristas FROM anon;');
      expect(contingencySql).toContain('REVOKE ALL ON public.vw_aprovacoes_rh FROM anon;');
      // Contingência NUNCA deve reabrir USING (true) nem desativar RLS
      expect(contingencySql).not.toContain('DISABLE ROW LEVEL SECURITY');
      expect(contingencySql).not.toContain('USING (true)');
    });
  });

  // ============================================================================
  // BLOCO 2: CONTENÇÃO E REVOGAÇÃO ESTRITA DE ANON
  // ============================================================================
  describe('2. Contenção e Revogação Estrita de Anon', () => {
    const tabelas = [
      'lancamentos_diaristas',
      'diaristas_lotes_fechamento',
      'materiais_operacionais',
      'operacao_producao_materiais',
      'regras_financeiras_versoes',
      'financeiro_consolidados_snapshots',
      'documentos_anexos',
      'equipes',
    ];

    const views = [
      'vw_audit_timeline_operacional',
      'vw_operacoes_producao_resumo_dia',
      'vw_aprovacoes_rh',
    ];

    it('2.1. Revoga expressamente todos os privilégios do perfil anon em todas as 8 tabelas', () => {
      tabelas.forEach((tbl) => {
        const regex = new RegExp(`REVOKE\\s+ALL\\s+ON\\s+(?:public\\.)?${tbl}\\s+FROM\\s+anon;`, 'i');
        expect(
          regex.test(migrationSql),
          `Tabela ${tbl} deve possuir REVOKE ALL ON public.${tbl} FROM anon;`
        ).toBe(true);
      });
    });

    it('2.2. Revoga expressamente acesso anônimo em todas as 3 views', () => {
      views.forEach((vw) => {
        const regex = new RegExp(`REVOKE\\s+ALL\\s+ON\\s+(?:public\\.)?${vw}\\s+FROM\\s+anon;`, 'i');
        expect(
          regex.test(migrationSql),
          `View ${vw} deve possuir REVOKE ALL ON public.${vw} FROM anon;`
        ).toBe(true);
      });
    });

    it('2.3. Concede acesso authenticated apenas', () => {
      views.forEach((vw) => {
        const regex = new RegExp(`GRANT\\s+SELECT\\s+ON\\s+(?:public\\.)?${vw}\\s+TO\\s+authenticated;`, 'i');
        expect(
          regex.test(migrationSql),
          `View ${vw} deve possuir GRANT SELECT TO authenticated;`
        ).toBe(true);
      });
    });
  });

  // ============================================================================
  // BLOCO 3: RLS E POLICIES RESTRITIVAS (AS RESTRICTIVE)
  // ============================================================================
  describe('3. Ativação de RLS e Policies Restritivas sem Bypass', () => {
    const tabelas = [
      'lancamentos_diaristas',
      'diaristas_lotes_fechamento',
      'materiais_operacionais',
      'operacao_producao_materiais',
      'regras_financeiras_versoes',
      'financeiro_consolidados_snapshots',
      'documentos_anexos',
      'equipes',
    ];

    it('3.1. Executa ENABLE ROW LEVEL SECURITY em todas as 8 tabelas do escopo', () => {
      tabelas.forEach((tbl) => {
        const regex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${tbl}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, 'i');
        expect(
          regex.test(migrationSql),
          `Tabela ${tbl} deve ter ENABLE ROW LEVEL SECURITY ativo.`
        ).toBe(true);
      });
    });

    it('3.2. Não introduz nenhuma policy com USING (true) ou WITH CHECK (true)', () => {
      const matchesUsingTrue = migrationSql.match(/USING\s*\(\s*true\s*\)/gi);
      const matchesCheckTrue = migrationSql.match(/WITH\s+CHECK\s*\(\s*true\s*\)/gi);
      expect(matchesUsingTrue).toBeNull();
      expect(matchesCheckTrue).toBeNull();
    });

    it('3.3. Aplica política AS RESTRICTIVE em tabelas críticas para forçar AND com qualquer policy prévia', () => {
      expect(migrationSql).toContain('CREATE POLICY "tenant_isolation_lancamentos_diaristas"\n  ON public.lancamentos_diaristas\n  AS RESTRICTIVE');
      expect(migrationSql).toContain('CREATE POLICY "tenant_isolation_diaristas_lotes_fechamento"\n  ON public.diaristas_lotes_fechamento\n  AS RESTRICTIVE');
      expect(migrationSql).toContain('CREATE POLICY "tenant_isolation_materiais_operacionais"\n  ON public.materiais_operacionais\n  AS RESTRICTIVE');
      expect(migrationSql).toContain('CREATE POLICY "tenant_isolation_equipes"\n  ON public.equipes\n  AS RESTRICTIVE');
      expect(migrationSql).toContain('WHERE e.id = equipes.empresa_id');
    });

    it('3.4. Remove policies antigas permissivas que poderiam gerar bypass via OR', () => {
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "full_access_lancamentos_diaristas"');
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "full_access_diaristas_lotes_fechamento"');
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "Acesso leitura autenticado materiais_operacionais"');
      expect(migrationSql).toContain('DROP POLICY IF EXISTS "Acesso total admin materiais_operacionais"');
    });

    it('3.5. Não cria trigger auto_set_tenant_id em tabelas que não possuem tenant_id (equipes, operacao_producao_materiais)', () => {
      expect(migrationSql).not.toContain('CREATE TRIGGER trg_auto_tenant_equipes');
      expect(migrationSql).not.toContain('CREATE TRIGGER trg_auto_tenant_operacao_producao_materiais');
    });
  });

  // ============================================================================
  // BLOCO 4: COMPATIBILIDADE DE GRANTS PARA SECURITY INVOKER
  // ============================================================================
  describe('4. Compatibilidade de Grants para SECURITY INVOKER', () => {
    it('4.1. Garante privilégio de SELECT para authenticated em todas as tabelas subjacentes das views', () => {
      const tabelasSubjacentes = [
        'audit_log',
        'operacoes_producao',
        'registros_ponto',
        'colaboradores',
        'empresas',
        'tipos_servico_operacional',
        'custos_extras_operacionais',
        'servicos_extras_operacionais',
        'intermitentes_lotes_fechamento',
      ];

      tabelasSubjacentes.forEach((tbl) => {
        const regex = new RegExp(`GRANT\\s+SELECT\\s+ON\\s+(?:public\\.)?${tbl}\\s+TO\\s+authenticated;`, 'i');
        expect(
          regex.test(migrationSql),
          `Tabela subjacente ${tbl} deve possuir GRANT SELECT TO authenticated para evitar erro 42501 no invoker.`
        ).toBe(true);
      });
    });

    it('4.2. Configura WITH (security_invoker = on) em todas as três views', () => {
      expect(migrationSql).toContain('CREATE OR REPLACE VIEW public.vw_audit_timeline_operacional\nWITH (security_invoker = on)');
      expect(migrationSql).toContain('CREATE OR REPLACE VIEW public.vw_operacoes_producao_resumo_dia\nWITH (security_invoker = on)');
      expect(migrationSql).toContain('CREATE OR REPLACE VIEW public.vw_aprovacoes_rh\nWITH (security_invoker = on)');
    });

    it('4.3. Preserva todas as 6 uniões e mapeamento canônico de situação em vw_aprovacoes_rh', () => {
      expect(migrationSql).toContain("'PONTO' AS tipo");
      expect(migrationSql).toContain("'OPERAÇÃO' AS tipo");
      expect(migrationSql).toContain("'CUSTO EXTRA' AS tipo");
      expect(migrationSql).toContain("'SERVIÇO EXTRA' AS tipo");
      expect(migrationSql).toContain("'DIARISTA' AS tipo");
      expect(migrationSql).toContain("'INTERMITENTE' AS tipo");
      expect(migrationSql).toContain("THEN 'Em análise'");
      expect(migrationSql).toContain("THEN 'Aprovado'");
      expect(migrationSql).toContain("THEN 'Devolvido'");
    });

    it('4.4. Preserva ordem das colunas em vw_operacoes_producao_resumo_dia iniciando com empresa_id (evita erro 42P16)', () => {
      const match = migrationSql.match(/CREATE OR REPLACE VIEW public\.vw_operacoes_producao_resumo_dia[\s\S]*?SELECT\s+([\s\S]*?)\s+FROM public\.operacoes_producao/i);
      expect(match).not.toBeNull();
      const selectClause = match![1].trim();
      expect(selectClause.startsWith('op.empresa_id,')).toBe(true);
      expect(selectClause).not.toMatch(/^op\.tenant_id/i);
    });
  });

  // ============================================================================
  // BLOCO 5: GOVERNANÇA TRANSACIONAL E NOTIFY
  // ============================================================================
  describe('5. Governança Transacional', () => {
    it('5.1. Migration é protegida por bloco transacional BEGIN / COMMIT', () => {
      expect(migrationSql).toContain('BEGIN;');
      expect(migrationSql).toContain('COMMIT;');
    });

    it('5.2. Emite recarga de cache do PostgREST via NOTIFY pgrst', () => {
      expect(migrationSql).toContain("NOTIFY pgrst, 'reload schema';");
    });
  });
});
