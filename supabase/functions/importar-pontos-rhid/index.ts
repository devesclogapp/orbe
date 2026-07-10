import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

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

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeCompanyText = (value: string) => {
  const normalized = normalizeText(value);
  return normalized
    .replace(/\b(ltda|me|eireli)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bodyStr = await req.text();
    if (!bodyStr) {
      return new Response(JSON.stringify({ error: "Empty body" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const payload = JSON.parse(bodyStr);
    const schemaVersion = payload.schema_version ?? 1; 

    let explicitTenantId = req.headers.get('x-tenant-id') || payload.tenant_id || null;
    const items = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);
    
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "Payload vazio ou sem items." }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // --- Resolver Tenant ---
    if (!explicitTenantId) {
      for (const item of items) {
         if (item.pessoa_matricula) {
            const { data: col } = await supabase.from('colaboradores')
               .select('tenant_id')
               .eq('matricula', item.pessoa_matricula)
               .not('tenant_id', 'is', null)
               .limit(1).maybeSingle();
            if (col?.tenant_id) { explicitTenantId = col.tenant_id; break; }
         }
      }
      if (!explicitTenantId) {
         for (const item of items) {
             const cnpj = item.empresa_cnpj || item.cnpj;
             if (cnpj) {
                const numCnpj = String(cnpj).replace(/\D/g, '');
                const { data: emp } = await supabase.from('empresas')
                  .select('tenant_id').eq('cnpj', numCnpj).not('tenant_id', 'is', null).limit(1).maybeSingle();
                if (emp?.tenant_id) { explicitTenantId = emp.tenant_id; break; }
             }
         }
      }
    }

    const finalTenantId = explicitTenantId;
    if (!finalTenantId) {
       return new Response(JSON.stringify({ error: "Missing tenant_id." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Criar registro do Workflow na historico_importacoes
    const { data: historico, error: histError } = await supabase
      .from('historico_importacoes')
      .insert({
        tenant_id: finalTenantId,
        origem: 'api', // n8n ou rhid
        workflow: 'importar-pontos-rhid',
        nome_arquivo: `payload_api_${Date.now()}.json`,
        quantidade_recebida: items.length,
        status: 'VALIDANDO'
      })
      .select('id')
      .single();
    if (histError) console.error("[ERROR] ao criar histórico:", histError);
    const importacaoId = historico?.id;

    // 2. Extrair conjuntos chaves para busca otimizada de Colaboradores
    const cpfs = new Set<string>();
    const matriculas = new Set<string>();
    const nomes = new Set<string>();
    const rhidPersonIds = new Set<string>();

    for (const item of items) {
      if (item.cpf) cpfs.add(String(item.cpf).replace(/\D/g, ''));
      if (item.pessoa_matricula) matriculas.add(String(item.pessoa_matricula).trim());
      if (item.pessoa_nome) nomes.add(normalizeText(item.pessoa_nome));
      if (item.rhid_person_id) rhidPersonIds.add(String(item.rhid_person_id));
    }

    // Otimização: buscar colaboradores apenas relevantes ao invés do tenant inteiro
    let colabQuery = supabase.from('colaboradores').select('id, nome, matricula, cpf, empresa_id').eq('tenant_id', finalTenantId);
    let colabFilter = [];
    if (cpfs.size > 0) colabFilter.push(`cpf.in.(${Array.from(cpfs).join(',')})`);
    if (matriculas.size > 0) colabFilter.push(`matricula.in.(${Array.from(matriculas).join(',')})`);
    if (nomes.size > 0) colabFilter.push(`nome.in.(${Array.from(nomes).map(n => '"' + n + '"').join(',')})`);
    if (colabFilter.length > 0) {
      colabQuery = colabQuery.or(colabFilter.join(','));
    }

    const { data: dbColabs } = await colabQuery;

    const colabMap = new Map();
    if (dbColabs) {
       dbColabs.forEach(c => {
         // O banco não tem rhid_person_id ainda, então o match é feito por CPF, matricula, nome
         if (c.cpf) colabMap.set(`CPF_${String(c.cpf).replace(/\D/g, '')}`, c);
         if (c.matricula) colabMap.set(`MAT_${String(c.matricula).trim()}`, c);
         if (c.nome) colabMap.set(`NOME_${normalizeText(c.nome)}`, c);
       });
    }

    // 3. Buscar Empresas do Tenant para Self-Healing estruturado
    const { data: dbEmpresas } = await supabase.from('empresas').select('id, nome').eq('tenant_id', finalTenantId);
    const uniqueEmpresasMap = new Map();
    if (dbEmpresas) {
      dbEmpresas.forEach(e => {
        if (e.nome) uniqueEmpresasMap.set(normalizeCompanyText(e.nome), e);
      });
    }

    let cltsCriados = 0;
    let empresasCriadas = 0;
    const registrosMap = new Map();
    
    let quantidadeIgnorada = 0;
    let quantidadeInconsistente = 0;

    // --- PASSO PRINCIPAL ---
    for (const item of items) {
        // Validação mínima de Payload
        if (!item.data || !item.pessoa_nome) {
            quantidadeIgnorada++;
            continue;
        }

        // Resolvendo Empresa (Fallback normalizado)
        const rawCmpName = item.empresa_nome || item.empresa || "Empresa Desconhecida API";
        const normCmpName = normalizeCompanyText(rawCmpName);
        let matchedEmpresaId = null;

        if (uniqueEmpresasMap.has(normCmpName)) {
           matchedEmpresaId = uniqueEmpresasMap.get(normCmpName).id;
        } else {
           // Self-healing Empresa (Aguardando evidência sólida)
           if (normCmpName && rawCmpName !== "Empresa Desconhecida API") {
             const ts = Date.now().toString().slice(-6);
             const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
             
             const { data: newEmp } = await supabase.from('empresas')
                .insert({
                  tenant_id: finalTenantId,
                  nome: rawCmpName,
                  origem: 'api',
                  cnpj: `00000${ts}${rand}`,
                  status: 'ativa',
                  cadastro_provisorio: true,
                  unidade: 'Não informado',
                  cidade: 'Não informado',
                })
                .select('id').single();
                
             if (newEmp) {
               matchedEmpresaId = newEmp.id;
               uniqueEmpresasMap.set(normCmpName, { id: newEmp.id });
               empresasCriadas++;
             }
           }
        }

        // Identificação Colaborador no Fallback rigoroso
        const matQuery = item.pessoa_matricula ? `MAT_${String(item.pessoa_matricula).trim()}` : null;
        const rawCpf = item.cpf || item.pessoa_cpf;
        const cpfQuery = rawCpf ? `CPF_${String(rawCpf).replace(/\D/g, '')}` : null;
        const nomeQuery = item.pessoa_nome ? `NOME_${normalizeText(item.pessoa_nome)}` : null;

        let matchedColab = null;
        let matchedBy = null;

        if (cpfQuery && colabMap.has(cpfQuery)) { matchedColab = colabMap.get(cpfQuery); matchedBy = 'cpf'; }
        else if (matQuery && colabMap.has(matQuery)) { matchedColab = colabMap.get(matQuery); matchedBy = 'matricula'; }
        else if (nomeQuery && colabMap.has(nomeQuery)) { matchedColab = colabMap.get(nomeQuery); matchedBy = 'nome'; }

        // Self-Healing Colaborador
        if (!matchedColab) {
            // Apenas criar se tivermos um identificador forte!
            const possuiIdentificadorForte = (cpfQuery || matQuery);
            if (possuiIdentificadorForte) {
                const { data: newCol } = await supabase.from('colaboradores')
                  .insert({
                    tenant_id: finalTenantId,
                    empresa_id: matchedEmpresaId || null, 
                    nome: item.pessoa_nome.trim(),
                    cpf: rawCpf ? String(rawCpf).replace(/\D/g, '') : null,
                    matricula: item.pessoa_matricula ? String(item.pessoa_matricula).trim() : null,
                    tipo_colaborador: 'clt',
                    regime_trabalho: 'CLT',
                    modelo_calculo: 'CLT_MENSAL',
                    tipo_contrato: 'mensal',
                    status: 'pendente',
                    status_cadastro: 'pendente_complemento',
                    origem: 'api', // API / RHID
                    origem_cadastro: 'ponto_importado',
                    origem_detalhe: `Self-healing via Payload schema_version=${schemaVersion}`,
                    cadastro_provisorio: true,
                    permitir_lancamento_operacional: false
                  })
                  .select('id, nome, matricula, cpf, empresa_id').single();

                if (newCol) {
                    matchedColab = newCol;
                    matchedBy = 'self_healing';
                    cltsCriados++;
                    if (cpfQuery) colabMap.set(cpfQuery, newCol);
                    if (matQuery) colabMap.set(matQuery, newCol);
                    if (nomeQuery) colabMap.set(nomeQuery, newCol);
                }
            } else {
               quantidadeInconsistente++;
            }
        }

        // Hashing Idempotente: SHA256(tenant_id + empresa_id + origem + matricula/cpf/nome + data)
        const idenForte = rawCpf ? String(rawCpf).replace(/\D/g, '') : (item.pessoa_matricula ? String(item.pessoa_matricula).trim() : normalizeText(item.pessoa_nome));
        const hashStr = `${finalTenantId}_${matchedEmpresaId ?? 'null'}_api_${idenForte}_${item.data}`;
        const chaveImportacao = await sha256Hex(hashStr);

        const pointBase = {
            tenant_id: finalTenantId,
            importacao_id: importacaoId,
            chave_importacao: chaveImportacao,
            data: item.data,
            competencia: item.data ? item.data.slice(0, 7) : null,
            entrada: item.entrada,
            saida_almoco: item.saida_almoco,
            retorno_almoco: item.retorno_almoco,
            saida: item.saida,
            origem: 'api',
            status: matchedColab ? 'pendente' : 'inconsistente',
            status_processamento: 'pendente',
            nome_colaborador: item.pessoa_nome,
            matricula_colaborador: item.pessoa_matricula,
            cpf_colaborador: rawCpf ? String(rawCpf).replace(/\D/g, '') : null,
            empresa_nome: rawCmpName,
            empresa_id: matchedEmpresaId,
            colaborador_id: matchedColab ? matchedColab.id : null,
            horas_trabalhadas: item.horas_trabalhadas || item.horas || null,
            hora_extra: item.hora_extra || item.extras || null,
            falta: item.falta || null,
            atraso: item.atraso || null,
            observacoes: item.observacoes || JSON.stringify({ matched_by: matchedBy, schema: schemaVersion }),
            inconsistencias: matchedColab ? null : "Registro recusou Self-Healing por falta de identificador forte (CPF/Matrícula)."
        };

        const existingRecord = registrosMap.get(chaveImportacao);
        let mergedPoint = pointBase;
        if (existingRecord) {
             mergedPoint = {
                 ...existingRecord,
                 ...pointBase,
                 entrada: pointBase.entrada || existingRecord.entrada,
                 saida_almoco: pointBase.saida_almoco || existingRecord.saida_almoco,
                 retorno_almoco: pointBase.retorno_almoco || existingRecord.retorno_almoco,
                 saida: pointBase.saida || existingRecord.saida
             };
        }
        registrosMap.set(chaveImportacao, mergedPoint);
    }

    const registrosParaSalvar = Array.from(registrosMap.values());
    let inseridos_ou_atualizados = 0;

    // --- PASSO UPSERT IDEMPOTENTE ---
    if (registrosParaSalvar.length > 0) {
      // Faz upsert com base na Constraint Unica uix_registros_ponto_chave_importacao_tenant
      const { error: upsertError } = await supabase
          .from('registros_ponto')
          .upsert(registrosParaSalvar, { onConflict: 'tenant_id,chave_importacao' });

      if (upsertError) {
        console.error("[ERROR] Erro upsert de registros_ponto: ", upsertError.message);
        throw upsertError;
      }
      inseridos_ou_atualizados = registrosParaSalvar.length;
    }

    // 4. Finalizar Lote (historico_importacoes)
    if (importacaoId) {
       const finalStatus = quantidadeInconsistente > 0 ? 'INCONSISTENTE' : 'PROCESSADO';
       
       await supabase.from('historico_importacoes')
          .update({
            status: finalStatus,
            quantidade_registros: items.length, // total recebido
            quantidade_importada: inseridos_ou_atualizados,
            quantidade_inconsistencias: quantidadeInconsistente,
            quantidade_ignorada: quantidadeIgnorada,
            processado_em: new Date().toISOString(),
            finalizado_em: new Date().toISOString(),
            logs: { 
               mensagem: "Requisição finalizada.", 
               clts_autocriados: cltsCriados, 
               empresas_criadas: empresasCriadas,
               esquema_utilizado: schemaVersion
            }
          })
          .eq('id', importacaoId);
    }

    return new Response(JSON.stringify({
       success: true,
       message: "Importação concluída. Consulte o importacao_id para relatórios logísticos.",
       importacao_id: importacaoId,
       resumo: {
          recebidos: items.length,
          importados_vazados: inseridos_ou_atualizados,
          ignorados: quantidadeIgnorada,
          inconsistentes: quantidadeInconsistente,
          clts_criados: cltsCriados,
          empresas_criadas: empresasCriadas,
          schema: schemaVersion
       }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[CRITICAL] Falha geral na Edge Function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
