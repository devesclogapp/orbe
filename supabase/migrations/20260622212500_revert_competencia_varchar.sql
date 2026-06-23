-- Corrige a divergencia arquitetural da coluna competencia no banco resolvendo o bloqueio gerado pela FK mestre

DO $$ 
BEGIN
  -- 1. Removemos a trava que está bloqueando a alteração da tabela filial
  ALTER TABLE public.financeiro_consolidados_cliente 
    DROP CONSTRAINT IF EXISTS financeiro_consolidados_cliente_comp_fk;

  -- 2. Alteramos a tabela CENTRALIZADORA de competências para suportar a STRING de volta
  ALTER TABLE public.financeiro_competencias 
    ALTER COLUMN competencia TYPE character varying(7) 
    USING to_char(competencia::timestamp, 'YYYY-MM');

  -- 3. Alteramos a tabela consolidados obedecendo 
  ALTER TABLE public.financeiro_consolidados_cliente 
    ALTER COLUMN competencia TYPE character varying(7) 
    USING to_char(competencia::timestamp, 'YYYY-MM');
    
  -- 4. Garantimos a tabela de faturas livre de type casting errors
  ALTER TABLE public.faturas 
    ALTER COLUMN competencia TYPE character varying(7) 
    USING to_char(competencia::timestamp, 'YYYY-MM');

  -- 5. Restauramos a RIGOROSA segurança garantindo a amarra que você exigiu não perder
  ALTER TABLE public.financeiro_consolidados_cliente 
    ADD CONSTRAINT financeiro_consolidados_cliente_comp_fk 
    FOREIGN KEY (empresa_id, competencia) REFERENCES public.financeiro_competencias(empresa_id, competencia);
END $$;
