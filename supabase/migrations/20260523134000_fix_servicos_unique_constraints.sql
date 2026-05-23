-- 20260523134000_fix_servicos_unique_constraints.sql
-- Finalidade: Remover as constraints globais de UNIQUE no "nome" de serviços e formas de pagamento
-- e substituí-las por índices UNIQUE locais com suporte a isolamento por tenant/empresa e case-insensitive.

DO $$
DECLARE
    row record;
BEGIN
    -- Procurar constraint UNIQUE na coluna "nome" da tabela tipos_servico_operacional e dropar
    FOR row IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'tipos_servico_operacional' 
          AND tc.constraint_type = 'UNIQUE' 
          AND ccu.column_name = 'nome'
    LOOP
        EXECUTE 'ALTER TABLE public.tipos_servico_operacional DROP CONSTRAINT IF EXISTS ' || quote_ident(row.constraint_name);
    END LOOP;

    -- Procurar constraint UNIQUE na coluna "nome" da tabela formas_pagamento_operacional e dropar
    FOR row IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'formas_pagamento_operacional' 
          AND tc.constraint_type = 'UNIQUE' 
          AND ccu.column_name = 'nome'
    LOOP
        EXECUTE 'ALTER TABLE public.formas_pagamento_operacional DROP CONSTRAINT IF EXISTS ' || quote_ident(row.constraint_name);
    END LOOP;
END;
$$;

-- Criar índices amigáveis ao multitenant (garantindo unicidade apenas dentro da mesma empresa/tenant)
-- Ignorando case (minúsculo) e prevenindo problemas com nulls agrupados com o COALESCE

DROP INDEX IF EXISTS idx_tipos_servico_tenant_empresa_nome;
CREATE UNIQUE INDEX idx_tipos_servico_tenant_empresa_nome 
  ON public.tipos_servico_operacional (
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    lower(trim(nome))
  );

DROP INDEX IF EXISTS idx_formas_pagamento_tenant_nome;
CREATE UNIQUE INDEX idx_formas_pagamento_tenant_nome 
  ON public.formas_pagamento_operacional (
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    lower(trim(nome))
  );
