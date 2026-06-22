import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://lifgjtcflzmspilhryap.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const motorSrc = fs.readFileSync('src/services/operationalEngine/MotorFinanceiro.ts', 'utf8');
// To use the real MotorFinanceiro, I need to typescript-compile it or evaluate it.
// Easier to use ts-node
