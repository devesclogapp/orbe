-- ============================================================
-- BLOCO 4: ETAPA 7 — MIGRATION F (IMUTABILIDADE)
-- ============================================================

-- Trigger defensiva para impedir alterações cruciais após a Remessa nascer.
-- Apenas status de processamento (ex: 'enviado', 'homologado') podem variar.

CREATE OR REPLACE FUNCTION public.check_cnab_remessa_imutabilidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se o registro já existir (UPDATE)
    IF TG_OP = 'UPDATE' THEN
        -- Proteção dos blocos fundamentais (Não podem mudar estruturalmente após 'gerado')
        IF OLD.status IN ('gerado', 'baixado', 'enviado', 'enviado_manual', 'homologado') THEN
            
            IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
                RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Tenants.';
            END IF;

            IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
                RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Empresas.';
            END IF;

            IF NEW.conta_bancaria_id IS DISTINCT FROM OLD.conta_bancaria_id THEN
                RAISE EXCEPTION 'Imutabilidade violada: Conta Bancária não pode ser alterada em arquivo já gerado.';
            END IF;

            IF NEW.hash_arquivo IS DISTINCT FROM OLD.hash_arquivo THEN
                RAISE EXCEPTION 'Imutabilidade violada: Hash do Arquivo (Checksum) corrompido ou alterado indevidamente.';
            END IF;

            IF NEW.conteudo_arquivo IS DISTINCT FROM OLD.conteudo_arquivo THEN
                RAISE EXCEPTION 'Imutabilidade violada: O conteúdo em texto do CNAB não pode ser alterado após registro.';
            END IF;

            IF NEW.total_valor IS DISTINCT FROM OLD.total_valor THEN
                RAISE EXCEPTION 'Imutabilidade violada: O Valor Total é imutável.';
            END IF;

            IF NEW.total_registros IS DISTINCT FROM OLD.total_registros THEN
                RAISE EXCEPTION 'Imutabilidade violada: O Volume de Registros (Linhas) é imutável.';
            END IF;

            IF NEW.sequencial_arquivo IS DISTINCT FROM OLD.sequencial_arquivo THEN
                RAISE EXCEPTION 'Imutabilidade violada: O Sequencial Bancário é estritamente fixo.';
            END IF;

            -- Bloquear certas mudanças de STATUS
            IF NEW.status = 'cancelado' AND OLD.status IN ('enviado', 'enviado_manual', 'homologado', 'processado') THEN
                 RAISE EXCEPTION 'Workflow violado: Arquivos submetidos / enviados não podem mais ser cancelados (exige tratar estorno/retorno bancário).';
            END IF;
            
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cnab_remessa_imutabilidade ON public.cnab_remessas_arquivos;
CREATE TRIGGER enforce_cnab_remessa_imutabilidade
    BEFORE UPDATE ON public.cnab_remessas_arquivos
    FOR EACH ROW
    EXECUTE FUNCTION public.check_cnab_remessa_imutabilidade();
