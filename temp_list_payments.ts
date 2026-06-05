
import { supabase } from './src/lib/supabase';

async function listPayments() {
    const { data, error } = await supabase.from('formas_pagamento_operacional').select('*');
    console.log(JSON.stringify(data, null, 2));
}

listPayments();
