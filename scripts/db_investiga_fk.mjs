import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const result = {};

    // Etapa 1
    const { data: q1, error: e1 } = await c.rpc('execute_sql', {
        query: `
      select
        conname,
        pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conname = 'financeiro_consolidados_cliente_comp_fk';
    `
    });
    result.etapa1 = q1 || e1;

    // Etapa 2
    const { data: q2, error: e2 } = await c.rpc('execute_sql', {
        query: `
      select
        table_name,
        column_name,
        data_type
      from information_schema.columns
      where table_name in (
        'financeiro_consolidados_cliente',
        'ciclos_operacionais'
      )
      and column_name in ('competencia', 'empresa_id', 'tenant_id')
      order by table_name, column_name;
    `
    });
    result.etapa2 = q2 || e2;

    // Etapa 3
    const { data: q3, error: e3 } = await c.rpc('execute_sql', {
        query: `
      select
        id,
        competencia,
        empresa_id,
        tenant_id,
        status_rh,
        status_financeiro
      from ciclos_operacionais
      order by created_at desc
      limit 20;
    `
    });
    result.etapa3 = q3 || e3;

    // Etapa 4
    const { data: q4, error: e4 } = await c.rpc('execute_sql', {
        query: `
      select
        column_name,
        data_type
      from information_schema.columns
      where table_name = 'financeiro_consolidados_cliente'
      order by ordinal_position;
    `
    });
    result.etapa4 = q4 || e4;

    fs.writeFileSync('db_investiga_fk.json', JSON.stringify(result, null, 2));
}

run();
