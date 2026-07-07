import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const sb = createClient(url, key);

async function runAudit() {
  console.log("--- INICIANDO AUDITORIA DE SEGURANÇA 10.3 / 10.4 ---");
  
  // Login as standard encarregado or admin
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: 'admin@orbelogistica.com.br',
    password: '123'
  });
  
  if (authErr) {
    console.log("Erro de auth:", authErr);
    return;
  }
  
  const token = auth.session.access_token;
  console.log("Autenticado como admin.");

  // Pegar uma operacao do status FATURADO ou RECEBIDO
  const { data: ops } = await sb.from('operacoes_producao')
      .select('id, status, tenant_id, valor_total')
      .in('status', ['RECEBIDO', 'FATURADO', 'AGUARDANDO_FATURAMENTO'])
      .limit(1);

  if (!ops || ops.length === 0) {
    console.log("Nenhuma operacao FATURADA encontrada para teste.");
    return;
  }

  const targetOp = ops[0];
  console.log(`Operação Alvo: ${targetOp.id} | Status Atual: ${targetOp.status}`);
  
  // Atacar 1: Bypass UI - Tentar editar o valor livremente
  console.log(">>> Tentando atualizar valor de operação fechada...");
  const { data: updateRes, error: updateErr } = await sb.from('operacoes_producao')
      .update({ valor_total: 999999, data_referencia: new Date().toISOString() })
      .eq('id', targetOp.id)
      .select();

  if (updateErr) {
    console.log("🟢 Bloqueado pelo Banco/RLS/Triggers:", updateErr.message);
  } else {
    console.log("🔴 VULNERÁVEL: Operação financeira permitida de ser sobrescrita livremente via API bypassing frontend.");
    console.log("Response:", updateRes);
  }
}

runAudit().catch(console.error);
