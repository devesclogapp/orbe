/**
 * CNAB240 — Layout Posicional Banco do Brasil (BB)
 *
 * Cada campo é descrito como [inicio, fim, tipo, tamanho]
 * inicio/fim são 1-indexed conforme documentação FEBRABAN.
 *
 * Referência: Manual Técnico FEBRABAN CNAB240 — versão BB
 * Código do Banco BB: 001
 */

/**
 * Tipo de campo CNAB:
 *  'N' = numérico   → alinhado à direita, preenchido com zeros à esquerda
 *  'A' = alfanumérico → alinhado à esquerda, preenchido com espaços à direita
 */
export type TipoCampo = 'N' | 'A';

export interface CampoCNAB {
  inicio: number;   // 1-indexed
  fim: number;      // 1-indexed, inclusive
  tipo: TipoCampo;
  descricao: string;
}

// ─── Registro Header de Arquivo (Tipo 0) — 240 bytes ──────────────────────────
export const HEADER_ARQUIVO: Record<string, CampoCNAB> = {
  banco:            { inicio: 1,   fim: 3,   tipo: 'N', descricao: 'Código do Banco na Compensação (001=BB)' },
  lote:             { inicio: 4,   fim: 7,   tipo: 'N', descricao: 'Lote de Serviço (0000=header)' },
  tipo_registro:    { inicio: 8,   fim: 8,   tipo: 'N', descricao: 'Tipo de Registro (0)' },
  brancos_1:        { inicio: 9,   fim: 17,  tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  tipo_inscricao:   { inicio: 18,  fim: 18,  tipo: 'N', descricao: 'Tipo de Inscrição da Empresa (1=CPF/2=CNPJ)' },
  numero_inscricao: { inicio: 19,  fim: 32,  tipo: 'N', descricao: 'Número de Inscrição da Empresa' },
  convenio:         { inicio: 33,  fim: 52,  tipo: 'A', descricao: 'Código do Convênio no Banco' },
  agencia:          { inicio: 53,  fim: 57,  tipo: 'N', descricao: 'Agência Mantenedora da Conta' },
  digito_agencia:   { inicio: 58,  fim: 58,  tipo: 'A', descricao: 'Dígito Verificador da Agência' },
  conta:            { inicio: 59,  fim: 70,  tipo: 'N', descricao: 'Número da Conta Corrente' },
  digito_conta:     { inicio: 71,  fim: 71,  tipo: 'A', descricao: 'Dígito Verificador da Conta' },
  digito_ag_conta:  { inicio: 72,  fim: 72,  tipo: 'A', descricao: 'Dígito Verificador da Ag/Conta' },
  nome_empresa:     { inicio: 73,  fim: 102, tipo: 'A', descricao: 'Nome da Empresa' },
  nome_banco:       { inicio: 103, fim: 132, tipo: 'A', descricao: 'Nome do Banco' },
  brancos_2:        { inicio: 133, fim: 142, tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  cod_remessa:      { inicio: 143, fim: 143, tipo: 'N', descricao: 'Código Remessa/Retorno (1=Remessa)' },
  data_geracao:     { inicio: 144, fim: 151, tipo: 'N', descricao: 'Data de Geração do Arquivo (DDMMAAAA)' },
  hora_geracao:     { inicio: 152, fim: 157, tipo: 'N', descricao: 'Hora de Geração do Arquivo (HHMMSS)' },
  num_sequencial:   { inicio: 158, fim: 163, tipo: 'N', descricao: 'Número Seqüencial do Arquivo' },
  versao_layout:    { inicio: 164, fim: 166, tipo: 'N', descricao: 'Nº da Versão do Layout do Arquivo' },
  densidade:        { inicio: 167, fim: 171, tipo: 'N', descricao: 'Densidade de Gravação do Arquivo' },
  reservado_banco:  { inicio: 172, fim: 191, tipo: 'A', descricao: 'Para Uso Reservado do Banco' },
  reservado_emp:    { inicio: 192, fim: 211, tipo: 'A', descricao: 'Para Uso Reservado da Empresa' },
  brancos_3:        { inicio: 212, fim: 240, tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
};

// ─── Registro Header de Lote (Tipo 1) — 240 bytes ────────────────────────────
export const HEADER_LOTE: Record<string, CampoCNAB> = {
  banco:            { inicio: 1,   fim: 3,   tipo: 'N', descricao: 'Código do Banco na Compensação' },
  lote:             { inicio: 4,   fim: 7,   tipo: 'N', descricao: 'Lote de Serviço' },
  tipo_registro:    { inicio: 8,   fim: 8,   tipo: 'N', descricao: 'Tipo de Registro (1)' },
  tipo_operacao:    { inicio: 9,   fim: 9,   tipo: 'A', descricao: 'Tipo da Operação (C=Crédito)' },
  tipo_servico:     { inicio: 10,  fim: 11,  tipo: 'N', descricao: 'Tipo do Serviço (45=Pag.Fornecedor)' },
  forma_lancamento: { inicio: 12,  fim: 13,  tipo: 'N', descricao: 'Forma de Lançamento (41=TED/43=DOC/01=CC)' },
  versao_layout:    { inicio: 14,  fim: 16,  tipo: 'N', descricao: 'Nº da Versão do Layout do Lote' },
  brancos_1:        { inicio: 17,  fim: 17,  tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  tipo_inscricao:   { inicio: 18,  fim: 18,  tipo: 'N', descricao: 'Tipo de Inscrição da Empresa' },
  numero_inscricao: { inicio: 19,  fim: 32,  tipo: 'N', descricao: 'Nº de Inscrição da Empresa' },
  convenio:         { inicio: 33,  fim: 52,  tipo: 'A', descricao: 'Código do Convênio no Banco' },
  agencia:          { inicio: 53,  fim: 57,  tipo: 'N', descricao: 'Agência Mantenedora da Conta' },
  digito_agencia:   { inicio: 58,  fim: 58,  tipo: 'A', descricao: 'Dígito Verificador da Agência' },
  conta:            { inicio: 59,  fim: 70,  tipo: 'N', descricao: 'Número da Conta Corrente' },
  digito_conta:     { inicio: 71,  fim: 71,  tipo: 'A', descricao: 'Dígito Verificador da Conta' },
  digito_ag_conta:  { inicio: 72,  fim: 72,  tipo: 'A', descricao: 'Dígito Verificador da Ag/Conta' },
  nome_empresa:     { inicio: 73,  fim: 102, tipo: 'A', descricao: 'Nome da Empresa' },
  mensagem_1:       { inicio: 103, fim: 142, tipo: 'A', descricao: 'Mensagem 1 / Finalidade do Lote' },
  logradouro:       { inicio: 143, fim: 172, tipo: 'A', descricao: 'Logradouro da Empresa' },
  numero:           { inicio: 173, fim: 177, tipo: 'N', descricao: 'Número do Local' },
  complemento:      { inicio: 178, fim: 192, tipo: 'A', descricao: 'Complemento do Local' },
  cidade:           { inicio: 193, fim: 212, tipo: 'A', descricao: 'Nome da Cidade' },
  cep:              { inicio: 213, fim: 217, tipo: 'N', descricao: 'CEP (5 dígitos iniciais)' },
  sufixo_cep:       { inicio: 218, fim: 220, tipo: 'N', descricao: 'Sufixo do CEP' },
  estado:           { inicio: 221, fim: 222, tipo: 'A', descricao: 'Sigla do Estado' },
  brancos_2:        { inicio: 223, fim: 230, tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  ocorrencias:      { inicio: 231, fim: 240, tipo: 'A', descricao: 'Ocorrências para o Retorno' },
};

// ─── Registro Detalhe Segmento A (Tipo 3) — 240 bytes ────────────────────────
export const SEGMENTO_A: Record<string, CampoCNAB> = {
  banco:              { inicio: 1,   fim: 3,   tipo: 'N', descricao: 'Código do Banco na Compensação' },
  lote:               { inicio: 4,   fim: 7,   tipo: 'N', descricao: 'Lote de Serviço' },
  tipo_registro:      { inicio: 8,   fim: 8,   tipo: 'N', descricao: 'Tipo de Registro (3)' },
  num_sequencial:     { inicio: 9,   fim: 13,  tipo: 'N', descricao: 'Número Seqüencial do Registro no Lote' },
  cod_segmento:       { inicio: 14,  fim: 14,  tipo: 'A', descricao: 'Código de Segmento do Registro Detalhe (A)' },
  tipo_movimento:     { inicio: 15,  fim: 15,  tipo: 'N', descricao: 'Tipo de Movimento (0=Inclusão)' },
  cod_instrucao:      { inicio: 16,  fim: 17,  tipo: 'N', descricao: 'Código de Instrução p/ Movimento (00=Incl.)' },
  camara_comp:        { inicio: 18,  fim: 20,  tipo: 'N', descricao: 'Código da Câmara Compensação (018=TED)' },
  banco_favorecido:   { inicio: 21,  fim: 23,  tipo: 'N', descricao: 'Código do Banco do Favorecido' },
  agencia_favorecido: { inicio: 24,  fim: 28,  tipo: 'N', descricao: 'Agência Mantenedora da Cta do Favorecido' },
  digito_ag_fav:      { inicio: 29,  fim: 29,  tipo: 'A', descricao: 'Dígito Verificador da Agência do Favorecido' },
  conta_favorecido:   { inicio: 30,  fim: 41,  tipo: 'N', descricao: 'Número da Conta Corrente do Favorecido' },
  digito_conta_fav:   { inicio: 42,  fim: 42,  tipo: 'A', descricao: 'Dígito Verificador da Conta do Favorecido' },
  digito_ag_cta_fav:  { inicio: 43,  fim: 43,  tipo: 'A', descricao: 'Dígito Verificador da Ag/Cta do Favorecido' },
  nome_favorecido:    { inicio: 44,  fim: 73,  tipo: 'A', descricao: 'Nome do Favorecido' },
  seu_numero:         { inicio: 74,  fim: 93,  tipo: 'A', descricao: 'Nº do Docto Atribuído pela Empresa' },
  data_pagamento:     { inicio: 94,  fim: 101, tipo: 'N', descricao: 'Data do Pagamento (DDMMAAAA)' },
  tipo_moeda:         { inicio: 102, fim: 104, tipo: 'A', descricao: 'Tipo da Moeda (BRL)' },
  qtd_moeda:          { inicio: 105, fim: 119, tipo: 'N', descricao: 'Quantidade da Moeda (zeros p/ BRL)' },
  valor_pagamento:    { inicio: 120, fim: 134, tipo: 'N', descricao: 'Valor do Pagamento' },
  nosso_numero:       { inicio: 135, fim: 154, tipo: 'A', descricao: 'Número do Docto Atribuído pelo Banco' },
  data_real_pag:      { inicio: 155, fim: 162, tipo: 'N', descricao: 'Data Real de Efetivação do Pagamento' },
  valor_real_pag:     { inicio: 163, fim: 177, tipo: 'N', descricao: 'Valor Real de Efetivação do Pagamento' },
  informacao_2:       { inicio: 178, fim: 217, tipo: 'A', descricao: 'Outras Informações' },
  cod_finalidade_doc: { inicio: 218, fim: 219, tipo: 'A', descricao: 'Código Finalidade do DOC' },
  cod_finalidade_ted: { inicio: 220, fim: 224, tipo: 'N', descricao: 'Código Finalidade da TED' },
  cod_finalidade_comp:{ inicio: 225, fim: 226, tipo: 'A', descricao: 'Código Finalidade Complementar' },
  brancos_1:          { inicio: 227, fim: 229, tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  aviso:              { inicio: 230, fim: 230, tipo: 'N', descricao: 'Aviso ao Favorecido (0=Sem aviso)' },
  ocorrencias:        { inicio: 231, fim: 240, tipo: 'A', descricao: 'Ocorrências para o Retorno' },
};

// ─── Registro Detalhe Segmento B (Tipo 3) — 240 bytes ────────────────────────
export const SEGMENTO_B: Record<string, CampoCNAB> = {
  banco:              { inicio: 1,   fim: 3,   tipo: 'N', descricao: 'Código do Banco na Compensação' },
  lote:               { inicio: 4,   fim: 7,   tipo: 'N', descricao: 'Lote de Serviço' },
  tipo_registro:      { inicio: 8,   fim: 8,   tipo: 'N', descricao: 'Tipo de Registro (3)' },
  num_sequencial:     { inicio: 9,   fim: 13,  tipo: 'N', descricao: 'Número Seqüencial do Registro no Lote' },
  cod_segmento:       { inicio: 14,  fim: 14,  tipo: 'A', descricao: 'Código de Segmento do Registro Detalhe (B)' },
  brancos_1:          { inicio: 15,  fim: 17,  tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  tipo_inscricao:     { inicio: 18,  fim: 18,  tipo: 'N', descricao: 'Tipo de Inscrição (1=CPF/2=CNPJ)' },
  cpf_cnpj_fav:       { inicio: 19,  fim: 32,  tipo: 'N', descricao: 'CPF/CNPJ do Favorecido' },
  logradouro_fav:     { inicio: 33,  fim: 62,  tipo: 'A', descricao: 'Logradouro (Rua, Av, etc.)' },
  numero_fav:         { inicio: 63,  fim: 67,  tipo: 'N', descricao: 'Número' },
  complemento_fav:    { inicio: 68,  fim: 82,  tipo: 'A', descricao: 'Complemento' },
  bairro_fav:         { inicio: 83,  fim: 97,  tipo: 'A', descricao: 'Bairro' },
  cidade_fav:         { inicio: 98,  fim: 117, tipo: 'A', descricao: 'Cidade' },
  cep_fav:            { inicio: 118, fim: 122, tipo: 'N', descricao: 'CEP' },
  sufixo_cep_fav:     { inicio: 123, fim: 125, tipo: 'N', descricao: 'Sufixo do CEP' },
  estado_fav:         { inicio: 126, fim: 127, tipo: 'A', descricao: 'Sigla do Estado' },
  data_vencto:        { inicio: 128, fim: 135, tipo: 'N', descricao: 'Data do Vencimento (DDMMAAAA / zeros)' },
  valor_documento:    { inicio: 136, fim: 150, tipo: 'N', descricao: 'Valor do Documento' },
  valor_abatimento:   { inicio: 151, fim: 165, tipo: 'N', descricao: 'Valor do Abatimento' },
  valor_desconto:     { inicio: 166, fim: 180, tipo: 'N', descricao: 'Valor do Desconto' },
  valor_mora:         { inicio: 181, fim: 195, tipo: 'N', descricao: 'Valor da Mora' },
  valor_multa:        { inicio: 196, fim: 210, tipo: 'N', descricao: 'Valor da Multa' },
  cod_doc_favorecido: { inicio: 211, fim: 225, tipo: 'A', descricao: 'Código/Nro do Documento do Favorecido' },
  aviso:              { inicio: 226, fim: 226, tipo: 'N', descricao: 'Aviso (0=sem)' },
  brancos_2:          { inicio: 227, fim: 240, tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
};

// ─── Registro Trailer de Lote (Tipo 5) — 240 bytes ───────────────────────────
export const TRAILER_LOTE: Record<string, CampoCNAB> = {
  banco:              { inicio: 1,   fim: 3,   tipo: 'N', descricao: 'Código do Banco na Compensação' },
  lote:               { inicio: 4,   fim: 7,   tipo: 'N', descricao: 'Lote de Serviço' },
  tipo_registro:      { inicio: 8,   fim: 8,   tipo: 'N', descricao: 'Tipo de Registro (5)' },
  brancos_1:          { inicio: 9,   fim: 17,  tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  qtd_registros:      { inicio: 18,  fim: 23,  tipo: 'N', descricao: 'Quantidade de Registros do Lote' },
  qtd_debitos:        { inicio: 24,  fim: 29,  tipo: 'N', descricao: 'Quantidade de Títulos em Cobrança' },
  valor_debitos:      { inicio: 30,  fim: 46,  tipo: 'N', descricao: 'Valor Total dos Títulos em Cobrança' },
  qtd_creditos:       { inicio: 47,  fim: 52,  tipo: 'N', descricao: 'Quantidade de Títulos Liquidados' },
  valor_creditos:     { inicio: 53,  fim: 69,  tipo: 'N', descricao: 'Valor Total dos Títulos Liquidados' },
  qtd_outras:         { inicio: 70,  fim: 75,  tipo: 'N', descricao: 'Quantidade de Títulos em Exigibilidade Suspensa' },
  valor_outras:       { inicio: 76,  fim: 92,  tipo: 'N', descricao: 'Valor Total dos Títulos em Exigibilidade Suspensa' },
  num_aviso_debito:   { inicio: 93,  fim: 98,  tipo: 'N', descricao: 'Número do Aviso de Débito' },
  brancos_2:          { inicio: 99,  fim: 230, tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  ocorrencias:        { inicio: 231, fim: 240, tipo: 'A', descricao: 'Ocorrências para o Retorno' },
};

// ─── Registro Trailer de Arquivo (Tipo 9) — 240 bytes ────────────────────────
export const TRAILER_ARQUIVO: Record<string, CampoCNAB> = {
  banco:              { inicio: 1,   fim: 3,   tipo: 'N', descricao: 'Código do Banco na Compensação' },
  lote:               { inicio: 4,   fim: 7,   tipo: 'N', descricao: 'Lote de Serviço (9999)' },
  tipo_registro:      { inicio: 8,   fim: 8,   tipo: 'N', descricao: 'Tipo de Registro (9)' },
  brancos_1:          { inicio: 9,   fim: 17,  tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
  qtd_lotes:          { inicio: 18,  fim: 23,  tipo: 'N', descricao: 'Quantidade de Lotes do Arquivo' },
  qtd_registros:      { inicio: 24,  fim: 29,  tipo: 'N', descricao: 'Quantidade de Registros do Arquivo' },
  qtd_contas:         { inicio: 30,  fim: 35,  tipo: 'N', descricao: 'Qtd de Contas p/ Conciliação (Opcional)' },
  brancos_2:          { inicio: 36,  fim: 240, tipo: 'A', descricao: 'Uso Exclusivo FEBRABAN/CNAB' },
};

/** Constantes do Banco do Brasil */
export const BB = {
  CODIGO_BANCO: '001',
  NOME_BANCO: 'BANCO DO BRASIL S.A.',
  VERSAO_LAYOUT_ARQUIVO: '103',
  VERSAO_LAYOUT_LOTE: '046',
  // Forma de lançamento:
  // 01 = Crédito em Conta Corrente (mesmo banco)
  // 41 = TED outra titularidade, outra IF
  // 43 = DOC outra IF
  // 45 = Pix
  FORMA_LANCAMENTO_TED: 41,
  FORMA_LANCAMENTO_CC: 1,
  // Câmara compensação:
  // 018 = STR (TED)
  // 700 = DOC
  // 000 = Mesmo banco ou pix interno
  CAMARA_TED: '018',
  CAMARA_CC: '000',
  // Tipo serviço: 20=Pagamento a Fornecedores, 30=Pagamento de Salários
  TIPO_SERVICO_FORNECEDOR: 20,
  TIPO_SERVICO_SALARIO: 30,
  // Código finalidade TED: 00001=Crédito em CC, 00003=Liquidação de Título, 00005=Pagto de Salário
  FINALIDADE_TED_CC: '00001',
  FINALIDADE_TED_SALARIO: '00005',
};
