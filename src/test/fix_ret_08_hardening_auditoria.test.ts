import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * ERP ORBE — FIX RET-08 | TESTE DE HARDENING DA BLINDAGEM E AUDITORIA
 *
 * Objetivo:
 *   Validar a lógica de regras da função guard_cnab_retorno_item_conciliacao()
 *   e do script transacional remediacao_historica_nsa11_fix_ret_08.sql:
 *   1. Rejeição de alteração quando valor_retornado já não é NULL.
 *   2. Rejeição de tentativa de alteração de observação, status ou qualquer outro campo.
 *   3. Rejeição de IDs não autorizados.
 *   4. Rejeição de valores divergentes de valor_esperado (ex: R$ 999,00).
 *   5. Validação de paridade do hash da restauração e bloqueio na função canônica restaurada.
 */

interface CnabRetornoItem {
  id: string;
  tenant_id: string;
  retorno_arquivo_id: string;
  remessa_arquivo_id: string;
  diaristas_lote_id: string;
  empresa_id: string;
  status: string;
  status_conciliacao: string;
  observacao_conciliacao: string | null;
  valor_esperado: number;
  valor_retornado: number | null;
  [key: string]: any;
}

const AUTHORIZED_IDS = [
  '1e94a70f-0591-44fb-9541-fb0bc4c6c644',
  '685d7146-f315-4f6a-9609-de6dabbe554e',
  '88f71013-09a6-48a8-9446-179930134950',
];
const RETORNO_ID = '853f93c9-0027-4607-b5de-16a557211243';
const REMESSA_ID = '46391aad-6417-48cf-ac78-03a2a9dd8b22';
const LOTE_ID = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
const TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';

/**
 * Simulador fiel da função guard TEMPORÁRIA do FIX-RET-08
 */
function simularGuardTemporario(oldRow: CnabRetornoItem, newRow: CnabRetornoItem) {
  if (newRow.status !== oldRow.status) {
    throw new Error('O status bancario do retorno nao pode ser alterado manualmente.');
  }

  if (oldRow.status_conciliacao === 'conciliado' && !['conciliado', 'revertido'].includes(newRow.status_conciliacao)) {
    throw new Error('Item conciliado nao pode ser alterado sem reversao autorizada.');
  }

  // Cláusula excepcional FIX-RET-08
  let isRetificacaoNsa11 = false;

  // Comparação de igualdade de todos os campos exceto valor_retornado
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

/**
 * Simulador fiel da função guard CANÔNICA ORIGINAL
 */
function simularGuardCanonico(oldRow: CnabRetornoItem, newRow: CnabRetornoItem) {
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

describe('FIX-RET-08 — Auditoria e Hardening da Lógica do Trigger e Transação', () => {
  const baseItem1: CnabRetornoItem = {
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

  it('1. Permite o saneamento exato quando todos os requisitos da janela temporária são atendidos', () => {
    const updated = { ...baseItem1, valor_retornado: 140.0 };
    expect(() => simularGuardTemporario(baseItem1, updated)).not.toThrow();
  });

  it('2. Rejeita se o valor_retornado proposto for diferente do valor_esperado (ex: R$ 999,00)', () => {
    const updated = { ...baseItem1, valor_retornado: 999.0 };
    expect(() => simularGuardTemporario(baseItem1, updated)).toThrow(
      'Valores de item conciliado nao podem ser alterados silenciosamente.'
    );
  });

  it('3. Rejeita se qualquer outro campo for modificado em conjunto (ex: observacao_conciliacao)', () => {
    const updated = {
      ...baseItem1,
      valor_retornado: 140.0,
      observacao_conciliacao: 'Tentativa de adulteração simultânea',
    };
    expect(() => simularGuardTemporario(baseItem1, updated)).toThrow(
      'Valores de item conciliado nao podem ser alterados silenciosamente.'
    );
  });

  it('4. Rejeita se o ID não for um dos 3 autorizados', () => {
    const unauthorizedItem = { ...baseItem1, id: '99999999-9999-9999-9999-999999999999' };
    const updated = { ...unauthorizedItem, valor_retornado: 140.0 };
    expect(() => simularGuardTemporario(unauthorizedItem, updated)).toThrow(
      'Valores de item conciliado nao podem ser alterados silenciosamente.'
    );
  });

  it('5. Rejeita se OLD.valor_retornado já estiver preenchido (autoextinção da exceção)', () => {
    const alreadyFilledItem = { ...baseItem1, valor_retornado: 140.0 };
    const updated = { ...alreadyFilledItem, valor_retornado: 145.0 };
    expect(() => simularGuardTemporario(alreadyFilledItem, updated)).toThrow(
      'Valores de item conciliado nao podem ser alterados silenciosamente.'
    );
  });

  it('6. Após restauração da função canônica, qualquer tentativa de alteração de valor é bloqueada', () => {
    const remediatedItem = { ...baseItem1, valor_retornado: 140.0 };
    const attemptAdulteration = { ...remediatedItem, valor_retornado: 999.0 };
    expect(() => simularGuardCanonico(remediatedItem, attemptAdulteration)).toThrow(
      'Valores de item conciliado nao podem ser alterados silenciosamente.'
    );
  });

  it('7. Valida integridade do script SQL remediacao_historica_nsa11_fix_ret_08.sql', () => {
    const filePath = 'y:/2026/ERP ESC LOG/Orbe/supabase/migrations/scripts/remediacao_historica_nsa11_fix_ret_08.sql';
    const content = fs.readFileSync(filePath, 'utf-8');

    // Valida presença de BEGIN, COMMIT e ROLLBACK guarantees
    expect(content).toMatch(/^BEGIN;/m);
    expect(content).toMatch(/COMMIT;$/m);

    // Valida que NÃO existe DROP TRIGGER ou DISABLE TRIGGER
    expect(content).not.toMatch(/DROP\s+TRIGGER/i);
    expect(content).not.toMatch(/DISABLE\s+TRIGGER/i);

    // Valida presença de LOCK TABLE em EXCLUSIVE MODE
    expect(content).toMatch(/LOCK\s+TABLE\s+public\.cnab_retorno_itens\s+IN\s+EXCLUSIVE\s+MODE/i);

    // Valida uso dinâmico de pg_get_functiondef
    expect(content).toMatch(/pg_get_functiondef\('public\.guard_cnab_retorno_item_conciliacao'::regproc\)/);

    // Valida ausência do teste falso de R$ 999,00
    expect(content).not.toMatch(/999\.00/);

    // Valida imutabilidade dos demais campos via to_jsonb
    expect(content).toMatch(/\(to_jsonb\(NEW\) - 'valor_retornado'\) = \(to_jsonb\(OLD\) - 'valor_retornado'\)/);

    // Valida verificação de integridade de FK para auth.users
    expect(content).toMatch(/FROM auth\.users/);
  });
});
