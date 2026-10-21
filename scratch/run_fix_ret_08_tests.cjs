const fs = require('fs');
const crypto = require('crypto');

const AUTHORIZED_IDS = [
  '1e94a70f-0591-44fb-9541-fb0bc4c6c644',
  '685d7146-f315-4f6a-9609-de6dabbe554e',
  '88f71013-09a6-48a8-9446-179930134950',
];
const RETORNO_ID = '853f93c9-0027-4607-b5de-16a557211243';
const REMESSA_ID = '46391aad-6417-48cf-ac78-03a2a9dd8b22';
const LOTE_ID = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
const TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';

function simularGuardTemporario(oldRow, newRow) {
  if (newRow.status !== oldRow.status) {
    throw new Error('O status bancario do retorno nao pode ser alterado manualmente.');
  }

  if (oldRow.status_conciliacao === 'conciliado' && !['conciliado', 'revertido'].includes(newRow.status_conciliacao)) {
    throw new Error('Item conciliado nao pode ser alterado sem reversao autorizada.');
  }

  let isRetificacaoNsa11 = false;

  const oldMinusVal = { ...oldRow };
  delete oldMinusVal.valor_retornado;
  const newMinusVal = { ...newRow };
  delete newMinusVal.valor_retornado;

  const outrosCamposIdenticos = JSON.stringify(oldMinusVal) === JSON.stringify(newMinusVal);

  if (
    oldRow.status_conciliacao === 'conciliado' &&
    AUTHORIZED_IDS.includes(oldRow.id) &&
    oldRow.retorno_arquivo_id === RETORNO_ID &&
    oldRow.remessa_arquivo_id === REMESSA_ID &&
    oldRow.diaristas_lote_id === LOTE_ID &&
    oldRow.tenant_id === TENANT_ID &&
    oldRow.status === 'pago' &&
    oldRow.valor_retornado === null &&
    newRow.valor_retornado === oldRow.valor_esperado &&
    newRow.valor_retornado !== null &&
    outrosCamposIdenticos
  ) {
    isRetificacaoNsa11 = true;
  }

  if (
    oldRow.status_conciliacao === 'conciliado' &&
    (newRow.valor_esperado !== oldRow.valor_esperado || newRow.valor_retornado !== oldRow.valor_retornado) &&
    !isRetificacaoNsa11
  ) {
    throw new Error('Valores de item conciliado nao podem ser alterados silenciosamente.');
  }

  return newRow;
}

function simularGuardCanonico(oldRow, newRow) {
  if (newRow.status !== oldRow.status) {
    throw new Error('O status bancario do retorno nao pode ser alterado manualmente.');
  }

  if (oldRow.status_conciliacao === 'conciliado' && !['conciliado', 'revertido'].includes(newRow.status_conciliacao)) {
    throw new Error('Item conciliado nao pode ser alterado sem reversao autorizada.');
  }

  if (
    oldRow.status_conciliacao === 'conciliado' &&
    (newRow.valor_esperado !== oldRow.valor_esperado || newRow.valor_retornado !== oldRow.valor_retornado)
  ) {
    throw new Error('Valores de item conciliado nao podem ser alterados silenciosamente.');
  }

  return newRow;
}

const baseItem1 = {
  id: AUTHORIZED_IDS[0],
  tenant_id: TENANT_ID,
  retorno_arquivo_id: RETORNO_ID,
  remessa_arquivo_id: REMESSA_ID,
  diaristas_lote_id: LOTE_ID,
  empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
  status: 'pago',
  status_conciliacao: 'conciliado',
  observacao_conciliacao: null,
  valor_esperado: 140.0,
  valor_retornado: null,
};

const results = [];

// Test 1: Saneamento exato
try {
  const updated = { ...baseItem1, valor_retornado: 140.0 };
  simularGuardTemporario(baseItem1, updated);
  results.push('TEST 1 (Saneamento Exato): PASS');
} catch (e) {
  results.push('TEST 1: FAIL: ' + e.message);
}

// Test 2: Rejeição de R$ 999,00
try {
  const updated = { ...baseItem1, valor_retornado: 999.0 };
  simularGuardTemporario(baseItem1, updated);
  results.push('TEST 2 (Tentativa R$ 999,00): FAIL (nao bloqueou)');
} catch (e) {
  if (e.message.includes('Valores de item conciliado nao podem ser alterados silenciosamente.')) {
    results.push('TEST 2 (Tentativa R$ 999,00 Bloqueada com Sucesso): PASS');
  } else {
    results.push('TEST 2: FAIL com erro inesperado: ' + e.message);
  }
}

// Test 3: Tentativa de adulteração de observacao simultânea
try {
  const updated = {
    ...baseItem1,
    valor_retornado: 140.0,
    observacao_conciliacao: 'Tentativa de adulteração',
  };
  simularGuardTemporario(baseItem1, updated);
  results.push('TEST 3 (Alteracao Simultanea): FAIL (nao bloqueou)');
} catch (e) {
  if (e.message.includes('Valores de item conciliado nao podem ser alterados silenciosamente.')) {
    results.push('TEST 3 (Adulteração de Outros Campos Bloqueada com Sucesso): PASS');
  } else {
    results.push('TEST 3: FAIL com erro inesperado: ' + e.message);
  }
}

// Test 4: ID não autorizado
try {
  const unauth = { ...baseItem1, id: '99999999-9999-9999-9999-999999999999' };
  const updated = { ...unauth, valor_retornado: 140.0 };
  simularGuardTemporario(unauth, updated);
  results.push('TEST 4 (ID Nao Autorizado): FAIL (nao bloqueou)');
} catch (e) {
  results.push('TEST 4 (ID Não Autorizado Bloqueado com Sucesso): PASS');
}

// Test 5: Rejeição após já preenchido
try {
  const filled = { ...baseItem1, valor_retornado: 140.0 };
  const updated = { ...filled, valor_retornado: 145.0 };
  simularGuardTemporario(filled, updated);
  results.push('TEST 5 (Rejeicao Apos Preenchido): FAIL (nao bloqueou)');
} catch (e) {
  results.push('TEST 5 (Rejeição Pós-Preenchimento - Autoextinção): PASS');
}

// Test 6: Função canônica restaurada bloqueia qualquer alteração
try {
  const remediated = { ...baseItem1, valor_retornado: 140.0 };
  const attempt = { ...remediated, valor_retornado: 999.0 };
  simularGuardCanonico(remediated, attempt);
  results.push('TEST 6 (Funcao Canonica): FAIL (nao bloqueou)');
} catch (e) {
  results.push('TEST 6 (Função Canônica Restaurada Bloqueia R$ 999,00): PASS');
}

// Test 7: Hash e Integridade do Arquivo SQL
const sqlPath = 'y:/2026/ERP ESC LOG/Orbe/supabase/migrations/scripts/remediacao_historica_nsa11_fix_ret_08.sql';
const sqlContent = fs.readFileSync(sqlPath);
const sha256 = crypto.createHash('sha256').update(sqlContent).digest('hex');

results.push('ARQUIVO SQL: ' + sqlPath);
results.push('TAMANHO SQL: ' + sqlContent.length + ' bytes');
results.push('SHA-256 SQL: ' + sha256);

fs.writeFileSync('y:/2026/ERP ESC LOG/Orbe/src/test/results_fix_ret_08.txt', results.join('\n'));
console.log(results.join('\n'));
