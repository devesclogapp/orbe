-- Migration to populate missing diaristas referenced by lancamentos_diaristas

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT diarista_id
    FROM public.lancamentos_diaristas
    WHERE diarista_id IS NOT NULL
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.diaristas WHERE id = rec.diarista_id) THEN
      INSERT INTO public.diaristas (id, nome)
      VALUES (rec.diarista_id, 'Diarista ' || left(rec.diarista_id::text, 8));
    END IF;
  END LOOP;
END$$;
