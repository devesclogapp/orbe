import { Client } from 'pg';

async function runLote2Tests() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54332,
    user: 'postgres',
    database: 'postgres',
  });

  console.log('Conectando ao PostgreSQL isolado na porta 54332...');
  await client.connect();
  console.log('PostgreSQL conectado com sucesso!');

  // =========================================================================
  // SETUP DO SCHEMA IDÊNTICO AO SUPABASE
  // =========================================================================
  console.log('\n--- CRIANDO SCHEMA REAL DO ORBE NO POSTGRESQL ISOLADO ---');

  await client.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    DROP TABLE IF EXISTS public.receitas_operacionais_historico CASCADE;
    DROP TABLE IF EXISTS public.receitas_operacionais_itens CASCADE;
    DROP TABLE IF EXISTS public.receitas_operacionais CASCADE;
    DROP TABLE IF EXISTS public.production_entry_collaborators CASCADE;
    DROP TABLE IF EXISTS public.operacao_producao_materiais CASCADE;
    DROP TABLE IF EXISTS public.operacoes_producao CASCADE;
    DROP TABLE IF EXISTS public.fornecedor_valores_servico CASCADE;
    DROP TABLE IF EXISTS public.formas_pagamento_operacional CASCADE;
    DROP TABLE IF EXISTS public.produtos_carga CASCADE;
    DROP TABLE IF EXISTS public.fornecedores CASCADE;
    DROP TABLE IF EXISTS public.transportadoras_clientes CASCADE;
    DROP TABLE IF EXISTS public.tipos_servico_operacional CASCADE;
    DROP TABLE IF EXISTS public.unidades CASCADE;
    DROP TABLE IF EXISTS public.colaboradores CASCADE;
    DROP TABLE IF EXISTS public.empresas CASCADE;
    DROP TABLE IF EXISTS public.profiles CASCADE;
    DROP TABLE IF EXISTS public.tenants CASCADE;

    -- 1. Tenants e Perfis
    CREATE TABLE public.tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome TEXT NOT NULL
    );

    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      tenant_id UUID REFERENCES public.tenants(id),
      role TEXT NOT NULL,
      full_name TEXT NOT NULL
    );

    -- 2. Empresas e Cadastros
    CREATE TABLE public.empresas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      nome TEXT NOT NULL,
      is_teste BOOLEAN DEFAULT false
    );

    CREATE TABLE public.unidades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      nome TEXT NOT NULL
    );

    CREATE TABLE public.tipos_servico_operacional (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      nome TEXT NOT NULL,
      is_extra_service BOOLEAN DEFAULT false
    );

    CREATE TABLE public.transportadoras_clientes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      empresa_id UUID REFERENCES public.empresas(id),
      nome TEXT NOT NULL
    );

    CREATE TABLE public.fornecedores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      empresa_id UUID REFERENCES public.empresas(id),
      nome TEXT NOT NULL
    );

    CREATE TABLE public.produtos_carga (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      nome TEXT NOT NULL
    );

    CREATE TABLE public.formas_pagamento_operacional (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      nome TEXT NOT NULL,
      modalidade TEXT NOT NULL
    );

    CREATE TABLE public.colaboradores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      empresa_id UUID REFERENCES public.empresas(id),
      nome TEXT NOT NULL,
      cargo TEXT NOT NULL,
      cpf TEXT,
      tipo_colaborador TEXT NOT NULL DEFAULT 'INTERMITENTE'
    );

    -- 3. Tabela Mãe: operacoes_producao
    CREATE TABLE public.operacoes_producao (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      unidade_id UUID REFERENCES public.unidades(id),
      data_operacao DATE NOT NULL,
      data_vencimento DATE,
      data_pagamento DATE,
      tipo_servico_id UUID NOT NULL REFERENCES public.tipos_servico_operacional(id),
      transportadora_id UUID NOT NULL REFERENCES public.transportadoras_clientes(id),
      fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id),
      produto_carga_id UUID REFERENCES public.produtos_carga(id),
      forma_pagamento_id UUID REFERENCES public.formas_pagamento_operacional(id),
      quantidade NUMERIC NOT NULL,
      quantidade_colaboradores INTEGER NOT NULL DEFAULT 1,
      valor_unitario_snapshot NUMERIC NOT NULL,
      tipo_calculo_snapshot TEXT NOT NULL DEFAULT 'volume',
      valor_descarga NUMERIC NOT NULL,
      percentual_iss NUMERIC DEFAULT 0,
      custo_com_iss NUMERIC DEFAULT 0,
      valor_total_materiais NUMERIC DEFAULT 0,
      valor_total NUMERIC NOT NULL,
      placa TEXT,
      ctrc TEXT,
      nf_numero TEXT,
      entrada_ponto TEXT,
      saida_ponto TEXT,
      status TEXT NOT NULL DEFAULT 'RECEBIDO' CHECK (status IN ('RECEBIDO', 'EM_VALIDACAO', 'EM_RESTRICAO', 'AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO')),
      status_rh TEXT NOT NULL DEFAULT 'PENDENTE_RH' CHECK (status_rh IN ('PENDENTE_RH', 'EM_ANALISE_RH', 'VALIDADO_RH', 'DEVOLVIDO_RH')),
      status_pagamento TEXT DEFAULT 'PENDENTE',
      avaliacao_json JSONB DEFAULT '{}'::jsonb,
      observacoes TEXT,
      origem_dado TEXT DEFAULT 'manual',
      responsavel_nome TEXT,
      criado_em TIMESTAMPTZ DEFAULT now(),
      atualizado_em TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      deleted_by UUID,
      motivo_exclusao TEXT
    );

    -- 4. Equipe e Materiais
    CREATE TABLE public.production_entry_collaborators (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      production_entry_id UUID NOT NULL REFERENCES public.operacoes_producao(id) ON DELETE CASCADE,
      collaborator_id UUID NOT NULL REFERENCES public.colaboradores(id),
      had_infraction BOOLEAN DEFAULT false,
      infraction_type_id UUID,
      infraction_notes TEXT,
      entrada_ponto TEXT,
      saida_almoco TEXT,
      retorno_almoco TEXT,
      saida_ponto TEXT
    );

    CREATE TABLE public.operacao_producao_materiais (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operacao_id UUID NOT NULL REFERENCES public.operacoes_producao(id) ON DELETE CASCADE,
      material_id UUID,
      nome_snapshot TEXT,
      unidade_snapshot TEXT,
      valor_unitario_snapshot NUMERIC,
      quantidade NUMERIC,
      valor_total NUMERIC
    );

    -- 5. Receitas Operacionais e Itens (Pipeline de Faturamento)
    CREATE TABLE public.receitas_operacionais (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      empresa_id UUID NOT NULL REFERENCES public.empresas(id),
      unidade_id UUID REFERENCES public.unidades(id),
      modalidade TEXT NOT NULL,
      valor_total NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('aguardando_fechamento', 'pendente_cobranca', 'cobranca_enviada', 'pendente_recebimento', 'recebido', 'conciliado', 'cancelado')),
      competencia VARCHAR(7) NOT NULL,
      vencimento DATE,
      data_recebimento DATE,
      observacao TEXT,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
      updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );

    CREATE TABLE public.receitas_operacionais_itens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      receita_id UUID NOT NULL REFERENCES public.receitas_operacionais(id) ON DELETE CASCADE,
      operacao_id UUID REFERENCES public.operacoes_producao(id),
      servico_extra_id UUID,
      valor_item NUMERIC NOT NULL
    );

    CREATE UNIQUE INDEX idx_receitas_operacionais_itens_operacao_id
    ON public.receitas_operacionais_itens (operacao_id)
    WHERE operacao_id IS NOT NULL;

    CREATE TABLE public.receitas_operacionais_historico (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id),
      receita_id UUID NOT NULL REFERENCES public.receitas_operacionais(id) ON DELETE CASCADE,
      acao TEXT NOT NULL,
      status_anterior TEXT,
      status_novo TEXT,
      usuario_id UUID,
      detalhes JSONB,
      created_at TIMESTAMPTZ DEFAULT clock_timestamp()
    );

    -- Mock de current_setting e auth.uid()
    CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS UUID AS $$
      SELECT id FROM public.tenants LIMIT 1;
    $$ LANGUAGE sql STABLE;

    -- Funções e RPCs do Orbe
    CREATE OR REPLACE FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(
        p_tenant_id UUID,
        p_empresa_id UUID,
        p_competencia VARCHAR,
        p_vencimento DATE,
        p_unidade_id UUID DEFAULT NULL
    )
    RETURNS UUID
    LANGUAGE plpgsql
    AS $$
    DECLARE
        v_receita_id UUID;
        v_existe_fechada BOOLEAN;
        v_now TIMESTAMPTZ := clock_timestamp();
    BEGIN
        SELECT id INTO v_receita_id
        FROM public.receitas_operacionais
        WHERE tenant_id = p_tenant_id
          AND empresa_id = p_empresa_id
          AND competencia = p_competencia
          AND modalidade = 'FATURAMENTO_MENSAL'
          AND status = 'aguardando_fechamento'
        FOR UPDATE;

        IF v_receita_id IS NOT NULL THEN
            RETURN v_receita_id;
        END IF;

        INSERT INTO public.receitas_operacionais (
            tenant_id, empresa_id, unidade_id, modalidade, valor_total,
            status, competencia, vencimento, created_at, updated_at
        ) VALUES (
            p_tenant_id, p_empresa_id, p_unidade_id, 'FATURAMENTO_MENSAL', 0,
            'aguardando_fechamento', p_competencia, p_vencimento, v_now, v_now
        ) RETURNING id INTO v_receita_id;

        RETURN v_receita_id;
    END;
    $$;

    -- Trigger Automática: Operação -> Receita
    CREATE OR REPLACE FUNCTION public.fn_gerar_receita_operacional_automatica()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
        v_receita_id UUID;
        v_forma_pgto_nome TEXT;
        v_forma_pgto_modalidade TEXT;
        v_modalidade TEXT := 'DUPLICATA';
        v_status TEXT := 'pendente_cobranca';
        v_vencimento DATE := NULL;
        v_competencia VARCHAR(7) := NULL;
        v_existente BOOLEAN;
    BEGIN
        IF NEW.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO') 
           AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.status IS NULL) THEN
            
            SELECT EXISTS (
                SELECT 1 FROM public.receitas_operacionais_itens 
                WHERE operacao_id = NEW.id
            ) INTO v_existente;

            IF NOT v_existente THEN
                IF NEW.forma_pagamento_id IS NOT NULL THEN
                    SELECT upper(trim(nome)), upper(trim(coalesce(modalidade, ''))) INTO v_forma_pgto_nome, v_forma_pgto_modalidade
                    FROM public.formas_pagamento_operacional 
                    WHERE id = NEW.forma_pagamento_id;

                    IF v_forma_pgto_nome LIKE '%FATURAMENTO%' OR v_forma_pgto_nome LIKE '%MENSAL%' OR v_forma_pgto_modalidade = 'FATURAMENTO_MENSAL' THEN
                        v_modalidade := 'FATURAMENTO_MENSAL';
                    ELSIF v_forma_pgto_nome LIKE '%DINHEIRO%' OR v_forma_pgto_nome LIKE '%PIX%' OR v_forma_pgto_nome LIKE '%CART%' OR v_forma_pgto_nome LIKE '%DEBITO%' OR v_forma_pgto_modalidade = 'CAIXA_IMEDIATO' THEN
                        v_modalidade := 'CAIXA_IMEDIATO';
                    ELSIF v_forma_pgto_modalidade IS NOT NULL AND v_forma_pgto_modalidade NOT IN ('', 'AMBOS') THEN
                        v_modalidade := v_forma_pgto_modalidade;
                    ELSE
                        v_modalidade := 'DUPLICATA';
                    END IF;
                END IF;

                v_competencia := to_char(NEW.data_operacao, 'YYYY-MM');

                -- FLUXO A: FATURAMENTO_MENSAL
                IF v_modalidade = 'FATURAMENTO_MENSAL' THEN
                    v_vencimento := (date_trunc('month', NEW.data_operacao) + INTERVAL '1 month' - INTERVAL '1 day')::date;
                    v_receita_id := public.fn_obter_ou_criar_receita_mensal_aberta(
                        NEW.tenant_id, NEW.empresa_id, v_competencia, v_vencimento, NEW.unidade_id
                    );

                    INSERT INTO public.receitas_operacionais_itens (
                        tenant_id, receita_id, operacao_id, valor_item
                    ) VALUES (
                        NEW.tenant_id, v_receita_id, NEW.id, NEW.valor_total
                    ) ON CONFLICT (operacao_id) WHERE operacao_id IS NOT NULL DO NOTHING;

                    UPDATE public.receitas_operacionais
                    SET valor_total = (
                        SELECT COALESCE(SUM(valor_item), 0)
                        FROM public.receitas_operacionais_itens
                        WHERE receita_id = v_receita_id
                    ),
                    updated_at = clock_timestamp()
                    WHERE id = v_receita_id;

                -- FLUXO B: CAIXA_IMEDIATO OU DUPLICATA
                ELSE
                    IF v_modalidade = 'CAIXA_IMEDIATO' THEN
                        v_status := 'pendente_recebimento';
                        v_vencimento := COALESCE(NEW.data_vencimento, NEW.data_operacao);
                    ELSE
                        v_status := 'pendente_cobranca';
                        v_vencimento := COALESCE(NEW.data_vencimento, NEW.data_operacao);
                    END IF;

                    INSERT INTO public.receitas_operacionais (
                        tenant_id, empresa_id, unidade_id, modalidade, valor_total,
                        status, competencia, vencimento
                    ) VALUES (
                        NEW.tenant_id, NEW.empresa_id, NEW.unidade_id, v_modalidade, NEW.valor_total,
                        v_status, v_competencia, v_vencimento
                    ) RETURNING id INTO v_receita_id;

                    INSERT INTO public.receitas_operacionais_itens (
                        tenant_id, receita_id, operacao_id, valor_item
                    ) VALUES (
                        NEW.tenant_id, v_receita_id, NEW.id, NEW.valor_total
                    );
                END IF;

            END IF;
        END IF;

        RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_gerar_receita_operacional_automatica
    AFTER UPDATE ON public.operacoes_producao
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_gerar_receita_operacional_automatica();

    -- RPC rpc_operacao_validar_aprovar (versão atual do banco)
    CREATE OR REPLACE FUNCTION public.rpc_operacao_validar_aprovar(
        p_operacao_id UUID,
        p_updated_at_frontend TIMESTAMPTZ
    )
    RETURNS JSON
    LANGUAGE plpgsql
    AS $$
    DECLARE
        v_operacao record;
        v_now timestamptz := now();
    BEGIN
        SELECT * INTO v_operacao 
        FROM public.operacoes_producao 
        WHERE id = p_operacao_id 
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
        END IF;

        IF p_updated_at_frontend IS NULL OR v_operacao.atualizado_em != p_updated_at_frontend THEN
            RAISE EXCEPTION 'CONCURRENCY_CONFLICT: O registro de operação % alterou na base desde a sua última leitura.', p_operacao_id;
        END IF;

        IF v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO') THEN
            RAISE EXCEPTION 'ESTADO_FECHADO: Operação já vinculada ao fluxo financeiro não pode ser aprovada novamente.';
        END IF;

        UPDATE public.operacoes_producao
        SET status = 'AGUARDANDO_FATURAMENTO',
            status_rh = 'PENDENTE_RH',
            atualizado_em = v_now
        WHERE id = p_operacao_id;
        
        RETURN json_build_object('success', true, 'operacao_id', p_operacao_id, 'updated_at', v_now);
    END;
    $$;

    -- RPC rpc_operacao_regularizar_horarios
    CREATE OR REPLACE FUNCTION public.rpc_operacao_regularizar_horarios(
        p_operacao_id UUID,
        p_horario_inicio TEXT,
        p_horario_fim TEXT,
        p_justificativa TEXT DEFAULT NULL
    )
    RETURNS JSON
    LANGUAGE plpgsql
    AS $$
    DECLARE
        v_op record;
        v_now timestamptz := now();
        v_aval jsonb;
    BEGIN
        SELECT * INTO v_op FROM public.operacoes_producao WHERE id = p_operacao_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'OP_NOT_FOUND'; END IF;
        
        v_aval := COALESCE(v_op.avaliacao_json, '{}'::jsonb);
        v_aval := v_aval - 'motivo_restricao';

        UPDATE public.operacoes_producao
        SET entrada_ponto = p_horario_inicio,
            saida_ponto = p_horario_fim,
            status = 'RECEBIDO',
            avaliacao_json = v_aval,
            atualizado_em = v_now
        WHERE id = p_operacao_id;

        RETURN json_build_object('success', true, 'operacao_id', p_operacao_id, 'status', 'RECEBIDO');
    END;
    $$;

    -- RPC rpc_receita_confirmar_recebimento
    CREATE OR REPLACE FUNCTION public.rpc_receita_confirmar_recebimento(
        p_receita_id UUID,
        p_data_recebimento DATE DEFAULT NULL
    )
    RETURNS JSON
    LANGUAGE plpgsql
    AS $$
    DECLARE
        v_receita RECORD;
        v_now TIMESTAMPTZ := clock_timestamp();
        v_data_real DATE;
        v_op_ids UUID[];
    BEGIN
        SELECT * INTO v_receita FROM public.receitas_operacionais WHERE id = p_receita_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'REC_NOT_FOUND'; END IF;

        v_data_real := COALESCE(p_data_recebimento, CURRENT_DATE);

        UPDATE public.receitas_operacionais
        SET status = 'recebido', data_recebimento = v_data_real, updated_at = v_now
        WHERE id = p_receita_id;

        SELECT array_agg(operacao_id) INTO v_op_ids
        FROM public.receitas_operacionais_itens
        WHERE receita_id = p_receita_id AND operacao_id IS NOT NULL;

        IF v_op_ids IS NOT NULL AND array_length(v_op_ids, 1) > 0 THEN
            UPDATE public.operacoes_producao
            SET status_pagamento = 'RECEBIDO',
                data_pagamento = v_data_real,
                status = CASE 
                    WHEN status_rh = 'VALIDADO_RH' 
                         AND status != 'EM_RESTRICAO' 
                         AND status_rh != 'DEVOLVIDO_RH'
                         AND status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'RECEBIDO', 'EM_VALIDACAO', 'CONCLUIDO')
                    THEN 'CONCLUIDO'
                    ELSE status
                END,
                atualizado_em = v_now
            WHERE id = ANY(v_op_ids);
        END IF;

        RETURN json_build_object('success', true, 'receita_id', p_receita_id, 'status', 'recebido');
    END;
    $$;

    -- RPC rpc_rh_aprovar_operacao
    CREATE OR REPLACE FUNCTION public.rpc_rh_aprovar_operacao(p_operacao_id UUID)
    RETURNS JSON
    LANGUAGE plpgsql
    AS $$
    BEGIN
        UPDATE public.operacoes_producao
        SET status_rh = 'VALIDADO_RH',
            atualizado_em = now()
        WHERE id = p_operacao_id;
        
        RETURN json_build_object('success', true);
    END;
    $$;
  `);

  console.log('Schema e triggers criados com sucesso!');

  // =========================================================================
  // SEED DE DADOS SINTÉTICOS DE HOMOLOGAÇÃO
  // =========================================================================
  console.log('\n--- POVOANDO DADOS SINTÉTICOS DE TESTE ---');

  const tenantRes = await client.query(`
    INSERT INTO public.tenants (nome) VALUES ('Tenant ESC LOG Homologação') RETURNING id;
  `);
  const tenantId = tenantRes.rows[0].id;

  const empRes = await client.query(`
    INSERT INTO public.empresas (tenant_id, nome, is_teste) 
    VALUES ($1, 'Empresa Teste Homologação S/A', true) RETURNING id;
  `, [tenantId]);
  const empresaId = empRes.rows[0].id;

  const unidRes = await client.query(`
    INSERT INTO public.unidades (tenant_id, empresa_id, nome)
    VALUES ($1, $2, 'Unidade Doca 01') RETURNING id;
  `, [tenantId, empresaId]);
  const unidadeId = unidRes.rows[0].id;

  const servRes = await client.query(`
    INSERT INTO public.tipos_servico_operacional (tenant_id, nome)
    VALUES ($1, 'Descarga Padrão') RETURNING id;
  `, [tenantId]);
  const servicoId = servRes.rows[0].id;

  const transpRes = await client.query(`
    INSERT INTO public.transportadoras_clientes (tenant_id, empresa_id, nome)
    VALUES ($1, $2, 'Transportadora Rápida Teste') RETURNING id;
  `, [tenantId, empresaId]);
  const transpId = transpRes.rows[0].id;

  const fornRes = await client.query(`
    INSERT INTO public.fornecedores (tenant_id, empresa_id, nome)
    VALUES ($1, $2, 'Fornecedor Bebidas Brasil') RETURNING id;
  `, [tenantId, empresaId]);
  const fornId = fornRes.rows[0].id;

  const prodRes = await client.query(`
    INSERT INTO public.produtos_carga (tenant_id, nome)
    VALUES ($1, 'Bebidas em Caixa 24x350ml') RETURNING id;
  `, [tenantId]);
  const produtoId = prodRes.rows[0].id;

  const fpMensalRes = await client.query(`
    INSERT INTO public.formas_pagamento_operacional (tenant_id, nome, modalidade)
    VALUES ($1, 'Faturamento Mensal 30 Dias', 'FATURAMENTO_MENSAL') RETURNING id;
  `, [tenantId]);
  const fpMensalId = fpMensalRes.rows[0].id;

  const fpDupRes = await client.query(`
    INSERT INTO public.formas_pagamento_operacional (tenant_id, nome, modalidade)
    VALUES ($1, 'Boleto Bancário 15 Dias', 'DUPLICATA') RETURNING id;
  `, [tenantId]);
  const fpDupId = fpDupRes.rows[0].id;

  const fpCaixaRes = await client.query(`
    INSERT INTO public.formas_pagamento_operacional (tenant_id, nome, modalidade)
    VALUES ($1, 'PIX / Caixa Imediato', 'CAIXA_IMEDIATO') RETURNING id;
  `, [tenantId]);
  const fpCaixaId = fpCaixaRes.rows[0].id;

  const colab1Res = await client.query(`
    INSERT INTO public.colaboradores (tenant_id, empresa_id, nome, cargo, cpf)
    VALUES ($1, $2, 'Colaborador Intermitente 01', 'Chapa', '111.222.333-44') RETURNING id;
  `, [tenantId, empresaId]);
  const colab1Id = colab1Res.rows[0].id;

  const colab2Res = await client.query(`
    INSERT INTO public.colaboradores (tenant_id, empresa_id, nome, cargo, cpf)
    VALUES ($1, $2, 'Colaborador Intermitente 02', 'Operador Paleteira', '222.333.444-55') RETURNING id;
  `, [tenantId, empresaId]);
  const colab2Id = colab2Res.rows[0].id;

  console.log('Dados sintéticos criados com sucesso!');

  const resultados: Array<{ cenario: string; status: 'PASSOU' | 'FALHOU'; detalhe: string }> = [];

  // =========================================================================
  // CENÁRIO 1 — OPERAÇÃO VÁLIDA
  // =========================================================================
  console.log('\n=============================================================');
  console.log('EXECUTANDO CENÁRIO 1 — Operação válida: cálculos, snapshots e persistência');
  console.log('=============================================================');

  const qtd1 = 1200;
  const unit1 = 0.85;
  const vDescarga1 = qtd1 * unit1; // 1020.00
  const issPct1 = 0.05; // 5%
  const issValor1 = vDescarga1 * issPct1; // 51.00
  const vMateriais1 = 30.00; // filme stretch
  const vTotal1 = vDescarga1 + issValor1 + vMateriais1; // 1101.00

  const op1Res = await client.query(`
    INSERT INTO public.operacoes_producao (
      tenant_id, empresa_id, unidade_id, data_operacao, data_vencimento,
      tipo_servico_id, transportadora_id, fornecedor_id, produto_carga_id,
      forma_pagamento_id, quantidade, quantidade_colaboradores,
      valor_unitario_snapshot, valor_descarga, percentual_iss, custo_com_iss,
      valor_total_materiais, valor_total, placa, ctrc, nf_numero,
      entrada_ponto, saida_ponto, status, status_rh
    ) VALUES (
      $1, $2, $3, '2026-10-15', '2026-10-31',
      $4, $5, $6, $7, $8, $9, 2,
      $10, $11, $12, $13, $14, $15, 'ABC-1234', 'CTRC-99881', 'SIM',
      '08:00', '11:45', 'RECEBIDO', 'PENDENTE_RH'
    ) RETURNING *;
  `, [
    tenantId, empresaId, unidadeId, servicoId, transpId, fornId, produtoId,
    fpMensalId, qtd1, unit1, vDescarga1, issPct1, issValor1, vMateriais1, vTotal1
  ]);

  const op1 = op1Res.rows[0];

  // Inserir equipe e materiais
  await client.query(`
    INSERT INTO public.production_entry_collaborators (production_entry_id, collaborator_id, entrada_ponto, saida_ponto)
    VALUES ($1, $2, '08:00', '11:45'), ($1, $3, '08:00', '11:45');
  `, [op1.id, colab1Id, colab2Id]);

  await client.query(`
    INSERT INTO public.operacao_producao_materiais (operacao_id, nome_snapshot, unidade_snapshot, valor_unitario_snapshot, quantidade, valor_total)
    VALUES ($1, 'Filme Stretch Bobina', 'un', 30.00, 1, 30.00);
  `, [op1.id]);

  const equipe1Count = (await client.query(`SELECT count(*) FROM public.production_entry_collaborators WHERE production_entry_id = $1`, [op1.id])).rows[0].count;
  const mat1Count = (await client.query(`SELECT count(*) FROM public.operacao_producao_materiais WHERE operacao_id = $1`, [op1.id])).rows[0].count;

  if (
    Number(op1.valor_total) === 1101.00 &&
    Number(op1.custo_com_iss) === 51.00 &&
    op1.status === 'RECEBIDO' &&
    op1.status_rh === 'PENDENTE_RH' &&
    Number(equipe1Count) === 2 &&
    Number(mat1Count) === 1
  ) {
    resultados.push({
      cenario: 'CENÁRIO 1 — Operação válida',
      status: 'PASSOU',
      detalhe: `Persistida com sucesso: ID=${op1.id.slice(0,8)}, Total=R$ ${op1.valor_total}, ISS=R$ ${op1.custo_com_iss}, Equipe=${equipe1Count}, Insumos=${mat1Count}`,
    });
    console.log('✅ CENÁRIO 1 PASSOU:', resultados[0].detalhe);
  } else {
    resultados.push({
      cenario: 'CENÁRIO 1 — Operação válida',
      status: 'FALHOU',
      detalhe: `Divergência nos valores calculados: Total=${op1.valor_total}, esperado=1101.00`,
    });
    console.log('❌ CENÁRIO 1 FALHOU:', resultados[0].detalhe);
  }

  // =========================================================================
  // CENÁRIO 2 — HORÁRIO INCOMPLETO, TENTATIVA DE APROVAÇÃO E REGULARIZAÇÃO
  // =========================================================================
  console.log('\n=============================================================');
  console.log('EXECUTANDO CENÁRIO 2 — Horário incompleto: restrição, teste de aprovação via RPC e regularização');
  console.log('=============================================================');

  // 1. Criar operação sem horário de término -> nasce em EM_RESTRICAO
  const op2Res = await client.query(`
    INSERT INTO public.operacoes_producao (
      tenant_id, empresa_id, unidade_id, data_operacao,
      tipo_servico_id, transportadora_id, fornecedor_id, produto_carga_id,
      forma_pagamento_id, quantidade, valor_unitario_snapshot, valor_descarga,
      valor_total, status, status_rh, entrada_ponto, saida_ponto, avaliacao_json
    ) VALUES (
      $1, $2, $3, '2026-10-15',
      $4, $5, $6, $7, $8, 800, 1.00, 800.00, 800.00,
      'EM_RESTRICAO', 'PENDENTE_RH', '09:00', NULL,
      '{"motivo_restricao": "Horário de início e/ou término não informado"}'::jsonb
    ) RETURNING *;
  `, [tenantId, empresaId, unidadeId, servicoId, transpId, fornId, produtoId, fpMensalId]);
  const op2 = op2Res.rows[0];

  console.log(`Operação 2 criada em restrição: ID=${op2.id.slice(0,8)}, Status=${op2.status}`);

  // 2. Testar aprovação DIRETA pela RPC PostgreSQL (simulando chamada de cliente/backend)
  let rpcAprovouRestricao = false;
  try {
    await client.query(`
      SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em)
      FROM public.operacoes_producao WHERE id = $1;
    `, [op2.id]);
    const checkOp2 = (await client.query(`SELECT status FROM public.operacoes_producao WHERE id = $1`, [op2.id])).rows[0];
    if (checkOp2.status === 'AGUARDANDO_FATURAMENTO') {
      rpcAprovouRestricao = true;
    }
  } catch (err: any) {
    console.log('RPC rejeitou aprovação de EM_RESTRICAO:', err.message);
  }

  // 3. Testar a Regularização Canônica via rpc_operacao_regularizar_horarios
  await client.query(`
    SELECT public.rpc_operacao_regularizar_horarios($1, '09:00', '13:00', 'Horário informado pelo supervisor');
  `, [op2.id]);

  const op2Regularizada = (await client.query(`SELECT status, entrada_ponto, saida_ponto, avaliacao_json, atualizado_em FROM public.operacoes_producao WHERE id = $1`, [op2.id])).rows[0];
  
  // 4. Agora aprovar após regularização
  await client.query(`
    SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em)
    FROM public.operacoes_producao WHERE id = $1;
  `, [op2.id]);
  const op2Aprovada = (await client.query(`SELECT status FROM public.operacoes_producao WHERE id = $1`, [op2.id])).rows[0];

  if (rpcAprovouRestricao && op2Regularizada.status === 'RECEBIDO' && op2Aprovada.status === 'AGUARDANDO_FATURAMENTO') {
    resultados.push({
      cenario: 'CENÁRIO 2 — Horário incompleto e aprovação direta via RPC',
      status: 'FALHOU', // A falha de segurança no backend comprovada
      detalhe: `VULNERABILIDADE COMPROVADA NA RPC: A RPC rpc_operacao_validar_aprovar permitiu mover EM_RESTRICAO para AGUARDANDO_FATURAMENTO no banco (proteção existe apenas no frontend). Regularização subsequente funcionou com sucesso.`,
    });
    console.log('⚠️ CENÁRIO 2:', resultados[1].detalhe);
  } else if (!rpcAprovouRestricao && op2Regularizada.status === 'RECEBIDO' && op2Aprovada.status === 'AGUARDANDO_FATURAMENTO') {
    resultados.push({
      cenario: 'CENÁRIO 2 — Horário incompleto e regularização',
      status: 'PASSOU',
      detalhe: `Backend bloqueou aprovação de operação em restrição; regularização destravou para RECEBIDO e posterior aprovação transicionou para AGUARDANDO_FATURAMENTO.`,
    });
    console.log('✅ CENÁRIO 2 PASSOU:', resultados[1].detalhe);
  }

  // =========================================================================
  // CENÁRIO 3 — RECEITA AUTOMÁTICA E IDEMPOTÊNCIA
  // =========================================================================
  console.log('\n=============================================================');
  console.log('EXECUTANDO CENÁRIO 3 — Receita automática: geração transacional e idempotência');
  console.log('=============================================================');

  // Aprovar op1 válida
  await client.query(`
    SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em)
    FROM public.operacoes_producao WHERE id = $1;
  `, [op1.id]);

  // Verificar se a trigger criou a receita e o item
  const item1Res = await client.query(`
    SELECT i.*, r.modalidade, r.status as status_receita, r.valor_total as receita_total, r.competencia
    FROM public.receitas_operacionais_itens i
    JOIN public.receitas_operacionais r ON r.id = i.receita_id
    WHERE i.operacao_id = $1;
  `, [op1.id]);

  const item1Count = item1Res.rows.length;
  const item1 = item1Res.rows[0];

  // Testar idempotência: disparar update repetido na operação para simular re-execuções / retries
  await client.query(`
    UPDATE public.operacoes_producao
    SET status = 'FATURADO', atualizado_em = now()
    WHERE id = $1;
  `, [op1.id]);

  const item1CountAposRetry = (await client.query(`
    SELECT count(*) FROM public.receitas_operacionais_itens WHERE operacao_id = $1;
  `, [op1.id])).rows[0].count;

  if (item1Count === 1 && Number(item1CountAposRetry) === 1 && Number(item1.valor_item) === 1101.00) {
    resultados.push({
      cenario: 'CENÁRIO 3 — Receita automática e idempotência',
      status: 'PASSOU',
      detalhe: `Receita gerada automaticamente (ID=${item1.receita_id.slice(0,8)}), Item=R$ ${item1.valor_item}. Re-execução da trigger manteve exatamente 1 item único (Idempotência forte).`,
    });
    console.log('✅ CENÁRIO 3 PASSOU:', resultados[2].detalhe);
  } else {
    resultados.push({
      cenario: 'CENÁRIO 3 — Receita automática e idempotência',
      status: 'FALHOU',
      detalhe: `Itens encontrados: inicial=${item1Count}, após retry=${item1CountAposRetry} (esperado: 1)`,
    });
    console.log('❌ CENÁRIO 3 FALHOU:', resultados[2].detalhe);
  }

  // =========================================================================
  // CENÁRIO 4 — TRÊS MODALIDADES: FATURAMENTO MENSAL, DUPLICATA E CAIXA IMEDIATO
  // =========================================================================
  console.log('\n=============================================================');
  console.log('EXECUTANDO CENÁRIO 4 — Três modalidades de cobrança (Mensal, Duplicata, Caixa Imediato)');
  console.log('=============================================================');

  // 1. Segunda operação MENSAL para testar agregação N:1 na mesma fatura mensal
  const op3Res = await client.query(`
    INSERT INTO public.operacoes_producao (
      tenant_id, empresa_id, unidade_id, data_operacao,
      tipo_servico_id, transportadora_id, fornecedor_id, produto_carga_id,
      forma_pagamento_id, quantidade, valor_unitario_snapshot, valor_descarga,
      valor_total, status, status_rh, entrada_ponto, saida_ponto
    ) VALUES (
      $1, $2, $3, '2026-10-20',
      $4, $5, $6, $7, $8, 500, 1.00, 500.00, 500.00,
      'RECEBIDO', 'PENDENTE_RH', '08:00', '12:00'
    ) RETURNING *;
  `, [tenantId, empresaId, unidadeId, servicoId, transpId, fornId, produtoId, fpMensalId]);
  const op3 = op3Res.rows[0];
  await client.query(`
    SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em)
    FROM public.operacoes_producao WHERE id = $1;
  `, [op3.id]);

  // Verificar se op1, op2 e op3 foram agregadas na MESMA receita mensal
  const receitasMensais = (await client.query(`
    SELECT r.id, r.modalidade, r.status, r.competencia, r.valor_total, count(i.id) as total_itens
    FROM public.receitas_operacionais r
    JOIN public.receitas_operacionais_itens i ON i.receita_id = r.id
    WHERE r.modalidade = 'FATURAMENTO_MENSAL' AND r.competencia = '2026-10'
    GROUP BY r.id, r.modalidade, r.status, r.competencia, r.valor_total;
  `)).rows;

  // No Cenário 2, op2 (800) também foi aprovada com fpMensal. Total: op1(1101) + op2(800) + op3(500) = 2401
  const mensalAgrupou = receitasMensais.length === 1 && Number(receitasMensais[0].total_itens) === 3;
  const totalMensalAcumulado = Number(receitasMensais[0]?.valor_total || 0); // 2401.00

  // 2. Operação DUPLICATA
  const opDupRes = await client.query(`
    INSERT INTO public.operacoes_producao (
      tenant_id, empresa_id, unidade_id, data_operacao, data_vencimento,
      tipo_servico_id, transportadora_id, fornecedor_id, produto_carga_id,
      forma_pagamento_id, quantidade, valor_unitario_snapshot, valor_descarga,
      valor_total, status, status_rh, entrada_ponto, saida_ponto
    ) VALUES (
      $1, $2, $3, '2026-10-18', '2026-11-02',
      $4, $5, $6, $7, $8, 600, 1.00, 600.00, 600.00,
      'RECEBIDO', 'PENDENTE_RH', '08:00', '12:00'
    ) RETURNING *;
  `, [tenantId, empresaId, unidadeId, servicoId, transpId, fornId, produtoId, fpDupId]);
  const opDup = opDupRes.rows[0];
  await client.query(`
    SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em)
    FROM public.operacoes_producao WHERE id = $1;
  `, [opDup.id]);

  const recDup = (await client.query(`
    SELECT r.*, i.operacao_id FROM public.receitas_operacionais r
    JOIN public.receitas_operacionais_itens i ON i.receita_id = r.id
    WHERE i.operacao_id = $1;
  `, [opDup.id])).rows[0];

  // 3. Operação CAIXA_IMEDIATO
  const opCaixaRes = await client.query(`
    INSERT INTO public.operacoes_producao (
      tenant_id, empresa_id, unidade_id, data_operacao, data_vencimento,
      tipo_servico_id, transportadora_id, fornecedor_id, produto_carga_id,
      forma_pagamento_id, quantidade, valor_unitario_snapshot, valor_descarga,
      valor_total, status, status_rh, entrada_ponto, saida_ponto
    ) VALUES (
      $1, $2, $3, '2026-10-19', '2026-10-19',
      $4, $5, $6, $7, $8, 400, 1.00, 400.00, 400.00,
      'RECEBIDO', 'PENDENTE_RH', '08:00', '12:00'
    ) RETURNING *;
  `, [tenantId, empresaId, unidadeId, servicoId, transpId, fornId, produtoId, fpCaixaId]);
  const opCaixa = opCaixaRes.rows[0];
  await client.query(`
    SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em)
    FROM public.operacoes_producao WHERE id = $1;
  `, [opCaixa.id]);

  const recCaixa = (await client.query(`
    SELECT r.*, i.operacao_id FROM public.receitas_operacionais r
    JOIN public.receitas_operacionais_itens i ON i.receita_id = r.id
    WHERE i.operacao_id = $1;
  `, [opCaixa.id])).rows[0];

  const passouCenario4 =
    mensalAgrupou &&
    totalMensalAcumulado === 2401.00 &&
    recDup.modalidade === 'DUPLICATA' &&
    recDup.status === 'pendente_cobranca' &&
    Number(recDup.valor_total) === 600.00 &&
    recCaixa.modalidade === 'CAIXA_IMEDIATO' &&
    recCaixa.status === 'pendente_recebimento' &&
    Number(recCaixa.valor_total) === 400.00;

  if (passouCenario4) {
    resultados.push({
      cenario: 'CENÁRIO 4 — Três modalidades de cobrança',
      status: 'PASSOU',
      detalhe: `FATURAMENTO_MENSAL agregou 3 ops na mesma fatura (Total=R$ ${totalMensalAcumulado}, status=aguardando_fechamento); DUPLICATA gerou 1:1 (R$ 600, status=pendente_cobranca); CAIXA_IMEDIATO gerou 1:1 (R$ 400, status=pendente_recebimento).`,
    });
    console.log('✅ CENÁRIO 4 PASSOU:', resultados[3].detalhe);
  } else {
    resultados.push({
      cenario: 'CENÁRIO 4 — Três modalidades de cobrança',
      status: 'FALHOU',
      detalhe: `Inconsistência nas modalidades: MensalAgrupou=${mensalAgrupou}, TotalMensal=${totalMensalAcumulado}, Dup=${recDup?.status}, Caixa=${recCaixa?.status}`,
    });
    console.log('❌ CENÁRIO 4 FALHOU:', resultados[3].detalhe);
  }

  // =========================================================================
  // CENÁRIO 5 — RH E FINANCEIRO: AS DUAS ORDENS DE CONCLUSÃO
  // =========================================================================
  console.log('\n=============================================================');
  console.log('EXECUTANDO CENÁRIO 5 — RH e Financeiro: testar ordem A e ordem B de conclusão');
  console.log('=============================================================');

  // ORDEM A: RH valida PRIMEIRO (rpc_rh_aprovar_operacao), depois Financeiro confirma recebimento
  console.log('--- Testando Ordem A: RH valida antes do Financeiro ---');
  await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opDup.id]);
  const opDupAposRh = (await client.query(`SELECT status, status_rh FROM public.operacoes_producao WHERE id = $1`, [opDup.id])).rows[0];

  // Agora financeiro confirma recebimento
  await client.query(`SELECT public.rpc_receita_confirmar_recebimento($1, '2026-10-25');`, [recDup.id]);
  const opDupAposFin = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1`, [opDup.id])).rows[0];
  const ordemAPassou = opDupAposFin.status === 'CONCLUIDO' && opDupAposFin.status_pagamento === 'RECEBIDO';
  console.log(`Resultado Ordem A: status=${opDupAposFin.status}, status_rh=${opDupAposFin.status_rh}, status_pagamento=${opDupAposFin.status_pagamento} (Concluiu: ${ordemAPassou})`);

  // ORDEM B: Financeiro confirma recebimento PRIMEIRO, depois RH valida
  console.log('--- Testando Ordem B: Financeiro confirma recebimento antes do RH ---');
  await client.query(`SELECT public.rpc_receita_confirmar_recebimento($1, '2026-10-22');`, [recCaixa.id]);
  const opCaixaAposFin = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1`, [opCaixa.id])).rows[0];

  // Agora RH aprova por último
  await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opCaixa.id]);
  const opCaixaAposRh = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1`, [opCaixa.id])).rows[0];
  const ordemBPassou = opCaixaAposRh.status === 'CONCLUIDO';
  console.log(`Resultado Ordem B: status=${opCaixaAposRh.status}, status_rh=${opCaixaAposRh.status_rh}, status_pagamento=${opCaixaAposRh.status_pagamento} (Concluiu: ${ordemBPassou})`);

  if (ordemAPassou && !ordemBPassou) {
    resultados.push({
      cenario: 'CENÁRIO 5 — RH e Financeiro (Assimetria das Ordens de Conclusão)',
      status: 'FALHOU', // Comprovada a falha da Ordem B
      detalhe: `ASSIMETRIA COMPROVADA: Ordem A (RH primeiro, Fin depois) conclui com sucesso (status=CONCLUIDO). Ordem B (Fin primeiro, RH depois) falha em concluir: o status permanece em '${opCaixaAposRh.status}' porque rpc_rh_aprovar_operacao não checa se o pagamento já estava liquidado para promover a CONCLUIDO.`,
    });
    console.log('⚠️ CENÁRIO 5:', resultados[4].detalhe);
  } else if (ordemAPassou && ordemBPassou) {
    resultados.push({
      cenario: 'CENÁRIO 5 — RH e Financeiro (Ordens de Conclusão)',
      status: 'PASSOU',
      detalhe: `Ambas as ordens A e B resultaram no estado final CONCLUIDO com sucesso.`,
    });
    console.log('✅ CENÁRIO 5 PASSOU:', resultados[4].detalhe);
  }

  // =========================================================================
  // CENÁRIO 6 — DRE: COMPETÊNCIA E CONSISTÊNCIA DE VALORES
  // =========================================================================
  console.log('\n=============================================================');
  console.log('EXECUTANDO CENÁRIO 6 — DRE: Reconhecimento por competência da data_operacao');
  console.log('=============================================================');

  // Consulta DRE oficial: soma receitas_operacionais da competência 2026-10
  const dreRes = await client.query(`
    SELECT 
      competencia,
      COUNT(id) as total_receitas,
      SUM(valor_total) as receita_bruta_dre
    FROM public.receitas_operacionais
    WHERE competencia = '2026-10'
    GROUP BY competencia;
  `);

  const dre = dreRes.rows[0];
  // Receitas esperadas na competência 2026-10:
  // Mensal (op1 1101 + op2 800 + op3 500 = 2401)
  // Duplicata (opDup = 600)
  // Caixa Imediato (opCaixa = 400)
  // Total = 2401 + 600 + 400 = 3401.00
  const somaOpsFaturadas = (await client.query(`
    SELECT SUM(valor_total) as total FROM public.operacoes_producao
    WHERE id IN ($1, $2, $3, $4, $5);
  `, [op1.id, op2.id, op3.id, opDup.id, opCaixa.id])).rows[0].total;

  const somaItens = (await client.query(`
    SELECT SUM(valor_item) as total FROM public.receitas_operacionais_itens;
  `)).rows[0].total;

  const totalItensCount = (await client.query(`
    SELECT count(*) as count FROM public.receitas_operacionais_itens;
  `)).rows[0].count;

  const cenario6Passou =
    dre.competencia === '2026-10' &&
    Number(somaOpsFaturadas) === 3401.00 &&
    Number(somaItens) === 3401.00 &&
    Number(dre.receita_bruta_dre) === 3401.00 &&
    Number(dre.total_receitas) === 3 &&
    Number(totalItensCount) === 5;

  if (cenario6Passou) {
    resultados.push({
      cenario: 'CENÁRIO 6 — DRE e Competência Contábil',
      status: 'PASSOU',
      detalhe: `Competência 2026-10 reconheceu R$ 3.401,00 exatos em 3 faturas agregando 5 operações. Ausência total de duplicação: soma_itens (${somaItens}) == soma_operacoes (${somaOpsFaturadas}) == DRE (${dre.receita_bruta_dre}).`,
    });
    console.log('✅ CENÁRIO 6 PASSOU:', resultados[5].detalhe);
  } else {
    resultados.push({
      cenario: 'CENÁRIO 6 — DRE e Competência Contábil',
      status: 'FALHOU',
      detalhe: `Divergência na DRE: Ops=${somaOpsFaturadas}, Itens=${somaItens}, DRE=${dre?.receita_bruta_dre}`,
    });
    console.log('❌ CENÁRIO 6 FALHOU:', resultados[5].detalhe);
  }

  // =========================================================================
  // CENÁRIO 7 — SEGURANÇA E IMUTABILIDADE (ESTADO_FECHADO E OCC)
  // =========================================================================
  console.log('\n=============================================================');
  console.log('EXECUTANDO CENÁRIO 7 — Segurança e Imutabilidade (ESTADO_FECHADO e OCC)');
  console.log('=============================================================');

  // 1. Tentar re-aprovar operação já faturada (opDup está em CONCLUIDO)
  // Passando o atualizado_em exato para testar especificamente a trava de ESTADO_FECHADO
  let travouReaprovacao = false;
  try {
    await client.query(`
      SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em)
      FROM public.operacoes_producao WHERE id = $1;
    `, [opDup.id]);
  } catch (err: any) {
    if (err.message.includes('ESTADO_FECHADO')) {
      travouReaprovacao = true;
    }
  }

  // 2. Tentar aprovar com updated_at desatualizado (conflito OCC)
  let travouOcc = false;
  const staleTimestamp = new Date(Date.now() - 3600000).toISOString();
  try {
    const opOccRes = await client.query(`
      INSERT INTO public.operacoes_producao (
        tenant_id, empresa_id, unidade_id, data_operacao,
        tipo_servico_id, transportadora_id, fornecedor_id, produto_carga_id,
        forma_pagamento_id, quantidade, valor_unitario_snapshot, valor_descarga,
        valor_total, status, status_rh, entrada_ponto, saida_ponto
      ) VALUES (
        $1, $2, $3, '2026-10-21',
        $4, $5, $6, $7, $8, 100, 1.00, 100.00, 100.00,
        'RECEBIDO', 'PENDENTE_RH', '08:00', '12:00'
      ) RETURNING *;
    `, [tenantId, empresaId, unidadeId, servicoId, transpId, fornId, produtoId, fpMensalId]);
    const opOcc = opOccRes.rows[0];

    await client.query(`SELECT public.rpc_operacao_validar_aprovar($1, $2);`, [opOcc.id, staleTimestamp]);
  } catch (err: any) {
    if (err.message.includes('CONCURRENCY_CONFLICT')) {
      travouOcc = true;
    }
  }

  if (travouReaprovacao && travouOcc) {
    resultados.push({
      cenario: 'CENÁRIO 7 — Segurança e Imutabilidade (ESTADO_FECHADO e OCC)',
      status: 'PASSOU',
      detalhe: `Trava ESTADO_FECHADO impediu re-aprovação de operação faturada. Trava CONCURRENCY_CONFLICT impediu aprovação com timestamp desatualizado.`,
    });
    console.log('✅ CENÁRIO 7 PASSOU:', resultados[6].detalhe);
  } else {
    resultados.push({
      cenario: 'CENÁRIO 7 — Segurança e Imutabilidade',
      status: 'FALHOU',
      detalhe: `Falha nas travas: ESTADO_FECHADO=${travouReaprovacao}, OCC=${travouOcc}`,
    });
    console.log('❌ CENÁRIO 7 FALHOU:', resultados[6].detalhe);
  }

  // =========================================================================
  // RELATÓRIO CONSOLIDADO
  // =========================================================================
  console.log('\n=============================================================');
  console.log('RESUMO FINAL DOS 7 CENÁRIOS TRANSACIONAIS POSTGRESQL');
  console.log('=============================================================');
  console.table(resultados);

  await client.end();
  console.log('\nConexão com PostgreSQL isolado encerrada.');
}

runLote2Tests().catch((err) => {
  console.error('Erro fatal no teste transacional:', err);
  process.exit(1);
});
