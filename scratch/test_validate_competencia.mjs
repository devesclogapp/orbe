import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We can test RHFinanceiroService by importing it
// Let's create an authentication session and run validateCompetenciaApproval
import { supabase } from '../src/lib/supabase.ts';
import { RHFinanceiroService } from '../src/services/rhFinanceiro.service.ts';

const EXPECTED_SANDBOX_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
const COMPETENCIA = '2026-10';

async function main() {
  console.log('=== TESTE DE VALIDAÇÃO DE APROVAÇÃO DA COMPETÊNCIA ===');

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
  });
  if (authErr || !authData.user) {
    throw new Error(`Auth failed: ${authErr?.message}`);
  }
  console.log(`[AUTH] Conectado: ${authData.user.email}`);

  const validation = await RHFinanceiroService.validateCompetenciaApproval(EXPECTED_SANDBOX_ID, COMPETENCIA);
  console.log('Validação obtida:', {
    empresaNome: validation.empresaNome,
    impedimentos: validation.impedimentos,
    bloqueiosCriticosCount: validation.bloqueiosCriticos.length,
    resumo: validation.resumo,
  });
}

main().catch(console.error);
