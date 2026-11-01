-- ==============================================================================
-- SANEAMENTO CIRÚRGICO — REMESSA CNAB HISTÓRICA (INTERMITENTES HOMOLOGAÇÃO)
-- Arquivo: saneamento_historico_cnab_825bd8da.sql
-- 
-- Evidência Auditada:
--   ID da Remessa: 825bd8da-62e0-4fc3-a0c7-4cbe6cf7f5ff
--   Lote Origem:   930915d6-cb8f-4739-8001-7fa49d3009e4 (Status PAGO)
--   Empresa:       28a560b5-37ef-403d-ae4f-b28a608b6a68 (Empresa Teste - Homologação, is_teste = true)
--   Conta Bancária: faecb252-7b9e-407d-93a5-e10466d35b0e (Itaú 341)
--   Competência:   2026-10 | Valor: R$ 570,00
--   Status atual:  gerado | Modo atual: producao
-- 
-- Diagnóstico:
--   O registro foi gerado durante a homologação do ciclo de Intermitentes sob o
--   ambiente Homologação. Devido a literal estático em intermitentes.service.ts,
--   foi persistido com modo='producao'. Isso provocou a exclusão da remessa na
--   visão de Homologação da DRE/Dashboard e sua indevida inclusão na visão de Produção.
-- 
-- Diretriz de Integridade:
--   A trilha de auditoria (cnab_auditoria_bancaria) é estritamente imutável e preserva
--   o histórico original do evento de geração. O saneamento altera EXCLUSIVAMENTE
--   o estado operacional em cnab_remessas_arquivos.modo.
-- 
-- ATENÇÃO: NÃO EXECUTAR AUTOMATICAMENTE. Execute apenas após autorização expressa.
-- ==============================================================================

BEGIN;

-- 1. Validação de segurança prévia (Fail-Closed)
DO $$
DECLARE
  v_empresa_is_teste boolean;
  v_modo_atual text;
BEGIN
  SELECT is_teste INTO v_empresa_is_teste
  FROM public.empresas
  WHERE id = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

  SELECT modo INTO v_modo_atual
  FROM public.cnab_remessas_arquivos
  WHERE id = '825bd8da-62e0-4fc3-a0c7-4cbe6cf7f5ff';

  IF v_empresa_is_teste IS NOT TRUE THEN
    RAISE EXCEPTION 'Abortado: A empresa associada à remessa não é comprovadamente de homologação/teste.';
  END IF;

  IF v_modo_atual != 'producao' THEN
    RAISE NOTICE 'Aviso: O modo atual da remessa já é %, atualização desnecessária.', v_modo_atual;
  END IF;
END $$;

-- 2. Atualização cirúrgica exclusiva de cnab_remessas_arquivos.modo
UPDATE public.cnab_remessas_arquivos
SET modo = 'homologacao',
    updated_at = timezone('utc', now())
WHERE id = '825bd8da-62e0-4fc3-a0c7-4cbe6cf7f5ff'
  AND empresa_id = '28a560b5-37ef-403d-ae4f-b28a608b6a68'
  AND modo = 'producao';

COMMIT;
