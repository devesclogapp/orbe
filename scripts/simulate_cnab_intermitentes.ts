import { IntermitentesLoteService } from '../src/services/domain/intermitentes.service';
import { supabase } from '../src/lib/supabase';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

async function run() {
    const loteId = 'f5a80602-8a77-49ad-83c1-f4cf00a6ecdf';
    
    console.log("1. Buscando Lote...");
    const { data: lote } = await supabase.from('intermitentes_lotes_fechamento').select('*').eq('id', loteId).single();
    if (!lote) throw new Error("Lote não encontrado");

    console.log(`Lote Origem: ${lote.id} | Status: ${lote.status}`);
    
    console.log("2. Gerando CNAB para o Lote...");

    try {
        const result = await IntermitentesLoteService.gerarCNABParaLote({
            loteId,
            empresaId: lote.empresa_id || '00000000-0000-0000-0000-000000000000',
            geradoPor: '00000000-0000-0000-0000-000000000000',
            geradoPorNome: 'Auditoria Script',
            empresaRemetente: {
                cnpj: '12345678000199', // dummy info para gerar
                razao_social: 'Empresa Teste',
                banco_codigo: '001',
                agencia: '1234',
                conta: '12345',
            }
        });

        console.log("CNAB GERADO COM SUCESSO!");
        console.log("Arquivo:", result.nomeArquivo);
        console.log("Registros:", result.totalRegistros);
        console.log("Valor:", result.valorTotal);
    } catch (e: any) {
        console.error("ERRO AO GERAR CNAB:");
        console.error(e.message);
    }
}
run();
