
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

console.log("Edge Function 'generate-demo-data' iniciada!")

serve(async (req: any) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      quantidade_empresas, 
      colaboradores_por_empresa, 
      dias, 
      operacoes_por_dia, 
      percentual_inconsistencias,
      user_id 
    } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const lote_id = crypto.randomUUID()
    const lote_nome = `Lote Demo ${new Date().toLocaleString('pt-BR')}`

    // 1. Criar Lote
    await supabase.from('demo_lotes').insert({
      id: lote_id,
      nome: lote_nome,
      parametros: { quantidade_empresas, colaboradores_por_empresa, dias, operacoes_por_dia, percentual_inconsistencias, user_id }
    })

    const empresasArr = []
    const colaboradoresArr = []
    const pontosArr = []
    const operacoesArr = []
    const bhEventosArr = []
    const consolidadosArr = []

    // Geração de Empresas
    for (let i = 0; i < quantidade_empresas; i++) {
        const emp = {
            nome: `Empresa Demo ${i + 1}`,
            cnpj: `${Math.floor(Math.random() * 99999999999999)}`.padStart(14, '0'),
            status: 'ativa',
            is_teste: true,
            lote_id
        }
        const { data: empData, error: errEmp } = await supabase.from('empresas').insert(emp).select().single()
        if (errEmp) throw errEmp;
        
        if (empData) {
            empresasArr.push(empData)
            
            // Criar Cliente Demo para esta empresa
            const { data: cliData } = await supabase.from('clientes').insert({
                nome: `Cliente ${empData.nome}`,
                empresa_id: empData.id,
                status: 'ativo',
                is_teste: true,
                lote_id
            }).select().single();

            // Criar Competência Atual para esta empresa
            const competenciaStr = new Date().toISOString().substring(0, 7) + '-01';
            await supabase.from('financeiro_competencias').insert({
                competencia: competenciaStr,
                empresa_id: empData.id,
                status: 'aberta',
                is_teste: true,
                lote_id
            });
            
            // Geração de Colaboradores
            for (let j = 0; j < colaboradores_por_empresa; j++) {
                const col = {
                    nome: `Colaborador Demo ${i + 1}-${j + 1}`,
                    cargo: ['Operador', 'Líder', 'Encarregado'][Math.floor(Math.random() * 3)],
                    empresa_id: empData.id,
                    tipo_contrato: Math.random() > 0.5 ? 'Hora' : 'Operação',
                    valor_base: 25.00 + Math.random() * 50,
                    status: 'ok',
                    is_teste: true,
                    lote_id,
                    matricula: `MAT-${lote_id.substring(0,4)}-${i}-${j}`
                }
                const { data: colData, error: errCol } = await supabase.from('colaboradores').insert(col).select().single()
                if (errCol) throw errCol;

                if (colData) {
                    colaboradoresArr.push(colData)
                    
                    // Geração de Ponto e Operações para os últimos N dias
                    for (let d = 0; d < dias; d++) {
                        const data = new Date()
                        data.setDate(data.getDate() - d)
                        const dataStr = data.toISOString().split('T')[0]
                        
                        // Ponto
                        const isInconsistente = Math.random() * 100 < percentual_inconsistencias
                        pontosArr.push({
                            colaborador_id: colData.id,
                            data: dataStr,
                            entrada: '08:00',
                            saida_almoco: '12:00',
                            retorno_almoco: '13:00',
                            saida: isInconsistente ? '16:00' : '17:00',
                            status: isInconsistente ? 'inconsistente' : 'ok',
                            is_teste: true,
                            lote_id,
                            periodo: 'Diurno',
                            tipo_dia: 'Normal'
                        })

                        // Gerar Evento de Banco de Horas (Crédito ou Débito aleatório em alguns dias)
                        if (Math.random() > 0.6) {
                            const isCredito = Math.random() > 0.3;
                            const mins = isCredito ? 30 + Math.floor(Math.random() * 120) : -(30 + Math.floor(Math.random() * 60));
                            bhEventosArr.push({
                                colaborador_id: colData.id,
                                empresa_id: empData.id,
                                data: new Date(data).toISOString(),
                                data_vencimento: new Date(data.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 dias
                                quantidade_minutos: mins,
                                tipo: isCredito ? 'credito' : 'debito',
                                origem: isCredito ? 'Hora Extra' : 'Atraso/Saída Antecipada',
                                descricao: 'Gerado via demo data',
                                is_teste: true,
                                lote_id
                            })
                        }
                        
                        // Operações (apenas alguns colaboradores fazem operações)
                        if (colData.tipo_contrato === 'Operação') {
                            for (let o = 0; o < operacoes_por_dia; o++) {
                                operacoesArr.push({
                                    data: dataStr,
                                    transportadora: 'Transportadora Demo',
                                    tipo_servico: 'Volume',
                                    quantidade: 10 + Math.floor(Math.random() * 90),
                                    valor_unitario: 1.50,
                                    status: 'ok',
                                    responsavel_id: colData.id,
                                    is_teste: true,
                                    lote_id,
                                    produto: 'Produto Demo'
                                })
                            }
                        }
                    }
                }
            }
        }
    }

    // Geração de Consolidados Financeiros (um por empresa/mês)
    const competencia = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';
    for (const emp of empresasArr) {
        // Buscar o cliente que acabamos de criar para esta empresa
        const { data: cli } = await supabase.from('clientes').select('id').eq('empresa_id', emp.id).eq('lote_id', lote_id).single();

        consolidadosArr.push({
            competencia: competencia,
            empresa_id: emp.id,
            cliente_id: cli?.id || null,
            valor_base: 5000 + Math.random() * 15000,
            valor_regras: Math.random() * 2000,
            valor_total: 0, // calculado no DB ou post-insert
            quantidade_operacoes: Math.floor(Math.random() * 100),
            status: 'pendente',
            is_teste: true,
            lote_id
        });
    }

    // Inserções em lote para performance (máximo 1000 por vez)
    const chunkSize = 500;
    
    for (let i = 0; i < pontosArr.length; i += chunkSize) {
      await supabase.from('registros_ponto').insert(pontosArr.slice(i, i + chunkSize))
    }
    
    for (let i = 0; i < operacoesArr.length; i += chunkSize) {
      await supabase.from('operacoes').insert(operacoesArr.slice(i, i + chunkSize))
    }

    for (let i = 0; i < bhEventosArr.length; i += chunkSize) {
      await supabase.from('banco_horas_eventos').insert(bhEventosArr.slice(i, i + chunkSize))
    }

    if (consolidadosArr.length > 0) {
      await supabase.from('financeiro_consolidados_cliente').insert(consolidadosArr)
    }

    // Atualizar totais do lote
    const totais = {
        empresas: empresasArr.length,
        colaboradores: colaboradoresArr.length,
        pontos: pontosArr.length,
        operacoes: operacoesArr.length,
        bh_eventos: bhEventosArr.length,
        consolidados: consolidadosArr.length
    }
    await supabase.from('demo_lotes').update({ totais }).eq('id', lote_id)

    return new Response(
      JSON.stringify({ success: true, lote_id, nome: lote_nome, totais }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
