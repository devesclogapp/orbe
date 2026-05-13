import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e Anon Key são obrigatórios no arquivo .env.local');
}

// Singleton global para evitar múltiplas instâncias
const globalKey = '__orbe_supabase_client__';
declare global { interface Window { [globalKey]: SupabaseClient } }

if (!window[globalKey]) {
  window[globalKey] = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    }
  });
}

export const supabase = window[globalKey];
export const supabaseRP = supabase;
export const supabasePortal = supabase;

console.log('[Supabase] Cliente singleton inicializado.');