-- Migration para suportar a rastreabilidade do lote de intermitentes no retorno do banco
ALTER TABLE "public"."cnab_retorno_itens" 
	ADD COLUMN IF NOT EXISTS "intermitentes_lote_id" uuid;
	
ALTER TABLE "public"."cnab_retorno_itens" 
	ADD CONSTRAINT "cnab_retorno_itens_intermitentes_lote_id_fkey" 
	FOREIGN KEY ("intermitentes_lote_id") 
	REFERENCES "public"."intermitentes_lotes_fechamento"("id") ON DELETE SET NULL;
