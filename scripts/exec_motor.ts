import { MotorFinanceiro } from './src/services/operationalEngine/MotorFinanceiro';
import { supabase } from '@/lib/supabase'; // Vai carregar o env.local por causa do Vite ou tsx dotenv se precisar
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const competencia = '2026-06-01'; // Motor uses format YYYY-MM ou YYYY-MM-DD
  const empresaId = 'df3b197e-0330-4c7a-b685-1ac0347bb751';
  const tenantId = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';

  // We need to bypass auth by using service_role or just testing logic
  // The user said: "Aprovar Financeiro -> Esperado: consolidado criado"
  // Wait, I can just use Supabase client with admin credentials to bypass RLS, ensuring Motor logic is flawless!
  console.log("Running processarFechamento...");
  try {
    const r = await MotorFinanceiro.processarFechamento('2026-06', empresaId, tenantId);
    console.log("RESULT:", r);
  } catch (err) {
    console.error("FAIL:", err);
  }
}

run();
