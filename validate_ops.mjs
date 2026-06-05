
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs'
const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnostic() {
    console.log('--- START DIAGNOSTIC ---')

    // 1. Get a profile/tenant
    const { data: profile } = await supabase.from('profiles').select('*').limit(1).single()
    console.log('Profile:', profile)

    if (!profile) return

    const tenantId = profile.tenant_id

    // 2. Get existing entities
    const { data: empresa } = await supabase.from('empresas').select('*').eq('tenant_id', tenantId).limit(1).single()
    const { data: transportadora } = await supabase.from('transportadoras_clientes').select('*').eq('tenant_id', tenantId).limit(1).single()
    const { data: fornecedor } = await supabase.from('fornecedores').select('*').eq('tenant_id', tenantId).limit(1).single()
    const { data: produto } = await supabase.from('produtos_carga').select('*').eq('tenant_id', tenantId).limit(1).single()
    const { data: rule } = await supabase.from('tipos_servico_operacional').select('*').eq('tenant_id', tenantId).limit(1).single()
    const { data: forma } = await supabase.from('formas_pagamento_operacional').select('*').eq('tenant_id', tenantId).limit(1).single()

    console.log('Entities found:', {
        empresa: empresa?.nome,
        transportadora: transportadora?.nome,
        fornecedor: fornecedor?.nome,
        produto: produto?.nome,
        rule: rule?.nome,
        forma: forma?.nome
    })

    if (empresa && transportadora && fornecedor && produto && rule && forma) {
        const payload = {
            tenant_id: tenantId,
            empresa_id: empresa.id,
            tipo_servico_id: rule.id,
            transportadora_id: transportadora.id,
            fornecedor_id: fornecedor.id,
            produto_carga_id: produto.id,
            forma_pagamento_id: forma.id,
            quantidade: 100,
            valor_unitario_snapshot: 5.50,
            valor_total: 550.00,
            data_operacao: new Date().toISOString().split('T')[0],
            status: 'aguardando_validacao',
            origem_dado: 'manual',
            responsavel_nome: 'Antigravity Validator'
        }

        console.log('Creating operation with payload:', payload)
        const { data: op, error } = await supabase.from('operacoes_producao').insert(payload).select().single()

        if (error) {
            console.error('Error creating operation:', error)
        } else {
            console.log('Operation created successfully:', op.id)
        }
    } else {
        console.log('One or more entities missing. Cannot create operation.')
    }
}

diagnostic()
