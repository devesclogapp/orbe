-- Migration: Adiciona coluna cenario_homologacao e padroniza colaboradores de homologação
-- Data: 2026-07-09

DO $$
BEGIN

  -- 1. Adicionar o novo campo de identificação de cenário
  ALTER TABLE public.colaboradores
    ADD COLUMN IF NOT EXISTS cenario_homologacao TEXT;

  -- 2. Atualizar Nomes, Matrículas e Cenários dos colaboradores de homologação

  -- C1: Jornada Normal
  UPDATE public.colaboradores 
  SET nome = 'CLT-HML-001 — Jornada Normal', 
      matricula = 'HML-001', 
      cenario_homologacao = 'Jornada Normal' 
  WHERE matricula = 'HOM-001' AND is_teste = true;

  -- C2: Hora Extra
  UPDATE public.colaboradores 
  SET nome = 'CLT-HML-002 — Hora Extra', 
      matricula = 'HML-002', 
      cenario_homologacao = 'Hora Extra' 
  WHERE matricula = 'HOM-002' AND is_teste = true;

  -- C3: Atraso
  UPDATE public.colaboradores 
  SET nome = 'CLT-HML-003 — Atraso', 
      matricula = 'HML-003', 
      cenario_homologacao = 'Atraso' 
  WHERE matricula = 'HOM-003' AND is_teste = true;

  -- C4: Incompleto
  UPDATE public.colaboradores 
  SET nome = 'CLT-HML-004 — Batidas Incompletas', 
      matricula = 'HML-004', 
      cenario_homologacao = 'Batidas Incompletas' 
  WHERE matricula = 'HOM-004' AND is_teste = true;

  -- C5: Jornada Especial
  UPDATE public.colaboradores 
  SET nome = 'CLT-HML-005 — Jornada Especial', 
      matricula = 'HML-005', 
      cenario_homologacao = 'Jornada Especial' 
  WHERE matricula = 'HOM-005' AND is_teste = true;

END $$;

NOTIFY pgrst, 'reload schema';
