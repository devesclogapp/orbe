-- 1. Deduplicação: Consolidar "Empresas" duplicadas mantendo sempre a mais antiga
DO $$
DECLARE
    rec RECORD;
    v_master_id uuid;
    v_dupe_id uuid;
BEGIN
    FOR rec IN 
        SELECT tenant_id, upper(trim(nome)) as nome_clean, COUNT(*) 
        FROM empresas 
        GROUP BY tenant_id, upper(trim(nome)) 
        HAVING COUNT(*) > 1
    LOOP
        -- Pega a ID da mais antiga (master)
        SELECT id INTO v_master_id 
        FROM empresas 
        WHERE tenant_id = rec.tenant_id AND upper(trim(nome)) = rec.nome_clean
        ORDER BY created_at ASC 
        LIMIT 1;

        -- Migra as relações das duplicadas para a master
        FOR v_dupe_id IN 
            SELECT id FROM empresas 
            WHERE tenant_id = rec.tenant_id 
              AND upper(trim(nome)) = rec.nome_clean
              AND id != v_master_id
        LOOP
            -- Redirecionar registros vinculados principais
            UPDATE colaboradores SET empresa_id = v_master_id WHERE empresa_id = v_dupe_id;
            UPDATE lancamentos_intermitentes SET empresa_id = v_master_id WHERE empresa_id = v_dupe_id;
            
            -- Deleta a duplicada
            DELETE FROM empresas WHERE id = v_dupe_id;
        END LOOP;
        
        RAISE NOTICE 'Empresa "%" consolidada.', rec.nome_clean;
    END LOOP;
END;
$$;


-- 2. Criar Função para criação de empresas garantida (Anti Race-Condition)
CREATE OR REPLACE FUNCTION ensure_empresa_provisoria(
    p_tenant_id uuid,
    p_nome text,
    p_cnpj text,
    p_origem_detalhe text,
    p_origem text,
    p_origem_cadastro text
) RETURNS uuid AS $$
DECLARE
    v_empresa_id uuid;
BEGIN
    -- 1. Try to find by nome
    SELECT id INTO v_empresa_id 
    FROM empresas 
    WHERE tenant_id = p_tenant_id 
      AND upper(trim(nome)) = upper(trim(p_nome))
    LIMIT 1;

    IF v_empresa_id IS NOT NULL THEN
        RETURN v_empresa_id;
    END IF;

    -- 2. Transaction Lock (Race condition prevetion)
    PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || p_nome));

    -- Double check inside lock
    SELECT id INTO v_empresa_id 
    FROM empresas 
    WHERE tenant_id = p_tenant_id 
      AND upper(trim(nome)) = upper(trim(p_nome))
    LIMIT 1;

    IF v_empresa_id IS NOT NULL THEN
        RETURN v_empresa_id;
    END IF;

    -- 3. Inserção Segura
    INSERT INTO empresas (
        tenant_id, nome, cnpj, status, origem, origem_cadastro, origem_detalhe, cadastro_provisorio
    ) VALUES (
        p_tenant_id, p_nome, p_cnpj, 'ATIVA', p_origem, p_origem_cadastro, p_origem_detalhe, true
    ) RETURNING id INTO v_empresa_id;

    RETURN v_empresa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
