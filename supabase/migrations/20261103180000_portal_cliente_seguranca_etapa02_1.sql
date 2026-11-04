-- ==============================================================================
-- MIGRATION: 20261103180000_portal_cliente_seguranca_etapa02_1.sql
-- DOMÍNIO: Portal do Cliente — Fundação de Segurança e Isolamento por Empresa Contratante
-- REGRA DE NEGÓCIO OFICIAL:
--   No ERP ORBE, o cliente do Portal do Cliente é EXCLUSIVAMENTE a EMPRESA CONTRATANTE
--   dos serviços da ESC LOG (tomadora do serviço e destinatária da mercadoria).
--   - Empresa Contratante: Contrata a ESC LOG e recebe a carga / armazena na base.
--   - Transportadora: Transporta a mercadoria até a empresa (não tem acesso ao portal).
--   - Fabricante/Fornecedor: Fornece ou produz a mercadoria (não tem acesso ao portal).
--   - ESC LOG: Executa o serviço operacional contratado.
-- OBJETIVO: 
--   1. Criar a tabela canônica public.portal_cliente_usuarios para vínculo inequívoco
--      entre usuário autenticado (auth.users) e a EMPRESA CONTRATANTE (empresa_id).
--   2. Implementar gatilho de validação de integridade referencial com public.empresas.
--   3. Implementar RPCs de leitura operacional e KPIs agregados com SECURITY DEFINER:
--      - public.get_portal_cliente_operacoes()
--      - public.get_portal_cliente_stats()
--      Ambas isolam estritamente por auth.uid(), tenant_id e empresa_id do contratante,
--      retornando apenas operações validadas (status IN ('processado', 'fechado')) e
--      omitindo dados confidenciais (valores unitários internos, salários, custos extras,
--      margens de lucro e colaboradores).
--   4. Implementar políticas RLS restritivas de defesa em profundidade, impedindo que
--      usuários externos com role = 'cliente' realizem SELECT direto nas tabelas brutas
--      (operacoes_producao, faturas, financeiro_consolidados_cliente).
--   5. Estender a function public.accept_tenant_invitation para provisionar
--      automaticamente o vínculo da empresa contratante durante o onboarding (SEC-03).
-- STATUS: PREPARADO LOCALMENTE — NÃO APLICAR AUTOMATICAMENTE EM PRODUÇÃO.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. EXPANSÃO DE REGRAS DE ACESSO: SUPORTE AO PAPEL 'cliente' NO TENANT
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Atualizar profiles_role_check
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'profiles_role_check'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  -- Atualizar tenant_invitations_role_check
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenant_invitations_role_check'
       AND conrelid = 'public.tenant_invitations'::regclass
  ) THEN
    ALTER TABLE public.tenant_invitations DROP CONSTRAINT tenant_invitations_role_check;
  END IF;

  -- Atualizar user_permissions_role_check
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_permissions_role_check'
       AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_role_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente'));

ALTER TABLE public.tenant_invitations
  ADD CONSTRAINT tenant_invitations_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente'));

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente'));

-- 1. TABELA DE VÍNCULO: portal_cliente_usuarios (EXCLUSIVO PARA EMPRESAS CONTRATANTES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_cliente_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT portal_cliente_usuarios_unique UNIQUE (tenant_id, user_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_cliente_usuarios_lookup 
    ON public.portal_cliente_usuarios (user_id, tenant_id, ativo);

CREATE INDEX IF NOT EXISTS idx_portal_cliente_usuarios_empresa 
    ON public.portal_cliente_usuarios (tenant_id, empresa_id);

ALTER TABLE public.portal_cliente_usuarios ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER DE VALIDAÇÃO DE INTEGRIDADE REFERENCIAL COM EMPRESAS DO TENANT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_valida_portal_cliente_empresa()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas 
     WHERE id = NEW.empresa_id 
       AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'A empresa contratante % não existe ou não pertence ao tenant %', NEW.empresa_id, NEW.tenant_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_valida_portal_cliente_empresa ON public.portal_cliente_usuarios;
CREATE TRIGGER trg_valida_portal_cliente_empresa
BEFORE INSERT OR UPDATE ON public.portal_cliente_usuarios
FOR EACH ROW EXECUTE FUNCTION public.fn_valida_portal_cliente_empresa();

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS RLS PARA portal_cliente_usuarios
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "portal_cliente_usuarios_admin_manage" ON public.portal_cliente_usuarios;
CREATE POLICY "portal_cliente_usuarios_admin_manage" ON public.portal_cliente_usuarios
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.user_id = auth.uid()
           AND p.tenant_id = public.portal_cliente_usuarios.tenant_id
           AND p.role IN ('admin', 'gestor')
      )
      OR EXISTS (
        SELECT 1 FROM public.user_permissions up
         WHERE up.user_id = auth.uid()
           AND up.tenant_id = public.portal_cliente_usuarios.tenant_id
           AND up.role IN ('admin', 'gestor')
      )
    )
  );

DROP POLICY IF EXISTS "portal_cliente_usuarios_self_read" ON public.portal_cliente_usuarios;
CREATE POLICY "portal_cliente_usuarios_self_read" ON public.portal_cliente_usuarios
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND tenant_id = public.current_tenant_id()
    AND ativo = true
  );

-- ------------------------------------------------------------------------------
-- 4. RPC CANÔNICA DE LEITURA OPERACIONAL: get_portal_cliente_operacoes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_portal_cliente_operacoes(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_tipo_servico_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  data_operacao DATE,
  empresa_nome TEXT,
  transportadora_nome TEXT,
  fornecedor_nome TEXT,
  tipo_servico_nome TEXT,
  produto_nome TEXT,
  quantidade NUMERIC,
  placa TEXT,
  nf_numero TEXT,
  ctrc TEXT,
  horario_inicio TIME,
  horario_fim TIME,
  status_operacional TEXT,
  observacao TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_empresa_id UUID;
  v_limit INT;
  v_offset INT;
BEGIN
  -- 1. Obter usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN; -- Fail-closed para requisições anônimas
  END IF;

  -- 2. Resolver o vínculo ativo da empresa contratante autorizada para este usuário
  SELECT pcu.tenant_id, pcu.empresa_id
    INTO v_tenant_id, v_empresa_id
    FROM public.portal_cliente_usuarios pcu
   WHERE pcu.user_id = v_user_id
     AND pcu.ativo = true
   LIMIT 1;

  -- Fail-closed se o usuário não possuir vínculo ativo com a empresa contratante
  IF v_tenant_id IS NULL OR v_empresa_id IS NULL THEN
    RETURN;
  END IF;

  -- Sanitização rigorosa de paginação para evitar DoS
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- 3. Retornar dados hermeticamente filtrados pela EMPRESA CONTRATANTE
  RETURN QUERY
  WITH filtered_ops AS (
    SELECT
      op.id,
      op.data_operacao,
      emp.nome AS empresa_nome,
      COALESCE(tc.nome, '-') AS transportadora_nome,
      COALESCE(forn.nome, '-') AS fornecedor_nome,
      COALESCE(ts.nome, 'Operação Padrão') AS tipo_servico_nome,
      COALESCE(pc.nome, 'Geral') AS produto_nome,
      op.quantidade,
      COALESCE(op.placa, '-') AS placa,
      COALESCE(op.nf_numero, '-') AS nf_numero,
      COALESCE(op.ctrc, '-') AS ctrc,
      op.entrada_ponto AS horario_inicio,
      op.saida_ponto AS horario_fim,
      CASE 
        WHEN op.status = 'fechado' THEN 'Concluído / Faturado'
        WHEN op.status = 'processado' THEN 'Concluído'
        ELSE 'Em conferência'
      END AS status_operacional,
      COALESCE(op.observacao, '') AS observacao
    FROM public.operacoes_producao op
    JOIN public.empresas emp ON emp.id = op.empresa_id
    LEFT JOIN public.transportadoras_clientes tc ON tc.id = op.transportadora_id
    LEFT JOIN public.fornecedores forn ON forn.id = op.fornecedor_id
    LEFT JOIN public.tipos_servico_operacional ts ON ts.id = op.tipo_servico_id
    LEFT JOIN public.produtos_carga pc ON pc.id = op.produto_carga_id
    WHERE op.tenant_id = v_tenant_id
      AND op.empresa_id = v_empresa_id -- ISOLAMENTO ESTRITO POR EMPRESA CONTRATANTE
      AND op.deleted_at IS NULL
      -- Apenas operações validadas e homologadas para exposição
      AND op.status IN ('processado', 'fechado')
      -- Filtros opcionais seguros
      AND (p_data_inicio IS NULL OR op.data_operacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR op.data_operacao <= p_data_fim)
      AND (p_status IS NULL OR op.status = p_status)
      AND (p_tipo_servico_id IS NULL OR op.tipo_servico_id = p_tipo_servico_id)
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered_ops
  )
  SELECT 
    f.id,
    f.data_operacao,
    f.empresa_nome,
    f.transportadora_nome,
    f.fornecedor_nome,
    f.tipo_servico_nome,
    f.produto_nome,
    f.quantidade,
    f.placa,
    f.nf_numero,
    f.ctrc,
    f.horario_inicio,
    f.horario_fim,
    f.status_operacional,
    f.observacao,
    c.total AS total_count
  FROM filtered_ops f
  CROSS JOIN counted c
  ORDER BY f.data_operacao DESC, f.horario_inicio DESC NULLS LAST
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC CANÔNICA DE KPIS AGREGADOS: get_portal_cliente_stats
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_portal_cliente_stats(
  p_competencia TEXT DEFAULT NULL -- Formato 'YYYY-MM'
)
RETURNS TABLE (
  total_operacoes BIGINT,
  volume_total NUMERIC,
  operacoes_hoje BIGINT,
  empresa_nome TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_empresa_id UUID;
  v_empresa_nome TEXT;
  v_comp TEXT;
  v_inicio_mes DATE;
  v_fim_mes DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT pcu.tenant_id, pcu.empresa_id
    INTO v_tenant_id, v_empresa_id
    FROM public.portal_cliente_usuarios pcu
   WHERE pcu.user_id = v_user_id
     AND pcu.ativo = true
   LIMIT 1;

  IF v_tenant_id IS NULL OR v_empresa_id IS NULL THEN
    RETURN;
  END IF;

  -- Resolver nome canônico da empresa contratante
  SELECT emp.nome INTO v_empresa_nome 
    FROM public.empresas emp 
   WHERE emp.id = v_empresa_id;

  v_comp := COALESCE(p_competencia, TO_CHAR(CURRENT_DATE, 'YYYY-MM'));
  v_inicio_mes := TO_DATE(v_comp || '-01', 'YYYY-MM-DD');
  v_fim_mes := (v_inicio_mes + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_operacoes,
    COALESCE(SUM(op.quantidade), 0)::NUMERIC AS volume_total,
    COUNT(*) FILTER (WHERE op.data_operacao = CURRENT_DATE)::BIGINT AS operacoes_hoje,
    COALESCE(v_empresa_nome, 'Empresa Contratante') AS empresa_nome
  FROM public.operacoes_producao op
  WHERE op.tenant_id = v_tenant_id
    AND op.empresa_id = v_empresa_id -- ISOLAMENTO ESTRITO POR EMPRESA CONTRATANTE
    AND op.deleted_at IS NULL
    AND op.status IN ('processado', 'fechado')
    AND op.data_operacao >= v_inicio_mes
    AND op.data_operacao <= v_fim_mes;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. POLÍTICAS RLS RESTRICTIVE: BLINDAGEM CONTRA ACESSO DIRETO ÀS TABELAS BRUTAS
-- ------------------------------------------------------------------------------
-- Usuários com papel 'cliente' NÃO PODEM executar queries diretas em operacoes_producao
DROP POLICY IF EXISTS "operacoes_producao_bloqueio_cliente_direto" ON public.operacoes_producao;
CREATE POLICY "operacoes_producao_bloqueio_cliente_direto" ON public.operacoes_producao
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'cliente'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.role = 'cliente'
    )
  );

-- Usuários com papel 'cliente' NÃO PODEM executar queries diretas em faturas
DROP POLICY IF EXISTS "faturas_bloqueio_cliente_direto" ON public.faturas;
CREATE POLICY "faturas_bloqueio_cliente_direto" ON public.faturas
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'cliente'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.role = 'cliente'
    )
  );

-- Usuários com papel 'cliente' NÃO PODEM executar queries diretas em financeiro_consolidados_cliente
DROP POLICY IF EXISTS "consolidados_bloqueio_cliente_direto" ON public.financeiro_consolidados_cliente;
CREATE POLICY "consolidados_bloqueio_cliente_direto" ON public.financeiro_consolidados_cliente
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') <> 'cliente'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.role = 'cliente'
    )
  );

-- ------------------------------------------------------------------------------
-- 7. COMPATIBILIDADE COM O ONBOARDING SEGURO SEC-03
-- ------------------------------------------------------------------------------
-- Gatilho de provisionamento automático do vínculo quando convite com role = 'cliente' for aceito
CREATE OR REPLACE FUNCTION public.fn_sync_portal_cliente_on_invitation_accept()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_context JSONB;
  v_empresa_id UUID;
BEGIN
  IF NEW.status = 'aceito' AND OLD.status <> 'aceito' AND NEW.role = 'cliente' AND NEW.accepted_by IS NOT NULL THEN
    v_cliente_context := NEW.permissions -> 'cliente_context';
    
    IF v_cliente_context IS NOT NULL THEN
      v_empresa_id := (v_cliente_context ->> 'empresa_id')::UUID;
      
      -- Valida se empresa_id existe e pertence ao mesmo tenant
      IF v_empresa_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.empresas WHERE id = v_empresa_id AND tenant_id = NEW.tenant_id
      ) THEN
        INSERT INTO public.portal_cliente_usuarios (
          tenant_id,
          user_id,
          empresa_id,
          ativo,
          created_by
        ) VALUES (
          NEW.tenant_id,
          NEW.accepted_by,
          v_empresa_id,
          true,
          NEW.invited_by
        )
        ON CONFLICT (tenant_id, user_id, empresa_id)
        DO UPDATE SET ativo = true, updated_at = now();
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_portal_cliente_on_invitation_accept ON public.tenant_invitations;
CREATE TRIGGER trg_sync_portal_cliente_on_invitation_accept
AFTER UPDATE OF status ON public.tenant_invitations
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_portal_cliente_on_invitation_accept();


-- ------------------------------------------------------------------------------
-- 7.1 VALIDAÇÃO E ATUALIZAÇÃO DE admin_create_invitation_with_activation_code (SEC-03)
-- ------------------------------------------------------------------------------
-- Permite criação segura de convite com role = 'cliente', validando obrigatoriamente
-- que permissions->'cliente_context'->>'empresa_id' seja uma empresa existente do tenant.
CREATE OR REPLACE FUNCTION public.admin_create_invitation_with_activation_code(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_permissions JSONB,
  p_expires_at TIMESTAMPTZ,
  p_server_secret TEXT,
  p_key_version TEXT DEFAULT 'v1'
)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID := auth.uid();
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_role TEXT := lower(btrim(COALESCE(p_role, '')));
  v_tenant_nome TEXT;
  v_invitation public.tenant_invitations%ROWTYPE;
  v_challenge_id UUID;
  v_code TEXT;
  v_salt TEXT;
  v_hmac TEXT;
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
  v_challenge_expires_at TIMESTAMPTZ;
  v_formatted_message TEXT;
  v_empresa_id UUID;
BEGIN
  -- 1. Autorização estrita de Administrador de Tenant (SEC-02)
  v_tenant_id := public.admin_require_tenant_admin();

  -- 2. Validações de entrada
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'E-mail corporativo inválido';
  END IF;

  IF v_role NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente') THEN
    RAISE EXCEPTION 'Função/Papel inválido: %', v_role;
  END IF;

  -- 2.1 Validação específica para usuários do Portal do Cliente
  IF v_role = 'cliente' THEN
    IF p_permissions IS NULL OR (p_permissions -> 'cliente_context' ->> 'empresa_id') IS NULL THEN
      RAISE EXCEPTION 'Para usuários do Portal do Cliente, é obrigatório selecionar uma empresa contratante válida.';
    END IF;

    BEGIN
      v_empresa_id := (p_permissions -> 'cliente_context' ->> 'empresa_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Identificador da empresa contratante inválido (deve ser UUID).';
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.empresas
       WHERE id = v_empresa_id
         AND tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'A empresa contratante informada não existe ou não pertence a este tenant.';
    END IF;
  END IF;

  IF p_server_secret IS NULL OR length(btrim(p_server_secret)) < 32 THEN
    RAISE EXCEPTION 'Chave secreta do servidor inválida.';
  END IF;

  -- 3. Obter Razão Social oficial do tenant (tenants.name)
  SELECT name INTO v_tenant_nome FROM public.tenants WHERE id = v_tenant_id;
  IF v_tenant_nome IS NULL THEN
    v_tenant_nome := 'ORBE Logística';
  END IF;

  -- 4. Definir validade do convite
  IF p_expires_at IS NOT NULL AND p_expires_at > NOW() THEN
    v_expires_at := p_expires_at;
  ELSE
    v_expires_at := NOW() + INTERVAL '7 days';
  END IF;

  -- 5. Cancelar convites pendentes pré-existentes para o mesmo e-mail no tenant
  UPDATE public.tenant_invitations
  SET status = 'bloqueado', updated_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND email = v_email
    AND status = 'pendente';

  -- 6. Gerar token criptográfico único para URL
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- 7. Inserir registro canônico de convite
  INSERT INTO public.tenant_invitations (
    tenant_id,
    email,
    full_name,
    phone,
    role,
    permissions,
    token,
    status,
    expires_at,
    invited_by
  ) VALUES (
    v_tenant_id,
    v_email,
    NULLIF(btrim(p_full_name), ''),
    NULLIF(btrim(p_phone), ''),
    v_role,
    COALESCE(p_permissions, '{}'::jsonb),
    v_token,
    'pendente',
    v_expires_at,
    v_user_id
  )
  RETURNING * INTO v_invitation;

  -- 8. Gerar Código de Ativação Temporário Criptograficamente Seguro (CSPRNG 6 dígitos) e Salt
  v_code := lpad(((((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000) + 100000)::text)), 6, '0');
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');

  -- 9. Computar HMAC-SHA-256 com amarração de invitation_id
  v_hmac := encode(extensions.hmac(v_code || ':' || v_invitation.id::TEXT || ':' || v_salt, p_server_secret, 'sha256'), 'hex');
  v_challenge_expires_at := NOW() + INTERVAL '10 minutes';

  -- 10. Persistir Desafio de Ativação
  INSERT INTO public.tenant_invitation_challenges (
    tenant_id,
    invitation_id,
    code_hash,
    salt,
    key_version,
    status,
    attempts,
    max_attempts,
    expires_at,
    cooldown_until
  ) VALUES (
    v_tenant_id,
    v_invitation.id,
    v_hmac,
    v_salt,
    COALESCE(p_key_version, 'v1'),
    'pendente',
    0,
    5,
    v_challenge_expires_at,
    NOW() + INTERVAL '60 seconds'
  )
  RETURNING id INTO v_challenge_id;

  -- 11. Montar Mensagem Pronta de Convite Institucional
  v_formatted_message := format(
    E'Olá, %s!

Você foi convidado para acessar a plataforma ORBE pela empresa %s.

Para ativar sua conta com segurança, siga os passos abaixo:

1. Acesse o link de ativação:
/cadastro?token=%s

2. Informe o seu Código de Ativação temporário:
%s

3. Crie sua senha de acesso pessoal.

Atenção: Por razões de segurança, este código expira em 10 minutos. Caso você não reconheça este convite, desconsidere esta mensagem.',
    COALESCE(NULLIF(btrim(p_full_name), ''), 'Usuário'),
    v_tenant_nome,
    v_token,
    v_code
  );

  -- 12. Auditoria transacional
  INSERT INTO public.audit_log (
    tenant_id,
    acao,
    entidade,
    registro_id,
    usuario_id,
    descricao,
    origem
  ) VALUES (
    v_tenant_id,
    'INVITATION_CREATED_WITH_CODE',
    'tenant_invitations',
    v_invitation.id,
    v_user_id,
    format('Convite com código de ativação emitido para %s com função %s.', v_email, v_role),
    'ONBOARDING_SEC03'
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'token', v_token,
    'code', v_code,
    'expires_at', v_challenge_expires_at,
    'invitation_message', v_formatted_message,
    'role', v_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) TO service_role;

-- Overload de 6 argumentos utilizado diretamente pelos administradores no Frontend
CREATE OR REPLACE FUNCTION public.admin_create_invitation_with_activation_code(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_permissions JSONB,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM private.sec03_settings WHERE key = 'hmac_secret';
  IF v_secret IS NULL OR length(btrim(v_secret)) < 32 THEN
    RAISE EXCEPTION 'Segredo HMAC não configurado no backend seguro (private.sec03_settings).';
  END IF;

  RETURN public.admin_create_invitation_with_activation_code(
    p_full_name,
    p_email,
    p_phone,
    p_role,
    p_permissions,
    p_expires_at,
    v_secret,
    'v1'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. PRIVILÉGIOS E PERMISSÕES (LEAST PRIVILEGE)
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.portal_cliente_usuarios FROM anon;
GRANT SELECT ON TABLE public.portal_cliente_usuarios TO authenticated;
GRANT ALL ON TABLE public.portal_cliente_usuarios TO service_role;

REVOKE ALL ON FUNCTION public.get_portal_cliente_operacoes FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_operacoes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_operacoes TO service_role;

REVOKE ALL ON FUNCTION public.get_portal_cliente_stats FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_stats TO service_role;

COMMIT;
