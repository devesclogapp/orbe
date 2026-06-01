import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { getTransportadoraDuplicateMessage, getTransportadoraErrorMessage } from '@/utils/transportadoraValidation';
import {
  gerarCNAB240BB,
  downloadCNAB240,
  validarBeneficiarios,
  type EmpresaRemessa,
  type BeneficiarioPagamento,
} from './cnab/cnab240-posicional';
import { CnabRemessaArquivoService } from './cnab/cnabRemessaArquivo.service';

export * from './domain/core.service';
export * from './domain/cadastros.service';
export * from './domain/producao.service';
export * from './domain/diaristas.service';
export * from './domain/despesas.service';
