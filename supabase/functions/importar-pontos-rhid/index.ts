import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { EmpresaResolver } from "../_shared/EmpresaResolver.ts"
import {
  buildCanonicalPontoKey,
  ingestPontosBatch,
  validatePontoIngestAuth,
} from "../_shared/pontoIntegrity.ts"
import {
  aplicarEmpresasCriadas,
  buildRhidIdentityMaps,
  cleanMatricula,
  parseCpfInput,
  processRhidItems,
  reconciliarContagensAposIngestao,
  sanitizeDbColaboradorPayload,
  tratarFalhaCriacaoColaborador,
  normalizeText,
  type RhidColaboradorLookup,
} from "../_shared/rhidIdentity.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // FIX 01 — Autenticação de Entrada Obrigatória (Fail-Closed antes de qualquer leitura ou escrita)
    const authCheck = await validatePontoIngestAuth({
      req,
      supabase,
      serviceRoleKey: supabaseKey,
      webhookSecretEnv: Deno.env.get('PONTO_IMPORT_SECRET'),
    });

    if (!authCheck.authorized && authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const bodyStr = await req.text();
    if (!bodyStr) {
      return new Response(JSON.stringify({ error: "Empty body" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const payload = JSON.parse(bodyStr);
    const schemaVersion = payload.schema_version ?? 1; 
    const dryRun = Boolean(payload.dry_run);

    let explicitTenantId = req.headers.get('x-tenant-id') || payload.tenant_id || null;

    // Se o chamador forneceu JWT de operador, amarrar estritamente ao tenant do operador
    if (authCheck.authType === 'jwt' && authCheck.tenantId) {
      if (explicitTenantId && explicitTenantId !== authCheck.tenantId) {
        return new Response(JSON.stringify({
          error: "TenantMismatch",
          message: "Acesso negado: operador não possui autorização para importar dados em outro tenant."
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      explicitTenantId = authCheck.tenantId;
    }
    const items = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);
    
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "Payload vazio ou sem items." }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // --- Resolver Tenant (Requisito 1: Estrito por Header ou Payload, sem inferência por matrícula/CNPJ) ---
    if (!explicitTenantId) {
      return new Response(JSON.stringify({
        error: "MissingTenantId",
        message: "Identificador do tenant obrigatório (forneça o header x-tenant-id ou o campo tenant_id no payload)."
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const finalTenantId = explicitTenantId;

    // 1. Criar registro do Workflow na historico_importacoes (Apenas se NÃO for dry_run)
    let importacaoId: string | null = null;
    if (!dryRun) {
      const { data: historico, error: histError } = await supabase
        .from('historico_importacoes')
        .insert({
          tenant_id: finalTenantId,
          origem: 'api',
          workflow: 'importar-pontos-rhid',
          nome_arquivo: `payload_api_${Date.now()}.json`,
          quantidade_recebida: items.length,
          status: 'VALIDANDO'
        })
        .select('id')
        .single();
      if (histError) console.error("[ERROR] ao criar histórico:", histError);
      importacaoId = historico?.id ?? null;
    }

    // 2. Extrair conjuntos chaves para busca otimizada de Colaboradores
    const cpfs = new Set<string>();
    const matriculas = new Set<string>();
    const nomes = new Set<string>();

    for (const item of items) {
      const c = parseCpfInput(item.cpf ?? item.pessoa_cpf);
      if (c.isValid && c.cleaned) cpfs.add(c.cleaned);
      const m = cleanMatricula(item.pessoa_matricula);
      if (m) matriculas.add(m);
      if (item.pessoa_nome) nomes.add(normalizeText(item.pessoa_nome));
    }

    // Otimização: buscar colaboradores do tenant com filtros relevantes
    let colabQuery = supabase.from('colaboradores').select('id, nome, matricula, cpf, empresa_id, tenant_id').eq('tenant_id', finalTenantId);
    let colabFilter: string[] = [];
    if (cpfs.size > 0) colabFilter.push(`cpf.in.(${Array.from(cpfs).join(',')})`);
    if (matriculas.size > 0) colabFilter.push(`matricula.in.(${Array.from(matriculas).join(',')})`);
    if (nomes.size > 0) colabFilter.push(`nome.in.(${Array.from(nomes).map(n => '"' + n + '"').join(',')})`);
    if (colabFilter.length > 0) {
      colabQuery = colabQuery.or(colabFilter.join(','));
    }

    const { data: dbColabs, error: dbColabsErr } = await colabQuery;
    if (dbColabsErr) {
      console.error("[ERROR] Falha ao consultar colaboradores:", dbColabsErr.message);
      throw new Error(`Falha ao consultar colaboradores: ${dbColabsErr.message}`);
    }

    const identityMaps = buildRhidIdentityMaps((dbColabs || []) as RhidColaboradorLookup[]);

    // 3. Resolver de Empresas (estritamente cache em memória durante o processamento pré-escrita)
    const resolver = new EmpresaResolver(supabase, finalTenantId, 'api');
    await resolver.loadCache();

    // Na fase de reconciliação pré-escrita, NENHUMA empresa é criada no banco (consulta estritamente via cache)
    const resolveEmpresaFn = async (rawName: string): Promise<string | null> => {
      return resolver.findCached(rawName);
    };

    // 4. Executar Identificação Pura e Reconciliação Determinística via rhidIdentity
    const batchResult = await processRhidItems({
      tenantId: finalTenantId,
      items,
      identityMaps,
      resolveEmpresaId: resolveEmpresaFn,
      sha256Hex,
      schemaVersion,
      importacaoId,
      dryRun,
    });

    // REQUISITO 2: ABORTO PRÉ-ESCRITA (Fail-Fast)
    // Se a reconciliação pré-escrita detectar divergência matemática entre a soma dos estados
    // e o total recebido, abortar IMEDIATAMENTE antes de qualquer insert de colaboradores,
    // empresas ou registros_ponto no banco.
    // (Apenas o registro inicial em historico_importacoes com status 'ERRO' persiste para fins de auditoria)
    if (batchResult.divergenciaDetectada) {
      const errMsg = `DIVERGENCIA_PRE_ESCRITA: soma dos estados (${batchResult.somaEstados}) != recebidos (${items.length}). Ingestão abortada sem qualquer criação de empresas, colaboradores ou pontos no banco.`;
      console.error(`[CRITICAL] ${errMsg}`);

      if (importacaoId && !dryRun) {
        await supabase.from('historico_importacoes')
          .update({
            status: 'ERRO',
            erro_processamento: errMsg,
            finalizado_em: new Date().toISOString(),
          })
          .eq('id', importacaoId);
      }

      return new Response(JSON.stringify({
        error: "DivergenciaReconciliacao",
        message: errMsg,
        recebidos: items.length,
        soma_reconciliada: batchResult.somaEstados,
        resumo: batchResult.contagemPorEstado,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let cltsCriadosCount = 0;
    let registrosParaSalvarEfetivos = [...batchResult.registrosParaSalvar];
    let contagemAposCriacao = { ...batchResult.contagemPorEstado };

    // ETAPA PÓS-VERIFICAÇÃO DE DIVERGÊNCIA:
    // Criação controlada de empresas faltantes (apenas se passou no teste de divergência e não for dry_run)
    if (!dryRun && batchResult.empresasQueSeriamCriadas.length > 0) {
      const empresasCriadasMap = new Map<string, string>();
      for (const empresaNome of batchResult.empresasQueSeriamCriadas) {
        const createdEmpresaId = await resolver.resolveOrCreate(empresaNome);
        if (createdEmpresaId) {
          empresasCriadasMap.set(empresaNome, createdEmpresaId);
        }
      }

      // Aplicação modular via rhidIdentity.ts: vincula empresa_id aos pontos e colaboradores
      // e recalcula a chave_importacao e merged_into_key nos registros e itemOutcomes
      await aplicarEmpresasCriadas({
        tenantId: finalTenantId,
        empresasCriadasMap,
        registrosParaSalvar: registrosParaSalvarEfetivos,
        novosColaboradoresParaCriar: batchResult.novosColaboradoresParaCriar,
        itemOutcomes: batchResult.itemOutcomes,
        sha256Hex,
      });
    }

    // REQUISITO 1: SELF-HEALING COM VÍNCULO DETERMINÍSTICO & FAIL-SAFE EM FALHA DE INSERT
    // O id de cada colaborador provisório já foi pré-gerado em batchResult.novosColaboradoresParaCriar
    // e associado deterministicamente aos registros_ponto e itemOutcomes.
    // Se a inserção de um colaborador falhar, os pontos dele NÃO podem ser gravados: vão para inconsistente!
    if (!dryRun && batchResult.novosColaboradoresParaCriar.length > 0) {
      for (const colPayload of batchResult.novosColaboradoresParaCriar) {
        // Sanitizar payload para tabela colaboradores (remove temp_key e garante whitelist estrita)
        const dbColPayload = sanitizeDbColaboradorPayload(colPayload);

        const { error: createColErr } = await supabase
          .from('colaboradores')
          .insert(dbColPayload);

        if (createColErr) {
          console.error(`[ERROR] Falha ao persistir self-healing para colaborador ${colPayload.nome} (id: ${colPayload.id}):`, createColErr.message);
          
          // Descartar pontos deste colaborador da gravação e classificar itens como inconsistente
          const failResult = tratarFalhaCriacaoColaborador({
            failedColabId: colPayload.id,
            motivoErro: createColErr.message,
            registrosParaSalvar: registrosParaSalvarEfetivos,
            itemOutcomes: batchResult.itemOutcomes,
          });

          registrosParaSalvarEfetivos = failResult.registrosRestantes;
          contagemAposCriacao = failResult.contagemAtualizada;
        } else {
          cltsCriadosCount++;
        }
      }
    } else if (dryRun) {
      cltsCriadosCount = batchResult.novosColaboradoresParaCriar.length;
    }

    // 5. Ingestão no Banco de registros_ponto (Apenas se NÃO for dry_run e houver registros elegíveis)
    let ingestionResult = {
      inseridos: 0,
      atualizados: 0,
      ignorados_duplicados: 0,
      correcoes_pendentes: [] as any[],
      bloqueados_fechamento: 0,
    };

    if (!dryRun && registrosParaSalvarEfetivos.length > 0) {
      try {
        ingestionResult = await ingestPontosBatch({
          supabase,
          tenantId: finalTenantId,
          importacaoId: importacaoId ?? null,
          records: registrosParaSalvarEfetivos,
        });
      } catch (ingestErr: any) {
        console.error("[ERROR] Erro na ingestão controlada de registros_ponto: ", ingestErr.message);
        if (importacaoId) {
          await supabase.from('historico_importacoes')
            .update({
              status: 'ERRO',
              erro_processamento: ingestErr.message,
              finalizado_em: new Date().toISOString(),
            })
            .eq('id', importacaoId);
        }
        throw ingestErr;
      }
    }

    // 6. Reconciliação Final de Contagens
    let contagemFinal = contagemAposCriacao;
    let somaFinal = Object.values(contagemFinal).reduce((a, b) => a + b, 0);
    let divergenciaDetectada = somaFinal !== items.length;

    if (!dryRun) {
      const reconciliacaoPos = reconciliarContagensAposIngestao({
        itemOutcomes: batchResult.itemOutcomes,
        registrosParaSalvar: registrosParaSalvarEfetivos,
        ingestionResult,
      });
      contagemFinal = reconciliacaoPos.contagemFinal;
      somaFinal = reconciliacaoPos.somaFinal;
      divergenciaDetectada = reconciliacaoPos.divergenciaDetectada;
    }

    if (divergenciaDetectada) {
      console.error(`[CRITICAL] Divergência na reconciliação final: soma dos estados (${somaFinal}) != recebidos (${items.length})`);
    }

    // 7. Finalizar Lote (historico_importacoes) — Apenas se NÃO for dry_run
    if (importacaoId && !dryRun) {
      const totalInconsistentesFinal = contagemFinal.inconsistente + contagemFinal.conflito + ingestionResult.correcoes_pendentes.length;
      
      let finalStatus: 'PROCESSADO' | 'INCONSISTENTE' | 'ERRO' = totalInconsistentesFinal > 0 ? 'INCONSISTENTE' : 'PROCESSADO';
      if (divergenciaDetectada) {
        finalStatus = 'ERRO';
      }

      await supabase.from('historico_importacoes')
        .update({
          status: finalStatus,
          quantidade_registros: items.length,
          quantidade_importada: contagemFinal.inserido + contagemFinal.atualizado,
          quantidade_inconsistencias: totalInconsistentesFinal,
          quantidade_ignorada: contagemFinal.ignorado + contagemFinal.duplicado,
          erro_processamento: divergenciaDetectada ? `DIVERGENCIA_RECONCILIACAO: soma dos estados (${somaFinal}) difere dos recebidos (${items.length}).` : null,
          processado_em: new Date().toISOString(),
          finalizado_em: new Date().toISOString(),
          logs: { 
            mensagem: dryRun ? "Execução simulada (dry-run)." : "Requisição finalizada.", 
            dry_run: dryRun,
            clts_autocriados: cltsCriadosCount, 
            empresas_criadas: resolver.empresasCriadas,
            esquema_utilizado: schemaVersion,
            reconciliacao: contagemFinal,
            conflitos_detalhados: batchResult.conflitosDetalhados,
            mesclados_detalhados: batchResult.mescladosDetalhados,
            correcoes_pendentes: ingestionResult.correcoes_pendentes,
          }
        })
        .eq('id', importacaoId);
    }

    // REQUISITO 3: COMPATIBILIDADE RETROATIVA TOTAL NO RESUMO
    // Mantém todos os campos antigos esperados pelo ERP e testes legados,
    // integrando os novos campos analíticos sem quebra de contrato.
    const importadosVazados = contagemFinal.inserido + contagemFinal.atualizado;
    const totalIgnorados = contagemFinal.ignorado + contagemFinal.duplicado;
    const totalInconsistentes = contagemFinal.inconsistente + contagemFinal.conflito + ingestionResult.correcoes_pendentes.length;

    const resumoCompativel = {
      // --- Campos Clássicos / Legados (preservados integralmente) ---
      recebidos: items.length,
      importados_vazados: importadosVazados,
      inseridos: contagemFinal.inserido,
      atualizados: contagemFinal.atualizado,
      ignorados: totalIgnorados,
      ignorados_duplicados: contagemFinal.duplicado,
      inconsistentes: totalInconsistentes,
      correcoes_pendentes: ingestionResult.correcoes_pendentes.length,
      bloqueados_fechamento: contagemFinal.bloqueado,
      clts_criados: cltsCriadosCount,
      empresas_criadas: resolver.empresasCriadas,
      schema: schemaVersion,

      // --- Novos Campos Analíticos (FIX-RHID-IDENTIDADE-01) ---
      soma_reconciliada: somaFinal,
      divergencia_detectada: divergenciaDetectada,
      mesclados: contagemFinal.mesclado,
      conflitos: contagemFinal.conflito,
      mesclados_detalhados: batchResult.mescladosDetalhados,
      conflitos_detalhados: batchResult.conflitosDetalhados,

      // REQUISITO 4: DRY RUN — listar empresas que seriam criadas se findCached retornou nulo
      ...(dryRun ? { empresas_que_seriam_criadas: batchResult.empresasQueSeriamCriadas } : {}),
    };

    // 8. Resposta HTTP estruturada (com rastreabilidade por item)
    return new Response(JSON.stringify({
      success: !divergenciaDetectada,
      dry_run: dryRun,
      message: dryRun
        ? "Simulação dry-run concluída sem qualquer escrita no banco de dados."
        : "Importação concluída. Consulte o importacao_id para relatórios logísticos.",
      importacao_id: importacaoId,
      resumo: resumoCompativel,
      item_destinos: batchResult.itemOutcomes.map(o => ({
        index: o.index,
        estado: o.estado,
        matched_colab_id: o.matched_colab_id,
        matched_by: o.matched_by,
        chave_importacao: o.chave_importacao,
        merged_into_key: o.merged_into_key,
        motivo: o.motivo,
      })),
    }), {
      status: divergenciaDetectada ? 500 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("[CRITICAL] Falha geral na Edge Function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
