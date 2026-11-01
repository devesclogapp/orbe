# REGISTRO DAS DEFINIÇÕES ANTERIORES (ESTADO PRÉ-FIX-SEC-01)

Documento de referência para governança, auditoria e procedimentos de contingência do ERP Orbe.

---

## 1. Tabelas com RLS Desativado no Estado Anterior

### 1.1 `public.lancamentos_diaristas`
- **Estado RLS:** Desativado (`rowsecurity = false`).
- **Políticas existentes no banco:**
  - `full_access_lancamentos_diaristas` (PERMISSIVE, FOR ALL, TO public, com cláusula incondicional `1=1`)
  - `restrictive_tenant_isolation_lancamentos_diaristas` (RESTRICTIVE, FOR ALL, TO authenticated, `tenant_id = current_tenant_id()`)
- **Vulnerabilidade:** Como RLS estava desativado, as políticas eram inócuas e a role `anon` possuía leitura irrestrita.

### 1.2 `public.diaristas_lotes_fechamento`
- **Estado RLS:** Desativado (`rowsecurity = false`).
- **Políticas existentes no banco:**
  - `full_access_diaristas_lotes_fechamento` (PERMISSIVE, FOR ALL, TO public, com cláusula incondicional `1=1`)
  - `restrictive_tenant_isolation_diaristas_lotes_fechamento` (RESTRICTIVE, FOR ALL, TO authenticated, `tenant_id = current_tenant_id()`)
- **Vulnerabilidade:** Acesso anônimo a fechamentos financeiros e lotes de diaristas.

### 1.3 `public.regras_financeiras_versoes`
- **Estado RLS:** Desativado (`rowsecurity = false`).
- **Políticas:** Nenhuma política cadastrada.
- **Vulnerabilidade:** Acesso anônimo irrestrito.

### 1.4 `public.financeiro_consolidados_snapshots`
- **Estado RLS:** Desativado (`rowsecurity = false`).
- **Políticas:** Nenhuma política cadastrada.
- **Vulnerabilidade:** Acesso anônimo irrestrito a fechamentos DRE consolidados.

### 1.5 `public.documentos_anexos`
- **Estado RLS:** Desativado (`rowsecurity = false`).
- **Políticas:** Nenhuma política cadastrada.
- **Vulnerabilidade:** Acesso anônimo irrestrito a metadados e URLs de arquivos anexos.

### 1.6 `public.equipes`
- **Estado RLS:** Desativado (`rowsecurity = false`).
- **Políticas:** Nenhuma política cadastrada.
- **Vulnerabilidade:** Acesso anônimo irrestrito a equipes operacionais.

---

## 2. Tabelas com RLS Ativo mas Políticas Inseguras Expondo para Anon

### 2.1 `public.materiais_operacionais`
- **Estado RLS:** Ativado (`rowsecurity = true`).
- **Políticas vulneráveis:**
  - `Acesso leitura autenticado materiais_operacionais` (FOR SELECT TO public USING (true)) -> concedia leitura para anon.
  - `Acesso total admin materiais_operacionais` (FOR ALL TO authenticated USING (true)).

### 2.2 `public.operacao_producao_materiais`
- **Estado RLS:** Ativado (`rowsecurity = true`).
- **Políticas vulneráveis:**
  - `Acesso leitura autenticado operacao_producao_materiais` (FOR SELECT TO public USING (true)) -> concedia leitura para anon.
  - `Acesso insert autenticado operacao_producao_materiais` (FOR INSERT TO authenticated WITH CHECK (true)).

---

## 3. Views (Definições Anteriores sem Security Invoker)

No estado anterior, as 3 views foram criadas com o comportamento padrão do PostgreSQL (`security_invoker = false`, operando como SECURITY DEFINER do criador da view). Com privilégio de `SELECT` concedido a `public`/`anon`, o PostgREST expunha todas as linhas das tabelas base sem aplicar as policies do usuário da requisição.

- `public.vw_audit_timeline_operacional`:
  - `security_invoker = false`
  - Consulta: `SELECT ... FROM public.audit_log a ORDER BY a.created_at DESC;`
- `public.vw_operacoes_producao_resumo_dia`:
  - `security_invoker = false`
  - Consulta: `SELECT ... FROM public.operacoes_producao op GROUP BY ...;`
- `public.vw_aprovacoes_rh`:
  - `security_invoker = false`
  - Consulta: União de `registros_ponto`, `operacoes_producao`, `custos_extras_operacionais`, `servicos_extras_operacionais`, `lancamentos_diaristas`, `intermitentes_lotes_fechamento`.
